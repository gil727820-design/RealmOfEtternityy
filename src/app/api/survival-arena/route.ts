import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getWaveDef, simulateWave, cumulativeRewards, ARENA_DAILY_LIMIT, ARENA_ENERGY_COST } from "@/game/survivalArena";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const stats = (char.arenaStats as any) || {};
    const today = new Date().toDateString();
    const runsToday = stats.lastDate === today ? (stats.runsToday || 0) : 0;
    const bestWave = stats.bestWave || 0;
    const totalRuns = stats.totalRuns || 0;

    // Get ranking
    const allChars = await jsonDb.listCharacters("", 500);
    const ranking = allChars
      .map((c: any) => ({
        id: c.id, name: c.name, classType: c.classType || "warrior", sex: c.sex || "male",
        level: c.level || 1, bestWave: (c.arenaStats as any)?.bestWave || 0,
      }))
      .sort((a, b) => b.bestWave - a.bestWave)
      .slice(0, 20);

    const myRank = ranking.findIndex((r) => r.id === characterId) + 1;

    return NextResponse.json({
      bestWave, totalRuns, runsToday, dailyLimit: ARENA_DAILY_LIMIT,
      remaining: Math.max(0, ARENA_DAILY_LIMIT - runsToday),
      energy: char.energy || 0, ranking, myRank: myRank || null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action, startWave } = body;
    if (!characterId) return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    if (action === "fight") {
      const energy = (char.energy as number) || 0;
      if (energy < ARENA_ENERGY_COST) return NextResponse.json({ error: `Energia insuficiente! Custo: ${ARENA_ENERGY_COST} ⚡` }, { status: 400 });

      const stats = (char.arenaStats as any) || {};
      const today = new Date().toDateString();
      const runsToday = stats.lastDate === today ? (stats.runsToday || 0) : 0;
      if (runsToday >= ARENA_DAILY_LIMIT) return NextResponse.json({ error: "Limite diario atingido!" }, { status: 400 });

      const playerPower = (char.power as number) || 100;
      const start = Math.max(1, Number(startWave) || 1);
      let currentWave = start;
      let wavesWon = 0;
      const battleLog: any[] = [];

      // Simulate waves until defeat or max 50 waves
      for (let i = 0; i < 50; i++) {
        const waveDef = getWaveDef(currentWave);
        const result = simulateWave(playerPower, waveDef);
        battleLog.push({ wave: currentWave, won: result.won, bossWave: waveDef.bossWave, bossName: waveDef.bossName });
        if (result.won) {
          wavesWon++;
          currentWave++;
        } else {
          break;
        }
      }

      const finalWave = start + wavesWon - 1;
      const rewards = cumulativeRewards(finalWave);

      // Deduct energy
      const patch: any = {
        energy: energy - ARENA_ENERGY_COST,
        lastActivity: new Date().toISOString(),
      };

      // Update arena stats
      const newStats = { ...stats };
      newStats.lastDate = today;
      newStats.runsToday = runsToday + 1;
      newStats.totalRuns = (newStats.totalRuns || 0) + 1;
      if (finalWave > (newStats.bestWave || 0)) newStats.bestWave = finalWave;
      patch.arenaStats = newStats;

      // Apply rewards
      patch.gold = (char.gold || 0) + rewards.gold;
      patch.crystals = (char.crystals || 0) + rewards.crystals;

      await jsonDb.updateCharacter(characterId, patch);
      const updated = await jsonDb.findCharacterById(char.id);

      return NextResponse.json({
        success: true, startWave: start, finalWave, wavesWon,
        rewards, battleLog: battleLog.slice(-10), // last 10 waves
        character: updated,
      });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
