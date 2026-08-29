import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getTodayEvent, getNextEvent, getTimeUntilNextEvent, calculateEventRewards, DAILY_EVENTS } from "@/game/dailyEvents";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    const todayEvent = getTodayEvent();
    const nextEvent = getNextEvent();
    const timeUntil = getTimeUntilNextEvent();

    const result: any = {
      todayEvent,
      nextEvent,
      timeUntil,
      allEvents: DAILY_EVENTS,
    };

    if (characterId) {
      const char = await jsonDb.findCharacterById(characterId);
      if (char) {
        const completedToday = char.dailyMissions?.completedToday || 0;
        result.rewards = calculateEventRewards(todayEvent, char.level || 1, completedToday);
        result.playerLevel = char.level || 1;
        result.completedToday = completedToday;
      }
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action } = body;

    if (!characterId) {
      return NextResponse.json({ error: "characterId obrigatório" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    const todayEvent = getTodayEvent();

    if (action === "claim_rewards") {
      // Verificar se já reivindicou hoje
      const today = new Date().toDateString();
      const lastClaim = char.lastEvent?.date;
      if (lastClaim === today) {
        return NextResponse.json({ error: "Já reivindicou as recompensas de hoje!" }, { status: 400 });
      }

      const rewards = calculateEventRewards(todayEvent, char.level || 1, 1);
      const patch: any = { lastEvent: { id: todayEvent.id, date: today } };

      if (rewards.gold) patch.gold = (Number(char.gold) || 0) + rewards.gold;
      if (rewards.crystals) patch.crystals = (Number(char.crystals) || 0) + rewards.crystals;
      if (rewards.diamonds) patch.diamonds = (Number(char.diamonds) || 0) + rewards.diamonds;
      if (rewards.towerCoins) patch.towerCoins = (Number(char.towerCoins) || 0) + rewards.towerCoins;
      if (rewards.pvpCoins) patch.pvpCoins = (Number(char.pvpCoins) || 0) + rewards.pvpCoins;

      await jsonDb.updateCharacter(characterId, patch);

      return NextResponse.json({ success: true, rewards, event: todayEvent });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
