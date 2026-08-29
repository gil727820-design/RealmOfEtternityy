import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { PVP_LEAGUES, leagueForRating, type ClassName } from "@/game/constants";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    // Busca todos os personagens com rating > 0
    const allChars = await jsonDb.listCharacters("", 999999);
    const ranked = allChars
      .filter((c: any) => (c.pvpRating || 0) > 0)
      .map((c: any) => ({
        characterId: c.id,
        name: c.name,
        classType: c.classType,
        level: c.level,
        pvpRating: c.pvpRating || 0,
        pvpLeague: leagueForRating(c.pvpRating || 0),
        power: c.power || 0,
      }))
      .sort((a: any, b: any) => b.pvpRating - a.pvpRating)
      .slice(0, 50);

    // Posição do jogador atual
    const playerRank = ranked.findIndex((r: any) => r.characterId === characterId) + 1;

    // Posição do jogador atual (mesmo sem rating)
    const playerChar = allChars.find((c: any) => c.id === characterId);
    const playerRating = playerChar ? (playerChar.pvpRating || 0) : 0;
    const playerLeague = leagueForRating(playerRating);

    // Recompensas por liga (tokens diários)
    const leagueRewards: Record<string, { dailyTokens: number; bonusGold: number }> = {
      bronze: { dailyTokens: 10, bonusGold: 50 },
      silver: { dailyTokens: 15, bonusGold: 100 },
      gold: { dailyTokens: 22, bonusGold: 200 },
      platinum: { dailyTokens: 30, bonusGold: 350 },
      diamond: { dailyTokens: 40, bonusGold: 500 },
      master: { dailyTokens: 55, bonusGold: 750 },
      legend: { dailyTokens: 75, bonusGold: 1000 },
      emperor: { dailyTokens: 100, bonusGold: 1500 },
    };

    return NextResponse.json({
      ranking: ranked,
      playerRank: playerRank > 0 ? playerRank : ranked.length + 1,
      playerRating,
      playerLeague,
      totalPlayers: ranked.length,
      leagueRewards: leagueRewards[playerLeague] || leagueRewards.bronze,
      leagues: PVP_LEAGUES.map((l) => ({
        id: l.id,
        icon: l.icon,
        image: l.image,
        minRating: l.minRating,
        reward: leagueRewards[l.id] || { dailyTokens: 10, bonusGold: 50 },
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
