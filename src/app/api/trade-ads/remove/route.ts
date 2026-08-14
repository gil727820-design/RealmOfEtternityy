import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

/**
 * Remove um anúncio de troca: { characterId, adId }.
 * Só o dono pode remover. Anúncios não reservam itens (só mostram),
 * então não há nada a devolver — basta encerrar o anúncio.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const adId = body?.adId as string;

    if (!characterId || !adId) {
      return NextResponse.json({ error: "Personagem e anúncio são obrigatórios" }, { status: 400 });
    }

    const ad = await jsonDb.getMarketRecById(adId);
    if (!ad || ad.kind !== "tradeAd") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (ad.status !== "active") {
      return NextResponse.json({ error: "Este anúncio já foi finalizado" }, { status: 400 });
    }
    if (ad.posterId !== characterId) {
      return NextResponse.json({ error: "Você não é o dono deste anúncio" }, { status: 403 });
    }

    await jsonDb.updateMarketRec(adId, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "🗑️ Anúncio removido." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
