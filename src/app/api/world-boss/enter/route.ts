import { NextRequest, NextResponse } from "next/server";
import { loadCtx, participantFromChar, requireOpenEvent } from "../_state";
import jsonDb from "@/db/repo";

/** Entra na batalha do Boss Mundial (solo — depois pode convidar para um squad). */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const open = await requireOpenEvent(req, characterId);
    if (!open.ok) return open.response;
    const { ctx, auth } = open;
    const { event } = ctx;
    if (!event) return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });

    if (!event.participants[auth.char.id]) {
      event.participants[auth.char.id] = participantFromChar(auth.char);
      await jsonDb.saveWorldBossEvent(event);
    }

    return NextResponse.json({
      success: true,
      me: event.participants[auth.char.id],
      participantsCount: Object.keys(event.participants).length,
    });
  } catch (e: unknown) {
    console.error("World boss enter error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
