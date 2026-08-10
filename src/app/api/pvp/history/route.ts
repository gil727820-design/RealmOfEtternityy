import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const battles = await jsonDb.getBattlesByCharacterId(characterId, limit);
    return NextResponse.json({ battles });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}