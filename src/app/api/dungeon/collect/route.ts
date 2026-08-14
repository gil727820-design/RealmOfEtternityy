import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier } from "@/game/boosts";
import {
  computeDungeonRewards,
  computeDungeonStatus,
  dungeonDateKey,
} from "@/game/dungeons";

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

    const newGold = (char.gold || 0) + rw.gold;
    const newCrystals = (char.crystals || 0) + rw.crystals;

    // Itens NÃO dropam mais em expedições — apenas o painel admin concede itens.
    const rolled: any[] = [];

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