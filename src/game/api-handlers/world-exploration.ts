import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { rollWorldEvent } from "@/game/worldExploration";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const regionId = (char.currentRegion as string) || "starter_village";
    const level = (char.level as number) || 1;

    // Get exploration stats
    const stats = (char.explorationStats as any) || {};
    const today = new Date().toDateString();
    const exploredToday = stats.lastDate === today ? (stats.exploredToday || 0) : 0;
    const totalExplored = stats.totalExplored || 0;
    const totalTreasures = stats.totalTreasures || 0;
    const totalEvents = stats.totalEvents || {};

    return NextResponse.json({
      regionId,
      level,
      exploredToday,
      totalExplored,
      totalTreasures,
      totalEvents,
      energy: char.energy || 0,
    });
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
      return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    if (action === "explore") {
      const regionId = (char.currentRegion as string) || "starter_village";
      const level = (char.level as number) || 1;
      const energy = (char.energy as number) || 0;

      // Check energy
      if (energy < 2) {
        return NextResponse.json({ error: "Energia insuficiente! Minimo: 2 ⚡" }, { status: 400 });
      }

      // Daily limit
      const stats = (char.explorationStats as any) || {};
      const today = new Date().toDateString();
      const exploredToday = stats.lastDate === today ? (stats.exploredToday || 0) : 0;
      const DAILY_LIMIT = 20;

      if (exploredToday >= DAILY_LIMIT) {
        return NextResponse.json({ error: "Limite diario de exploracao atingido!" }, { status: 400 });
      }

      // Roll event
      const event = rollWorldEvent(regionId, level);

      // Deduct energy
      const patch: any = {
        energy: energy - event.energyCost,
        lastActivity: new Date().toISOString(),
      };

      // Update exploration stats
      const newStats = { ...stats };
      newStats.lastDate = today;
      newStats.exploredToday = exploredToday + 1;
      newStats.totalExplored = (newStats.totalExplored || 0) + 1;

      if (event.type === "treasure") {
        newStats.totalTreasures = (newStats.totalTreasures || 0) + 1;
      }

      newStats.totalEvents = newStats.totalEvents || {};
      newStats.totalEvents[event.id] = (newStats.totalEvents[event.id] || 0) + 1;

      patch.explorationStats = newStats;

      // Apply rewards
      if (event.type === "trap") {
        // Lose some gold on trap
        const lostGold = Math.floor((char.gold || 0) * 0.05);
        patch.gold = Math.max(0, (char.gold || 0) - lostGold);
      } else {
        if (event.reward.gold) patch.gold = (char.gold || 0) + event.reward.gold;
        if (event.reward.crystals) patch.crystals = (char.crystals || 0) + event.reward.crystals;
        if (event.reward.diamonds) patch.diamonds = (char.diamonds || 0) + event.reward.diamonds;
      }

      await jsonDb.updateCharacter(characterId, patch);
      const updated = await jsonDb.findCharacterById(char.id);

      return NextResponse.json({
        success: true,
        event,
        character: updated,
      });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
