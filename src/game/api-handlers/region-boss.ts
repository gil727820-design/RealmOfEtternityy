import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { regionBossFor, regionBossBattleMonster, bossKilledToday, bossDateKey, bossPowerPreview } from "@/game/regionBosses";

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const regionId = char.currentRegion ? String(char.currentRegion) : "starter_village";
    const boss = regionBossFor(regionId);

    if (!boss) {
      return NextResponse.json({ error: "Nenhum boss nesta região" }, { status: 404 });
    }

    // Stats da BATALHA (combate falso 🎬) — a prévia mostra o chefe "fraco".
    const stats = regionBossBattleMonster(char, boss);
    const todayKey = bossDateKey();

    return NextResponse.json({
      regionId,
      boss: {
        nameKey: boss.nameKey,
        image: boss.image,
        icon: boss.icon,
        stats,
        regionLevel: boss.regionLevel,
      },
      killedToday: bossKilledToday(char, regionId),
      resetKey: todayKey,
      playerPower: bossPowerPreview(char),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
