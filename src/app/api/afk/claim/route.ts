import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { xpMultiplier, energyMultiplier } from "@/game/boosts";
import { computeAfkRewards } from "@/game/afk";

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const afk = computeAfkRewards(char, char.afkSince, now);
    if (afk.diffSec < 60) return NextResponse.json({ gold: 0, xp: 0, duration: afk.diffSec, message: "Muito cedo" });

    const goldEarned = afk.gold;
    const xpEarned = afk.xp * xpMultiplier(char);

    let newXp = (char.xp || 0) + xpEarned;
    let newLevel = char.level || 1;
    let newXpToNext = char.xpToNext || 100;
    let newStatPoints = char.unspentStatPoints || 0;
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = xpForLevel(newLevel);
      newStatPoints += 3;
    }

    const newGold = (char.gold || 0) + goldEarned;
    const power = powerCalc({ attack: char.attack, defense: char.defense, hp: char.maxHp, speed: char.speed, critical: char.critical, level: newLevel });

    // Recarga passiva de energia (tempo real decorrido durante o descanso)
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));

    // Chance de drop de item durante o descanso (15% — foi buffada de 10%)
    let droppedItem = null;
    if (Math.random() < 0.15) {
      const items = await jsonDb.getItemTemplatesByMaxLevel(newLevel);
      if (items.length > 0) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        const result = await jsonDb.grantItem(characterId, randomItem.id, 1);
        droppedItem = { item: result?.item, template: result?.template, stackable: result?.merged };
      }
    }

    await jsonDb.updateCharacter(characterId, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      power,
      energy: regen.energy,
      lastEnergyAt: regen.lastEnergyAt,
      unspentStatPoints: newStatPoints,
      afkSince: now.toISOString(),
      lastActivity: now.toISOString(),
    });

    await jsonDb.insertAfkReward({ characterId, goldEarned, xpEarned, duration: afk.diffSec, claimedAt: new Date().toISOString() });

    return NextResponse.json({ gold: goldEarned, xp: xpEarned, duration: afk.diffSec, levelUp: newLevel > (char.level || 0), newLevel, droppedItem });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
