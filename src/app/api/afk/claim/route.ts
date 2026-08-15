import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { xpMultiplier, energyMultiplier, goldMultiplier } from "@/game/boosts";
import { computeAfkRewards } from "@/game/afk";
import { requireCharacterAuth } from "@/game/auth";

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    // Só o dono pode coletar as recompensas AFK do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Só existe o que coletar se uma sessão AFK estiver ativa (afkSince setado).
    // Após coletar a rota zera afkSince — o jogador escolhe se quer descansar
    // de novo (não reinicia sozinho como antes).
    if (!char.afkSince) {
      return NextResponse.json(
        { error: "Nenhuma sessão AFK ativa. Ative o modo descanso primeiro." },
        { status: 400 }
      );
    }

    const now = new Date();
    const afk = computeAfkRewards(char, char.afkSince, now);
    if (afk.diffSec < 60) return NextResponse.json({ gold: 0, xp: 0, duration: afk.diffSec, message: "Muito cedo" });

    const goldEarned = Math.floor(afk.gold * goldMultiplier(char));
    const xpEarned = Math.floor(afk.xp * xpMultiplier(char));

    let newXp = (char.xp || 0) + xpEarned;
    let newLevel = char.level || 1;
    let newXpToNext = char.xpToNext || 100;
    let newStatPoints = char.unspentStatPoints || 0;
    let newSkillPoints = char.skillPoints || 0;
    let levelsGained = 0;
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = xpForLevel(newLevel);
      newStatPoints += 3;
      if (newLevel % 3 === 0) newSkillPoints += 1;
      levelsGained++;
    }

    const newGold = (char.gold || 0) + goldEarned;
    const power = powerCalc({ attack: char.attack, defense: char.defense, hp: char.maxHp, speed: char.speed, critical: char.critical, level: newLevel });

    // Recarga passiva de energia (tempo real decorrido durante o descanso)
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));

    // Itens NÃO dropam mais em AFK — apenas o painel admin concede itens.
    const droppedItem = null;

    await jsonDb.updateCharacter(characterId, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      power,
      energy: regen.energy,
      lastEnergyAt: regen.lastEnergyAt,
      unspentStatPoints: newStatPoints,
      skillPoints: newSkillPoints,
      afkSince: null, // sessão encerrada — o jogador ativa de novo quando quiser
      lastActivity: now.toISOString(),
    });

    await jsonDb.insertAfkReward({ characterId, goldEarned, xpEarned, duration: afk.diffSec, claimedAt: new Date().toISOString() });

    return NextResponse.json({ gold: goldEarned, xp: xpEarned, duration: afk.diffSec, levelUp: newLevel > (char.level || 0), newLevel, droppedItem });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
