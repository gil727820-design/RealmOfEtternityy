import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, goldMultiplier } from "@/game/boosts";
import {
  computeDungeonRewards,
  computeDungeonStatus,
  dungeonDateKey,
  dungeonRollRarity,
  dungeonMaxRarityIdx,
} from "@/game/dungeons";

/** Rola `rolls` itens compatíveis com o nível e a profundidade da expedição. */
async function rollDungeonDrops(
  characterId: string,
  clears: number,
  rolls: number,
  level: number
): Promise<any[]> {
  const allItems = await jsonDb.getAllItemTemplates();
  const maxIdx = dungeonMaxRarityIdx(clears);
  const lvl = Math.max(1, Number(level) || 1);
  // Só EQUIPAMENTOS de raridade até o teto do andar (máx. raro) e de nível
  // acessível. Poções/consumíveis nunca dropam de masmorra — só na loja.
  const usable = allItems.filter((it: any) => {
    if (it.type === "consumable" || it.stackable === true) return false;
    const r = String(it.rarity || "common");
    const rIdx = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine"].indexOf(r);
    if (rIdx < 0 || rIdx > maxIdx) return false;
    return (Number(it.minLevel) || 1) <= lvl + 5;
  });

  const rolled: any[] = [];
  for (let i = 0; i < rolls; i++) {
    if (usable.length === 0) break;
    // Roll ponderado: itens de raridade mais próxima do teto têm mais peso.
    let rarity = dungeonRollRarity(clears);
    let pool = usable.filter((it: any) => String(it.rarity) === rarity);
    if (pool.length === 0) {
      // Fallback: sorteia entre todos os usáveis.
      pool = usable;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) continue;
    await jsonDb.grantItem(characterId, Number(pick.id), 1);
    rolled.push(pick);
  }
  return rolled;
}

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const status = computeDungeonStatus(char, now);

    // Exige uma expedição ativa e concluída (mesmo comportamento das missões).
    if (!status.active) {
      return NextResponse.json({ error: "Nenhuma expedição em andamento." }, { status: 400 });
    }
    if (!status.active.done) {
      return NextResponse.json(
        { error: "A expedição ainda não terminou.", remainingSec: status.active.remainingSec },
        { status: 400 }
      );
    }

    const hours = status.active.hours;
    const attemptFloor = status.active.attemptFloor;

    // Recompensas são recalculadas aqui (idênticas ao preview) com o poder atual.
    const rw = computeDungeonRewards(char, attemptFloor, hours);
    const defeat = rw.clears <= 0;

    // ---- Nível / XP (mesma curva das missões) ----
    let newXp = (char.xp || 0) + rw.xp;
    let newLevel = char.level || 1;
    let newXpToNext = char.xpToNext || 100;
    let newStatPoints = char.unspentStatPoints || 0;
    const anyXp = rw.xp > 0;
    while (anyXp && newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = xpForLevel(newLevel);
      newStatPoints += 3;
    }

    const newGold = (char.gold || 0) + Math.floor(rw.gold * goldMultiplier(char));
    const newCrystals = (char.crystals || 0) + rw.crystals;

    // ---- Drops de items (peso de raridade sobe com a profundidade) ----
    const rolled: any[] = rw.clears > 0 ? await rollDungeonDrops(characterId, rw.clears, rw.rolls, char.level) : [];

    // ---- Recarga passiva de energia durante a expedição ----
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));

    // ---- Estatísticas acumuladas + limite diário ----
    const todayKey = dungeonDateKey(now);
    const prev = char.dungeonStats || {};
    const usedToday = prev.lastDate === todayKey ? Number(prev.runsToday) || 0 : 0;
    const stats = {
      lastDate: todayKey,
      runsToday: usedToday + 1,
      totalRuns: (Number(prev.totalRuns) || 0) + 1,
      totalClears: (Number(prev.totalClears) || 0) + rw.clears,
      bestFloor: Math.max(Number(prev.bestFloor) || 0, rw.clears),
      itemsFound: (Number(prev.itemsFound) || 0) + rolled.length,
    };

    const power = powerCalc({
      attack: char.attack, defense: char.defense, hp: char.maxHp,
      speed: char.speed, critical: char.critical, level: newLevel,
    });

    await jsonDb.updateCharacter(characterId, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      crystals: newCrystals,
      power,
      energy: regen.energy,
      lastEnergyAt: regen.lastEnergyAt,
      unspentStatPoints: newStatPoints,
      dungeonActive: null,
      dungeonStats: stats,
      lastActivity: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      defeat,
      drops: rolled,
      gold: rw.gold,
      xp: rw.xp,
      crystals: rw.crystals,
      clears: rw.clears,
      boss: rw.boss,
      rolls: rw.rolls,
      bestRarity: rw.bestRarity,
      levelUp: newLevel > (char.level || 0),
      newLevel,
      stats,
    });
  } catch (e: unknown) {
    console.error("Dungeon collect error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}