import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

/** Abandona/cancela a sala de troca: { characterId, sessionId }. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const sessionId = body?.sessionId as string;

    if (!characterId || !sessionId) {
      return NextResponse.json({ error: "Personagem e sala são obrigatórios" }, { status: 400 });
    }

    const session = await jsonDb.getMarketRecById(sessionId);
    if (!session || session.kind !== "tradeSession") {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "Esta sala não está mais ativa" }, { status: 400 });
    }
    if (session.playerAId !== characterId && session.playerBId !== characterId) {
      return NextResponse.json({ error: "Você não participa desta sala" }, { status: 400 });
    }

    await jsonDb.updateMarketRec(sessionId, { status: "cancelled", cancelledAt: new Date().toISOString() });

    return NextResponse.json({ success: true, message: "Sala de troca encerrada." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
