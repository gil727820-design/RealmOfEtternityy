import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc, resolveMaxLevel } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, xpMultiplier, goldMultiplier } from "@/game/boosts";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { checkRateLimit } from "@/game/rateLimit";
import { grantGuildActivityXp } from "@/game/guildActivity";
import { registerDefeat } from "@/game/bestiary";
import { seasonPatch } from "@/game/season";
import { RELICS, relicTemplateId } from "@/game/relics";
import { hatchPetEgg, grantPetPatch } from "@/game/pets";
import { bossBattleStart, bossBattleStep } from "@/game/bossBattle";
import {
  regionBossFor,
  regionBossBattleMonster,
  bossKilledToday,
  bossDateKey,
  getBossKills,
  bossRewards,
  simulateRegionBossFight,
} from "@/game/regionBosses";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    // Só o dono pode desafiar o boss com o próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Boss da região ATUAL do personagem.
    const regionId = char.currentRegion ? String(char.currentRegion) : "starter_village";
    const boss = regionBossFor(regionId);
    if (!boss) {
      return NextResponse.json({ error: "Nenhum boss nesta região" }, { status: 404 });
    }

    // Só pode derrotar 1x por dia por região (cooldown até meia-noite).
    if (bossKilledToday(char, regionId)) {
      return NextResponse.json(
        { error: "Você já derrotou este boss hoje! Volte amanhã." },
        { status: 400 }
      );
    }

    // Anti-cheat: limite de batalhas por janela.
    const ok = checkRateLimit(`regionboss_${char.id}`, Date.now(), (msg) => {
      jsonDb.addAdminLog("anticheat", {
        source: "regionboss",
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

    // Nível máximo configurado no painel admin.
    const settings = await jsonDb.getServerSettings();
    const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);
    const allTemplates = await jsonDb.getAllItemTemplates();
    const now = new Date();

    // Monstro da batalha (combate falso 🎬: stats de batalha + RAGE).
    const monster = {
      nameKey: boss.nameKey,
      image: boss.image,
      icon: boss.icon,
      stats: regionBossBattleMonster(char, boss),
      boss: true,
      noScale: true,
      // Arranha pelo menos 3% da vida máxima por rodada (não some contra defesa).
      chipPct: 1.5,
      // RAGE: o chefe parece fraco (o jogador domina no começo), mas ao
      // chegar a 25% de vida ele se enfurece e desfere um SUPER ATAQUE
      // (≈80% da vida máxima do jogador). Se sobreviver, ele se ESGOTA e
      // você finaliza — se morrer, foi HUMILHADO. 🤡
      rage: { at: 25, buffPct: 30, superMult: 1.8, superPctMaxHp: 20, exhaustPct: 10 },
    };

    const action = String(body?.action || "");
    const state = body?.state as any;

    // ---- Fluxo antigo (sem action) — simulação instantânea, mantido p/ compat. ----
    if (!action) {
      const result = simulateRegionBossFight(char, boss, allTemplates);
      // Derrota: não registra kill, só atualiza atividade.
      if (!result.won) {
        await jsonDb.updateCharacter(char.id, {
          lastActivity: now.toISOString(),
        });
        return NextResponse.json({ ...result, character: char });
      }
      const applied = await applyRegionBossWin(char, boss, result, now, maxLevel, allTemplates);
      return NextResponse.json({
        ...result,
        rewards: applied.rewards,
        guildXp: applied.guildXp,
        grantedDrop: applied.grantedDrop,
        potionGranted: applied.potionGranted,
        relicDrop: applied.relicDrop,
        petDrop: applied.petDrop,
        character: applied.character,
      });
    }

    // ---- BATALHA IGUAL À TORRE (turno a turno) ----
    if (action === "start") {
      const { battle } = bossBattleStart(char, monster);
      return NextResponse.json({ ok: true, action, battle, log: [], events: [], won: false, lost: false });
    }

    if (!state || typeof state.monHp !== "number") {
      return NextResponse.json({ error: "Estado de batalha inválido" }, { status: 400 });
    }
    const step = bossBattleStep(char, monster, state, action, body?.auto || undefined);
    if (step.error) {
      const status = step.code === "battle_expired" ? 410 : 400;
      return NextResponse.json({ error: step.error, code: step.code }, { status });
    }

    // Derrota: não registra kill — pode tentar de novo.
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

    // ---- Vitória: recompensas + registro do cooldown diário ----
    const simResult = simulateRegionBossFight(char, boss, allTemplates);
    const applied = await applyRegionBossWin(char, boss, simResult, now, maxLevel, allTemplates);

    return NextResponse.json({
      ok: true,
      action,
      battle: step.battle,
      log: step.log,
      events: step.events,
      won: true,
      lost: false,
      rewards: applied.rewards,
      guildXp: applied.guildXp,
      grantedDrop: applied.grantedDrop,
      potionGranted: applied.potionGranted,
      relicDrop: applied.relicDrop,
      petDrop: applied.petDrop,
      character: applied.character,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Aplica as recompensas da vitória contra o boss regional. */
async function applyRegionBossWin(char: any, boss: any, result: any, now: Date, maxLevel: number, allTemplates: any[]) {
  const regen = computeEnergyRegen(char, now, energyMultiplier(char));

  let newXp = (char.xp || 0) + Math.floor(result.rewards.xp * xpMultiplier(char));
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
  }  // Cap no nível máximo: não acumula XP além do necessário.
  if (newLevel >= maxLevel) {
    newXp = 0;
    newXpToNext = 0;
  }


  const newGold = (char.gold || 0) + Math.floor(result.rewards.gold * goldMultiplier(char));

  // Drop exclusivo do boss: item + encanto de chefe aplicado na hora.
  let grantedDrop: any = null;
  if (result.drop) {
    const granted = await jsonDb.grantItem(char.id, result.drop.templateId, 1);
    if (granted?.item) {
      await jsonDb.updateInventoryItem(String(granted.item.id), { enchant: result.drop.enchant.id });
      grantedDrop = {
        templateId: result.drop.templateId,
        nameKey: result.drop.nameKey,
        icon: result.drop.icon,
        image: result.drop.image,
        rarity: result.drop.rarity,
        enchant: { id: result.drop.enchant.id, icon: result.drop.enchant.icon, stat: result.drop.enchant.stat, amount: result.drop.enchant.amount },
      };
    }
  }
  // Relíquia: 20% de chance no boss regional (buff passivo raro).
  let relicDrop: any = null;
  if (Math.random() < 0.2 && RELICS.length > 0) {
    const pick = RELICS[Math.floor(Math.random() * RELICS.length)];
    const grantedRelic = await jsonDb.grantItem(char.id, relicTemplateId(pick.id), 1);
    if (grantedRelic) {
      relicDrop = { relicId: pick.id, nameKey: pick.nameKey, icon: pick.icon, rarity: pick.rarity };
    }
  }

  // Ovo de PET: 15% de chance no boss regional — novo pet sem precisar da loja.
  let petDrop: any = null;
  if (Math.random() < 0.15) {
    const def = hatchPetEgg("rare");
    const res = grantPetPatch(char, def.id);
    if (res.def) {
      petDrop = {
        petId: res.def.id,
        nameKey: res.def.nameKey,
        icon: res.def.icon,
        rarity: res.def.rarity,
        added: res.added,
        patch: res.patch,
      };
    }
  }

  // Poção extra.
  let potionGranted: any = null;
  if (result.potionDrop) {
    const potions = allTemplates.filter((it: any) => it.type === "consumable" && Number(it.effect?.hp || 0) > 0);
    if (potions.length > 0) {
      const pick = potions[Math.floor(Math.random() * potions.length)];
      await jsonDb.grantItem(char.id, Number(pick.id), 1);
      potionGranted = { templateId: Number(pick.id), nameKey: pick.nameKey, icon: pick.icon };
    }
  }

  // Registra o kill de HOJE na região (cooldown diário).
  const kills = { ...getBossKills(char), [boss.regionId]: bossDateKey(now) };

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
    regionBossKills: kills,
    // Pet dropado (ou XP de duplicata) aplicado na vitória.
    ...(petDrop?.patch || {}),
    // Pet ativo padrão: se ganhou o primeiro pet e não tem nenhum equipado.
    ...(petDrop?.added && !char.activePetId ? { activePetId: petDrop.petId } : {}),
    // Missões diárias/semanais: progresso de boss regional.
    ...trackProgress(char, "boss", 1, now),
    // Bestiário: registra o boss regional derrotado.
    ...registerDefeat(char, `boss_${boss.regionId}`),
    // Temporada global: boss regional derrotado dá pontos de temporada.
    ...seasonPatch(char, "boss", now),
    lastActivity: now.toISOString(),
  });

  // Guilda evolutiva: boss regional derrotado dá XP para a guilda.
  const guildXp = await grantGuildActivityXp(char.id, "boss");

  return {
    character: updated,
    guildXp,
    rewards: {
      xp: Math.floor(result.rewards.xp * xpMultiplier(char)),
      gold: Math.floor(result.rewards.gold * goldMultiplier(char)),
      levelUp: newLevel > (char.level || 0),
      newLevel,
    },
    grantedDrop,
    potionGranted,
    relicDrop,
    petDrop: petDrop ? { petId: petDrop.petId, nameKey: petDrop.nameKey, icon: petDrop.icon, rarity: petDrop.rarity, added: petDrop.added } : null,
  };
}
