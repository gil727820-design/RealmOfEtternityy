import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  seasonInfo,
  seasonPoints,
  nextSeasonMilestone,
  SEASON_MILESTONES,
  seasonLabel,
} from "@/game/season";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    const info = seasonInfo();

    // Ranking da temporada atual (top 50 por pontos da temporada).
    const chars = await jsonDb.listCharacters("", 200);
    const ranked = chars
      .filter((c: any) => Number(c?.seasonId) === info.seasonId && (Number(c?.seasonPoints) || 0) > 0)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        classType: c.classType || "warrior",
        sex: c.sex || "male",
        level: c.level || 1,
        power: c.power || 0,
        seasonPoints: Math.max(0, Number(c.seasonPoints) || 0),
      }))
      .sort((a: any, b: any) => b.seasonPoints - a.seasonPoints)
      .slice(0, 50);

    let me = null;
    if (characterId) {
      const auth = await requireCharacterAuth(req, String(characterId));
      if (auth.ok) {
        const char = auth.char;
        const myPts = seasonPoints(char, info.seasonId);
        const myPos = ranked.findIndex((r: any) => r.id === String(characterId));
        me = {
          id: char.id,
          name: char.name,
          classType: char.classType || "warrior",
          sex: char.sex || "male",
          level: char.level || 1,
          seasonPoints: myPts,
          position: myPos >= 0 ? myPos + 1 : null,
        };
      }
    }

    const milestones = SEASON_MILESTONES.map((m, i) => {
      const prev = i === 0 ? 0 : SEASON_MILESTONES[i - 1].points;
      return { ...m, index: i, prevPoints: prev, claimed: false };
    });

    return NextResponse.json({
      seasonId: info.seasonId,
      label: seasonLabel(info.seasonId),
      startsAt: info.startsAt,
      endsAt: info.endsAt,
      daysLeft: info.daysLeft,
      ranking: ranked,
      me,
      milestones,
      nextMilestone: me ? nextSeasonMilestone({ seasonPoints: me.seasonPoints, seasonId: info.seasonId }, info.seasonId) : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
