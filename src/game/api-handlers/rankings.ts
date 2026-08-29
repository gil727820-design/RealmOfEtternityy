import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "power";
    const search = url.searchParams.get("search") || "";

    // Busca por nome (usado na troca entre jogadores): normaliza acentos.
    if (search) {
      const norm = (s: string) =>
        (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const q = norm(search);
      const chars = await jsonDb.listCharacters("", 500);
      const matches = chars
        .filter((c: any) => norm(c.name).includes(q))
        .slice(0, 10)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          classType: c.classType || "warrior",
          sex: c.sex || "male",
          level: c.level || 1,
          power: c.power || 0,
        }));
      return NextResponse.json({ rankings: matches, type: "search" });
    }

    const chars = await jsonDb.listCharacters("", 500);
    const normalized = chars.map((c: any) => {
      const bestiary = Array.isArray(c.bestiary) ? c.bestiary : [];
      const bestiaryCount = bestiary.length;
      const collection = Array.isArray(c.collection) ? c.collection : [];
      const collectionCount = collection.length;
      const dungeonStats = c.dungeonStats || {};
      const dungeonCleared = dungeonStats.cleared || 0;
      const ascensionCount = c.ascension?.count || 0;
      return {
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
        bestiaryCount,
        collectionCount,
        dungeonCleared,
        ascensionCount,
      };
    });

    let sorted;
    switch (type) {
      case "level": sorted = normalized.sort((a: any, b: any) => b.level - a.level); break;
      case "pvp": sorted = normalized.sort((a: any, b: any) => b.pvpRating - a.pvpRating); break;
      case "tower": sorted = normalized.sort((a: any, b: any) => b.towerFloor - a.towerFloor); break;
      case "wealth": sorted = normalized.sort((a: any, b: any) => b.gold - a.gold); break;
      case "prestige": sorted = normalized.sort((a: any, b: any) => b.prestige - a.prestige); break;
      case "bestiary": sorted = normalized.sort((a: any, b: any) => b.bestiaryCount - a.bestiaryCount); break;
      case "collection": sorted = normalized.sort((a: any, b: any) => b.collectionCount - a.collectionCount); break;
      case "dungeon": sorted = normalized.sort((a: any, b: any) => b.dungeonCleared - a.dungeonCleared); break;
      case "ascension": sorted = normalized.sort((a: any, b: any) => b.ascensionCount - a.ascensionCount); break;
      default: sorted = normalized.sort((a: any, b: any) => b.power - a.power);
    }

    return NextResponse.json({ rankings: sorted.slice(0, 50), type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}