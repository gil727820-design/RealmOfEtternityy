import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc, resolveMaxLevel } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, xpMultiplier, goldMultiplier } from "@/game/boosts";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { checkRateLimit } from "@/game/rateLimit";
import { rollRegionMob, simulateRegionMobFight, mobsForRegion } from "@/game/regionMobs";
import { rollMissionDrops } from "@/game/drops";
import { rollMaterialDrop } from "@/game/materials";
import { rollRandomEvent } from "@/game/randomEvents";
import { registerDefeat } from "@/game/bestiary";

/** Custo de energia por batalha de farm. */
const FARM_ENERGY_COST = 2;

/** Farm AUTOMÁTICO: quantidade de lutas por sessão. */
const FARM_AUTO_BATTLES = 5;
/** Recompensa do modo automático (menos que o manual). */
const FARM_AUTO_REWARD_MULT = 0.6;
/** Chance de drop no modo automático (metade da manual). */
const FARM_AUTO_DROP_MULT = 0.5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    // Só o dono pode farmar com o próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Anti-cheat: limite de batalhas por janela.
    const ok = checkRateLimit(`regionfarm_${char.id}`, Date.now(), (msg) => {
      jsonDb.addAdminLog("anticheat", {
        source: "regionfarm",
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
    const infiniteEnergy = !!settings?.infiniteEnergy;

    // Região atual do personagem (determina os mobs e a força deles).
    const regionId = char.currentRegion ? String(char.currentRegion) : "starter_village";
    const regionLevel = Math.max(1, Number(char.level) || 1);

    // Custo de energia (combustível do conteúdo secundário).
    const regen = computeEnergyRegen(char, new Date(), energyMultiplier(char));
    if (!infiniteEnergy && regen.energy < FARM_ENERGY_COST) {
      return NextResponse.json(
        { error: `Energia insuficiente! Custo: ${FARM_ENERGY_COST} ⚡` },
        { status: 400 }
      );
    }

    const now = new Date();

    // ---- FARM AUTOMÁTICO: 5 lutas seguidas com MENOS recompensa ----
    if (body?.auto === true) {
      const totalCost = FARM_ENERGY_COST * FARM_AUTO_BATTLES;
      if (!infiniteEnergy && regen.energy < totalCost) {
        return NextResponse.json(
          { error: `Energia insuficiente! Custo do farm automático: ${totalCost} ⚡` },
          { status: 400 }
        );
      }

      const allTemplates = await jsonDb.getAllItemTemplates();
      const battles: any[] = [];
      const drops: any[] = [];
      let materialDrop: any = null;
      let totalXp = 0;
      let totalGold = 0;
      let wins = 0;
      let losses = 0;
      const defeatedIds: string[] = [];
      let randomEvent: any = null;

      for (let i = 0; i < FARM_AUTO_BATTLES; i++) {
        const { mob, elite } = rollRegionMob(regionId);
        const result = simulateRegionMobFight(char, regionLevel, mob, elite);
        if (result.won) {
          wins++;
          defeatedIds.push(mob.id);
          // Menos recompensa: 60% do XP/ouro normal.
          totalXp += Math.floor(result.rewards.xp * FARM_AUTO_REWARD_MULT);
          totalGold += Math.floor(result.rewards.gold * FARM_AUTO_REWARD_MULT);
          // Menos drops: chance pela metade, elite ainda ajuda.
          if (Math.random() < (elite ? 0.3 : 0.15) * FARM_AUTO_DROP_MULT) {
            const dd = rollMissionDrops(allTemplates, char.level || 1);
            for (const d of dd) {
              await jsonDb.grantItem(char.id, d.templateId, d.quantity);
            }
            drops.push(...dd);
          }
        } else {
          losses++;
        }
        battles.push({
          mob: { id: mob.id, nameKey: mob.nameKey, image: mob.image, icon: mob.icon, elite },
          won: result.won,
          rounds: result.rounds,
          log: result.log.slice(-3),
        });
      }

      // Acumula XP/ouro com multiplicadores e aplica level up.
      let newXp = (char.xp || 0) + Math.floor(totalXp * xpMultiplier(char));
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
      }      // Cap no nível máximo: não acumula XP além do necessário.
      if (newLevel >= maxLevel) {
        newXp = 0;
        newXpToNext = 0;
      }

      const newGold = (char.gold || 0) + Math.floor(totalGold * goldMultiplier(char));

      // Material: rola UMA vez por sessão com chance reduzida.
      const mat = rollMaterialDrop(char.level || 1, 0.35 * FARM_AUTO_DROP_MULT);
      if (mat) {
        const granted = await jsonDb.grantItem(char.id, mat.id, 1);
        if (granted) {
          materialDrop = { templateId: mat.id, nameKey: mat.nameKey, icon: mat.icon, rarity: mat.rarity, merged: granted.merged };
        }
      }

      // Evento aleatório: chance reduzida no modo automático.
      if (Math.random() < 0.05) {
        const ev = rollRandomEvent();
        if (ev) {
          const evState = { id: ev.id, createdAt: Date.now() };
          await jsonDb.updateCharacter(char.id, { pendingEvent: evState });
          randomEvent = { ...ev, createdAt: evState.createdAt };
        }
      }

      const power = powerCalc({
        attack: char.attack, defense: char.defense, hp: char.maxHp,
        speed: char.speed, critical: char.critical, level: newLevel,
      });

      // Bestiário: registra cada mob derrotado na sessão (encadeado).
      let bestiaryPatch: any = {};
      let tmpChar = char;
      for (const id of defeatedIds) {
        bestiaryPatch = registerDefeat(tmpChar, id);
        tmpChar = { ...char, ...bestiaryPatch };
      }

      await jsonDb.updateCharacter(char.id, {
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        gold: newGold,
        power,
        energy: infiniteEnergy ? regen.energy : regen.energy - totalCost,
        lastEnergyAt: now.toISOString(),
        unspentStatPoints: newStatPoints,
        skillPoints: newSkillPoints,
        ...trackProgress(char, "missions", wins, now),
        ...bestiaryPatch,
        lastActivity: now.toISOString(),
      });

      return NextResponse.json({
        auto: true,
        battles,
        wins,
        losses,
        rewards: {
          xp: Math.floor(totalXp * xpMultiplier(char)),
          gold: Math.floor(totalGold * goldMultiplier(char)),
          levelUp: newLevel > (char.level || 0),
          newLevel,
        },
        drops,
        materialDrop,
        randomEvent,
        energyCost: totalCost,
      });
    }

    // Rola o mob (elite com ~5% de chance) e simula a batalha.
    const { mob, elite } = rollRegionMob(regionId);
    const result = simulateRegionMobFight(char, regionLevel, mob, elite);

    // Derrota: só gasta energia e atualiza atividade.
    if (!result.won) {
      await jsonDb.updateCharacter(char.id, {
        energy: infiniteEnergy ? regen.energy : regen.energy - FARM_ENERGY_COST,
        lastEnergyAt: now.toISOString(),
        lastActivity: now.toISOString(),
      });
      return NextResponse.json({
        ...result,
        mob: { id: mob.id, nameKey: mob.nameKey, image: mob.image, icon: mob.icon, elite },
        character: char,
      });
    }

    // ---- Vitória: XP/ouro + chance de drop ----
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
    }    // Cap no nível máximo: não acumula XP além do necessário.
    if (newLevel >= maxLevel) {
      newXp = 0;
      newXpToNext = 0;
    }


    const newGold = (char.gold || 0) + Math.floor(result.rewards.gold * goldMultiplier(char));

    // Drop: elites têm 2x a chance de dropar item.
    const allTemplates = await jsonDb.getAllItemTemplates();
    let drops: any[] = [];
    if (Math.random() < (elite ? 0.3 : 0.15)) {
      drops = rollMissionDrops(allTemplates, char.level || 1);
      for (const d of drops) {
        await jsonDb.grantItem(char.id, d.templateId, d.quantity);
      }
    }

    // Drop de MATERIAL (crafting): 35% base; elite garante (100%).
    let materialDrop: any = null;
    const mat = rollMaterialDrop(char.level || 1, elite ? 1 : 0.35);
    if (mat) {
      const granted = await jsonDb.grantItem(char.id, mat.id, 1);
      if (granted) {
        materialDrop = {
          templateId: mat.id,
          nameKey: mat.nameKey,
          icon: mat.icon,
          rarity: mat.rarity,
          merged: granted.merged,
        };
      }
    }

    const power = powerCalc({
      attack: char.attack, defense: char.defense, hp: char.maxHp,
      speed: char.speed, critical: char.critical, level: newLevel,
    });

    await jsonDb.updateCharacter(char.id, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      power,
      energy: infiniteEnergy ? regen.energy : regen.energy - FARM_ENERGY_COST,
      lastEnergyAt: now.toISOString(),
      unspentStatPoints: newStatPoints,
      skillPoints: newSkillPoints,
      // Missões diárias/semanais: progresso de mobs derrotados.
      ...trackProgress(char, "missions", 1, now),
      // Bestiário: registra o mob derrotado.
      ...registerDefeat(char, mob.id),
      lastActivity: now.toISOString(),
    });

    // Evento aleatório ao farmar (menor chance que nas missões).
    let randomEvent: any = null;
    if (elite || Math.random() < 0.08) {
      const ev = rollRandomEvent();
      if (ev) {
        const evState = { id: ev.id, createdAt: Date.now() };
        await jsonDb.updateCharacter(char.id, { pendingEvent: evState });
        randomEvent = { ...ev, createdAt: evState.createdAt };
      }
    }

    return NextResponse.json({
      ...result,
      rewards: {
        xp: Math.floor(result.rewards.xp * xpMultiplier(char)),
        gold: Math.floor(result.rewards.gold * goldMultiplier(char)),
        levelUp: newLevel > (char.level || 0),
        newLevel,
      },
      drops,
      materialDrop,
      randomEvent,
      mob: { id: mob.id, nameKey: mob.nameKey, image: mob.image, icon: mob.icon, elite },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Lista os mobs da região (para a UI mostrar o que existe por lá). */
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
    const mobs = mobsForRegion(regionId).map((m) => ({
      id: m.id,
      nameKey: m.nameKey,
      image: m.image,
      icon: m.icon,
      elite: !!m.elite,
    }));

    return NextResponse.json({ regionId, mobs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
