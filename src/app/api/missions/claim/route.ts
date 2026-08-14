import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc, missionXpReward } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { xpMultiplier, energyMultiplier, goldMultiplier } from "@/game/boosts";

export async function POST(req: NextRequest) {
  try {
    const { activeMissionId } = await req.json();
    const am = await jsonDb.getActiveMissionById(activeMissionId);
    if (!am) return NextResponse.json({ error: "Missão não encontrada" }, { status: 404 });
    if (am.claimed) return NextResponse.json({ error: "Já coletada" }, { status: 400 });

    const now = new Date();
    if (now < new Date(am.endsAt)) return NextResponse.json({ error: "Missão ainda em andamento" }, { status: 400 });

    const char = await jsonDb.findCharacterById(am.characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const mission = await jsonDb.getMissionTemplateById(am.missionId);

    // Recarga passiva de energia (o tempo decorrido enquanto a missão rodava)
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));

    // Calculate rewards (XP balanceado que escala com o nível da missão)
    const xpGain = missionXpReward(mission) * xpMultiplier(char);
    let newXp = (char.xp || 0) + xpGain;
    let newLevel = char.level || 1;
    let newXpToNext = char.xpToNext || 100;
    let newStatPoints = char.unspentStatPoints || 0;

    // Level up check
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = xpForLevel(newLevel);
      newStatPoints += 3;
    }

    const newGold = (char.gold || 0) + Math.floor((mission.goldReward || 0) * goldMultiplier(char));
    const power = powerCalc({ attack: char.attack, defense: char.defense, hp: char.maxHp, speed: char.speed, critical: char.critical, level: newLevel });

    // Itens NÃO dropam mais em missões — apenas o painel admin concede itens.
    const droppedItem = null;

    await jsonDb.updateCharacter(char.id, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      power,
      unspentStatPoints: newStatPoints,
      missionBatch: [], // força o embaralhamento de um novo grupo de missões
      energy: regen.energy,
      lastEnergyAt: regen.lastEnergyAt,
      lastActivity: now.toISOString(),
    });

    await jsonDb.updateActiveMission(activeMissionId, { claimed: true, completed: true });

    return NextResponse.json({ rewards: { xp: xpGain, gold: mission.goldReward, levelUp: newLevel > (char.level || 0), newLevel, droppedItem } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
