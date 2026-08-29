import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { CHALLENGE_START_FLOOR, CHALLENGE_DIFFICULTY_MULT, CHALLENGE_REWARD_MULT, challengeFloorGold, challengeFloorXp, challengeFloorTowerCoins } from "@/game/towerChallenge";
import { xpForLevel } from "@/game/constants";

/** GET: retorna ranking semanal do modo desafio. */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const allChars = await jsonDb.listCharacters("", 999999);
    
    // Ranking baseado no melhor andar do desafio
    const ranked = allChars
      .filter((c: any) => (c.challengeBestFloor || 0) > 0)
      .map((c: any) => ({
        characterId: c.id,
        name: c.name,
        classType: c.classType,
        level: c.level,
        bestFloor: c.challengeBestFloor || 0,
        challengeRuns: c.challengeRuns || 0,
      }))
      .sort((a: any, b: any) => b.bestFloor - a.bestFloor)
      .slice(0, 50);

    const playerRank = ranked.findIndex((r: any) => r.characterId === characterId) + 1;
    const playerBestFloor = Number(char.challengeBestFloor) || 0;
    const playerRuns = Number(char.challengeRuns) || 0;

    return NextResponse.json({
      ranking: ranked,
      playerRank: playerRank > 0 ? playerRank : ranked.length + 1,
      playerBestFloor,
      playerRuns,
      totalPlayers: ranked.length,
      startFloor: CHALLENGE_START_FLOOR,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST: iniciar战斗 no modo desafio (a partir de um andar específico). */
export async function POST(req: NextRequest) {
  try {
    const { characterId, action, floor } = await req.json();
    if (!characterId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const currentFloor = Math.max(CHALLENGE_START_FLOOR, Math.floor(Number(floor) || CHALLENGE_START_FLOOR));

    if (action === "start") {
      // Inicia batalha no andar especificado
      return NextResponse.json({
        ok: true,
        floor: currentFloor,
        message: `Modo Desafio: andar ${currentFloor}!`,
      });
    }

    if (action === "win") {
      // Jogador venceu o andar — concede recompensas
      const gold = challengeFloorGold(currentFloor);
      const xp = challengeFloorXp(currentFloor);
      const towerCoins = challengeFloorTowerCoins(currentFloor);

      let newXp = (char.xp || 0) + xp;
      let newLevel = char.level || 1;
      let newXpToNext = char.xpToNext || xpForLevel(newLevel);
      let newStatPoints = char.unspentStatPoints || 0;
      let newSkillPoints = char.skillPoints || 0;

      while (newLevel < 999 && newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = xpForLevel(newLevel);
        newStatPoints += 3;
        if (newLevel % 3 === 0) newSkillPoints += 1;
      }

      const bestFloor = Math.max(Number(char.challengeBestFloor) || 0, currentFloor + 1);

      await jsonDb.updateCharacter(char.id, {
        gold: (char.gold || 0) + gold,
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        unspentStatPoints: newStatPoints,
        skillPoints: newSkillPoints,
        towerCoins: (char.towerCoins || 0) + towerCoins,
        challengeBestFloor: bestFloor,
        challengeRuns: (Number(char.challengeRuns) || 0) + 1,
      });

      return NextResponse.json({
        success: true,
        gold,
        xp,
        towerCoins,
        bestFloor,
        level: newLevel,
        character: await jsonDb.findCharacterById(char.id),
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
