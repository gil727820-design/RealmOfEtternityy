import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { pvpSeasonInfo, seasonBest, seasonRewardsFor } from "@/game/pvpSeason";
import { requireCharacterAuth } from "@/game/auth";

/** Status da temporada atual + melhor rating + recompensas pendentes. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const info = pvpSeasonInfo();
    const best = seasonBest(char, info.seasonId);
    const rewards = seasonRewardsFor(best);
    const claimed = char?.pvpSeasonClaimed === info.seasonId;

    return NextResponse.json({
      season: info,
      bestRating: best,
      rewards,
      claimed,
      currentRating: Number(char.pvpRating) || 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Coleta as recompensas do fim da temporada (somente após terminar). */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const info = pvpSeasonInfo();
    // A temporada ainda não acabou → não dá para coletar.
    if (info.daysLeft > 0) {
      return NextResponse.json(
        { error: `A temporada termina em ${info.daysLeft} dia(s). As recompensas são liberadas no fim.` },
        { status: 400 }
      );
    }
    if (char?.pvpSeasonClaimed === info.seasonId) {
      return NextResponse.json({ error: "Recompensas já coletadas" }, { status: 400 });
    }

    const best = seasonBest(char, info.seasonId);
    const rw = seasonRewardsFor(best);
    const updated = await jsonDb.updateCharacter(String(characterId), {
      gold: (Number(char.gold) || 0) + rw.gold,
      pvpCoins: (Number(char.pvpCoins) || 0) + rw.pvpCoins,
      crystals: (Number(char.crystals) || 0) + rw.crystals,
      pvpSeasonClaimed: info.seasonId,
      lastActivity: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      reward: rw,
      character: updated,
      message: `🏆 Recompensas da temporada: ${rw.gold} 🪙, ${rw.pvpCoins} ⚔️, ${rw.crystals} 🔮`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
