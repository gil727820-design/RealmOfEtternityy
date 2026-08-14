import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

/** Salas de troca ativas que envolvem o personagem (perspectiva dele). */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId") as string;
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const sessions = await jsonDb.getSessionsByCharacter(characterId);
    return NextResponse.json({ sessions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
