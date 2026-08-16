import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc, resolveMaxLevel } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, xpMultiplier, goldMultiplier } from "@/game/boosts";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { checkRateLimit } from "@/game/rateLimit";
import {
  miniBossForRegion,
  miniBossStats,
  miniBossRewards,
  MINI_BOSS_COOLDOWN_MS,
  simulateMiniBossFight,
} from "@/game/regionMobs";
import { MATERIAL_TEMPLATES, rollMaterialDrop } from "@/game/materials";
import { registerDefeat } from "@/game/bestiary";
import { RELICS, relicTemplateId } from "@/game/relics";
import { hatchPetEgg, grantPetPatch } from "@/game/pets";
import { bossBattleStart, bossBattleStep } from "@/game/bossBattle";

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const regionId = char.currentRegion ? String(char.currentRegion) : "starter_village";
    const mb = miniBossForRegion(regionId);
    if (!mb) {
      return NextResponse.json({ error: "Nenhum mini-boss nesta região" }, { status: 404 });
    }

    const stats = miniBossStats(mb, char.level || 1);
    const lastKill = Number(char.miniBossKilledAt) || 0;
    const remainingMs = Math.max(0, MINI_BOSS_COOLDOWN_MS - (Date.now() - lastKill));

    return NextResponse.json({
      regionId,
      miniBoss: {
        nameKey: mb.nameKey,
        image: mb.image,
        icon: mb.icon,
        stats,
      },
      available: remainingMs <= 0,
      remainingMs,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const regionId = char.currentRegion ? String(char.currentRegion) : "starter_village";
    const mb = miniBossForRegion(regionId);
    if (!mb) {
      return NextResponse.json({ error: "Nenhum mini-boss nesta região" }, { status: 404 });
    }

    // Respawn: só pode lutar depois do cooldown (30 min desde a última derrota).
    const lastKill = Number(char.miniBossKilledAt) || 0;
    if (Date.now() - lastKill < MINI_BOSS_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "O mini-boss ainda não respawnou! Volte mais tarde.", code: "cooldown" },
        { status: 400 }
      );
    }

    const ok = checkRateLimit(`miniboss_${char.id}`, Date.now(), (msg) => {
      jsonDb.addAdminLog("anticheat", {
        source: "miniboss",
        characterId: char.id,
        characterName: char.name || "?",
        message: msg,
      });
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Ação muito rápida — aguarde alguns segundos.", code: "rate_limited" },
        { status: 429 }
      );
    }

    const settings = await jsonDb.getServerSettings();
    const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);
    const allTemplates = await jsonDb.getAllItemTemplates();
    const now = new Date();

    // Monstro da batalha (mesma imagem/stats da prévia do GET).
    const monster = {
      nameKey: mb.nameKey,
      image: mb.image,
      icon: mb.icon,
      stats: miniBossStats(mb, Math.max(1, Number(char.level) || 1)),
      boss: true,
    };

    const action = String(body?.action || "");
    const state = body?.state as any;

    // ---- Fluxo antigo (sem action) — simulação instantânea, mantido p/ compat. ----
    if (!action) {
      const result = simulateMiniBossFight(char, mb, allTemplates);
      if (!result.won) {
        await jsonDb.updateCharacter(char.id, { lastActivity: now.toISOString() });
        return NextResponse.json({ ...result, character: char });
      }
      // Vitória → aplica as mesmas recompensas do fluxo novo.
      const applied = await applyMiniBossWin(char, mb, result.rewards, now, maxLevel, allTemplates);
      return NextResponse.json({
        ...result,
        rewards: applied.rewards,
        grantedDrop: applied.grantedDrop,
        materialDrop: applied.materialDrop,
        relicDrop: applied.relicDrop,
        petDrop: applied.petDrop,
        nextRespawnMs: MINI_BOSS_COOLDOWN_MS,
        character: applied.character,
      });
    }

    // ---- BATALHA IGUAL À TORRE (turno a turno) ----
    if (action === "start") {
      const { battle } = bossBattleStart(char, monster);
      return NextResponse.json({ ok: true, action, battle, log: [], events: [], won: false, lost: false });
    }

    // Ações de combate: estado vem do cliente, servidor valida e roda a rodada.
    if (!state || typeof state.monHp !== "number") {
      return NextResponse.json({ error: "Estado de batalha inválido" }, { status: 400 });
    }
    const step = bossBattleStep(char, monster, state, action, body?.auto || undefined);
    if (step.error) {
      const status = step.code === "battle_expired" ? 410 : 400;
      return NextResponse.json({ error: step.error, code: step.code }, { status });
    }

    // Derrota: não marca respawn — pode tentar de novo na hora.
    if (!step.won) {
      await jsonDb.updateCharacter(char.id, { lastActivity: now.toISOString() });
      return NextResponse.json({
        ok: true,
        action,
        battle: step.battle,
        log: step.log,
        events: step.events,
        won: false,
        lost: true,
        character: char,
      });
    }

    // ---- Vitória: recompensas + registro do respawn ----
    const rewards = miniBossRewards(char, Math.max(1, Number(char.level) || 1), true);
    const applied = await applyMiniBossWin(char, mb, rewards, now, maxLevel, allTemplates);

    return NextResponse.json({
      ok: true,
      action,
      battle: step.battle,
      log: step.log,
      events: step.events,
      won: true,
      lost: false,
      rewards: applied.rewards,
      grantedDrop: applied.grantedDrop,
      materialDrop: applied.materialDrop,
      relicDrop: applied.relicDrop,
      petDrop: applied.petDrop,
      nextRespawnMs: MINI_BOSS_COOLDOWN_MS,
      character: applied.character,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Aplica as recompensas da vitória contra o mini-boss (XP/ouro/drops/cooldown). */
async function applyMiniBossWin(char: any, mb: any, rewards: { xp: number; gold: number }, now: Date, maxLevel: number, allTemplates: any[]) {
  const regen = computeEnergyRegen(char, now, energyMultiplier(char));

  let newXp = (char.xp || 0) + Math.floor(rewards.xp * xpMultiplier(char));
  let newLevel = char.level || 1;
  let newXpToNext = char.xpToNext || 100;
  let newStatPoints = char.unspentStatPoints || 0;
  let newSkillPoints = char.skillPoints || 0;
  while (newLevel < maxLevel && newXp >= newXpToNext) {
    newXp -= newXpToNext;
    newLevel++;
    newXpToNext = xpForLevel(newLevel);
    newStatPoints += 3;
    if (newLevel % 3 === 0) newSkillPoints += 1;
  }

  const newGold = (char.gold || 0) + Math.floor(rewards.gold * goldMultiplier(char));

  let grantedDrop: any = null;

  // Chance de drop de RELÍQUIA (10% no mini-boss) — buff passivo raro.
  let relicDrop: any = null;
  if (Math.random() < 0.1 && RELICS.length > 0) {
    const pick = RELICS[Math.floor(Math.random() * RELICS.length)];
    const grantedRelic = await jsonDb.grantItem(char.id, relicTemplateId(pick.id), 1);
    if (grantedRelic) {
      relicDrop = { relicId: pick.id, nameKey: pick.nameKey, icon: pick.icon, rarity: pick.rarity };
    }
  }

  // Ovo de PET: 8% de chance no mini-boss — novo pet sem precisar da loja.
  let petDrop: any = null;
  if (Math.random() < 0.08) {
    const def = hatchPetEgg("basic");
    const res = grantPetPatch(char, def.id);
    if (res.def) {
      petDrop = {
        petId: res.def.id,
        nameKey: res.def.nameKey,
        icon: res.def.icon,
        rarity: res.def.rarity,
        added: res.added,
      };
      // Aplica o pet (ou XP de duplicata) junto com o update final.
      petDrop.patch = res.patch;
    }
  }

  // Mini-boss sempre dropa 1 material (raridade alta garantida).
  let materialDrop: any = null;
  const mat = rollMaterialDrop(Math.max(40, char.level || 1), 1);
  if (mat) {
    const grantedMat = await jsonDb.grantItem(char.id, mat.id, 1);
    if (grantedMat) {
      materialDrop = {
        templateId: mat.id,
        nameKey: mat.nameKey,
        icon: mat.icon,
        rarity: mat.rarity,
        merged: grantedMat.merged,
      };
    }
  }
  // Fallback: garante um material de raridade média se o sorteio não veio.
  if (!materialDrop) {
    const fallback = MATERIAL_TEMPLATES.find((m) => m.rarity === "epic") || MATERIAL_TEMPLATES[0];
    const grantedMat = await jsonDb.grantItem(char.id, fallback.id, 1);
    if (grantedMat) {
      materialDrop = {
        templateId: fallback.id,
        nameKey: fallback.nameKey,
        icon: fallback.icon,
        rarity: fallback.rarity,
        merged: grantedMat.merged,
      };
    }
  }

  // Drop exclusivo com encanto de chefe (mesmo sorteio do simulador antigo).
  const simDrop = simulateMiniBossFight(char, mb, allTemplates).drop;
  if (simDrop) {
    const granted = await jsonDb.grantItem(char.id, simDrop.templateId, 1);
    if (granted?.item) {
      await jsonDb.updateInventoryItem(String(granted.item.id), { enchant: simDrop.enchant.id });
      grantedDrop = {
        templateId: simDrop.templateId,
        nameKey: simDrop.nameKey,
        icon: simDrop.icon,
        image: simDrop.image,
        rarity: simDrop.rarity,
        enchant: { id: simDrop.enchant.id, icon: simDrop.enchant.icon, stat: simDrop.enchant.stat, amount: simDrop.enchant.amount },
      };
    }
  }

  const power = powerCalc({
    attack: char.attack, defense: char.defense, hp: char.maxHp,
    speed: char.speed, critical: char.critical, level: newLevel,
  });

  const updated = await jsonDb.updateCharacter(char.id, {
    xp: newXp,
    level: newLevel,
    xpToNext: newXpToNext,
    gold: newGold,
    power,
    energy: regen.energy,
    lastEnergyAt: regen.lastEnergyAt,
    unspentStatPoints: newStatPoints,
    skillPoints: newSkillPoints,
    // Marca o respawn: mini-boss só volta após o cooldown.
    miniBossKilledAt: Date.now(),
    // Pet dropado (ou XP de duplicata) aplicado na vitória.
    ...(petDrop?.patch || {}),
    // Pet ativo padrão: se ganhou o primeiro pet e não tem nenhum equipado.
    ...(petDrop?.added && !char.activePetId ? { activePetId: petDrop.petId } : {}),
    ...trackProgress(char, "boss", 1, now),
    // Bestiário: registra o mini-boss derrotado.
    ...registerDefeat(char, `miniboss_${char.currentRegion || "starter_village"}`),
    lastActivity: now.toISOString(),
  });

  return {
    character: updated,
    rewards: {
      xp: Math.floor(rewards.xp * xpMultiplier(char)),
      gold: Math.floor(rewards.gold * goldMultiplier(char)),
      levelUp: newLevel > (char.level || 0),
      newLevel,
    },
    grantedDrop,
    materialDrop,
    relicDrop,
    petDrop: petDrop ? { petId: petDrop.petId, nameKey: petDrop.nameKey, icon: petDrop.icon, rarity: petDrop.rarity, added: petDrop.added } : null,
  };
}
