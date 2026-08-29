import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    const allChars = await jsonDb.listCharacters("", 500);
    const ranking = allChars
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        classType: c.classType || "warrior",
        sex: c.sex || "male",
        level: c.level || 1,
        power: c.power || 0,
        bestFloor: (c.dungeonStats as any)?.bestFloor || 0,
        totalRuns: (c.dungeonStats as any)?.totalRuns || 0,
      }))
      .sort((a, b) => b.bestFloor - a.bestFloor || b.totalRuns - a.totalRuns)
      .slice(0, 50);

    // Find player position
    let myPosition = -1;
    if (characterId) {
      const idx = ranking.findIndex((r) => r.id === characterId);
      if (idx >= 0) myPosition = idx + 1;
    }

    return NextResponse.json({ ranking, myPosition });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
