import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { xpForLevel, powerCalc, missionXpReward, resolveMaxLevel } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { xpMultiplier, energyMultiplier, goldMultiplier } from "@/game/boosts";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { rollMissionDrops } from "@/game/drops";
import { grantGuildActivityXp } from "@/game/guildActivity";
import { rollRandomEvent } from "@/game/randomEvents";
import { seasonPatch } from "@/game/season";

export async function POST(req: NextRequest) {
  try {
    const { activeMissionId } = await req.json();
    const am = await jsonDb.getActiveMissionById(activeMissionId);
    if (!am) return NextResponse.json({ error: "Missão não encontrada" }, { status: 404 });
    if (am.claimed) return NextResponse.json({ error: "Já coletada" }, { status: 400 });

    const now = new Date();
    if (now < new Date(am.endsAt)) return NextResponse.json({ error: "Missão ainda em andamento" }, { status: 400 });

    // Só o dono do personagem pode coletar a recompensa da missão dele.
    const auth = await requireCharacterAuth(req, am.characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Nível máximo configurado no painel admin (0 = padrão 999).
    const settings = await jsonDb.getServerSettings();
    const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);

    const mission = await jsonDb.getMissionTemplateById(am.missionId);

    // Recarga passiva de energia (o tempo decorrido enquanto a missão rodava)
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));

    // Calculate rewards (XP balanceado que escala com o nível da missão)
    const xpGain = missionXpReward(mission) * xpMultiplier(char);
    let newXp = (char.xp || 0) + xpGain;
    let newLevel = char.level || 1;
    let newXpToNext = char.xpToNext || 100;
    let newStatPoints = char.unspentStatPoints || 0;
    let newSkillPoints = char.skillPoints || 0;

    // Level up check
    while (newLevel < maxLevel && newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = xpForLevel(newLevel);
      newStatPoints += 3;
      if (newLevel % 3 === 0) newSkillPoints += 1;
    }

    const newGold = (char.gold || 0) + Math.floor((mission.goldReward || 0) * goldMultiplier(char));
    const power = powerCalc({ attack: char.attack, defense: char.defense, hp: char.maxHp, speed: char.speed, critical: char.critical, level: newLevel });

    // DROPS de missão: chance de equipamento (5%) e poção (12%) — dá emoção
    // ao concluir missões sem virar farm de item (é uma chance pequena).
    const allTemplates = await jsonDb.getAllItemTemplates();
    const drops = rollMissionDrops(allTemplates, char.level || 1);
    for (const d of drops) {
      await jsonDb.grantItem(char.id, d.templateId, d.quantity);
    }

    await jsonDb.updateCharacter(char.id, {
      xp: newXp,
      level: newLevel,
      xpToNext: newXpToNext,
      gold: newGold,
      power,
      unspentStatPoints: newStatPoints,
      skillPoints: newSkillPoints,
      missionBatch: [], // força o embaralhamento de um novo grupo de missões
      energy: regen.energy,
      lastEnergyAt: regen.lastEnergyAt,
      // Missões diárias/semanais: progresso de missões concluídas.
      ...trackProgress(char, "missions", 1, now),
      // Temporada global: missão concluída dá pontos de temporada.
      ...seasonPatch(char, "mission", now),
      lastActivity: now.toISOString(),
    });

    await jsonDb.updateActiveMission(activeMissionId, { claimed: true, completed: true });

    // Guilda evolutiva: missão concluída dá XP para a guilda.
    const guildXp = await grantGuildActivityXp(char.id, "mission");

    // Evento aleatório: chance de aparecer um evento especial ao concluir.
    // Se rolar, salva no personagem (expira em 5 min) e a UI oferece aceitar/ignorar.
    let randomEvent: any = null;
    const ev = rollRandomEvent();
    if (ev) {
      const evState = { id: ev.id, createdAt: Date.now() };
      await jsonDb.updateCharacter(char.id, { pendingEvent: evState });
      randomEvent = { ...ev, createdAt: evState.createdAt };
    }

    return NextResponse.json({ rewards: { xp: xpGain, gold: mission.goldReward, levelUp: newLevel > (char.level || 0), newLevel, drops }, guildXp, randomEvent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
