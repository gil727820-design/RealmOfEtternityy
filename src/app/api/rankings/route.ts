import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "power";

    const chars = await jsonDb.listCharacters("", 100);
    const normalized = chars.map((c: any) => ({
      id: c.id,
      name: c.name,
      classType: c.classType || "warrior",
      sex: c.sex || "male",
      level: c.level || 1,
      power: c.power || 0,
      pvpRating: c.pvpRating || 0,
      pvpLeague: c.pvpLeague || "bronze",
      towerFloor: c.towerFloor || 1,
      gold: c.gold || 0,
      prestige: c.prestige || 0,
    }));

    let sorted;
    switch (type) {
      case "level": sorted = normalized.sort((a: any, b: any) => b.level - a.level); break;
      case "pvp": sorted = normalized.sort((a: any, b: any) => b.pvpRating - a.pvpRating); break;
      case "tower": sorted = normalized.sort((a: any, b: any) => b.towerFloor - a.towerFloor); break;
      case "wealth": sorted = normalized.sort((a: any, b: any) => b.gold - a.gold); break;
      case "prestige": sorted = normalized.sort((a: any, b: any) => b.prestige - a.prestige); break;
      default: sorted = normalized.sort((a: any, b: any) => b.power - a.power);
    }

    return NextResponse.json({ rankings: sorted.slice(0, 50), type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}