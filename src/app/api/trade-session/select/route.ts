import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { MAX_SESSION_ITEMS_PER_SIDE } from "@/game/tradeAds";

/** Define os itens que VOCÊ oferece: { characterId, sessionId, items }. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const sessionId = body?.sessionId as string;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!characterId || !sessionId) {
      return NextResponse.json({ error: "Personagem e sala são obrigatórios" }, { status: 400 });
    }
    if (items.length > MAX_SESSION_ITEMS_PER_SIDE) {
      return NextResponse.json({ error: `Máximo de ${MAX_SESSION_ITEMS_PER_SIDE} itens por lado` }, { status: 400 });
    }

    const session = await jsonDb.getMarketRecById(sessionId);
    if (!session || session.kind !== "tradeSession") {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "Esta sala não está mais ativa" }, { status: 400 });
    }

    const isA = session.playerAId === characterId;
    if (!isA && session.playerBId !== characterId) {
      return NextResponse.json({ error: "Você não participa desta sala" }, { status: 400 });
    }

    const resolved: Array<{ inventoryItemId: string; templateId: number; quantity: number }> = [];
    for (const o of items) {
      const invId = o?.inventoryItemId as string;
      const qty = Math.max(1, Math.floor(Number(o?.quantity) || 1));
      if (!invId) continue;
      const entry = await jsonDb.getInventoryItemById(invId);
      if (!entry?.item || entry.item.characterId !== characterId) {
        return NextResponse.json({ error: "Um dos itens não é seu" }, { status: 400 });
      }
      if (entry.item.equipped) {
        return NextResponse.json({ error: "Desequipe os itens antes de oferecer" }, { status: 400 });
      }
      if (entry.item.listed || entry.item.reservedFor) {
        return NextResponse.json({ error: "Um dos itens está em uso no mercado" }, { status: 400 });
      }
      if (entry.stackable && qty > (entry.quantity || 1)) {
        return NextResponse.json({ error: "Quantidade maior do que você possui" }, { status: 400 });
      }
      resolved.push({ inventoryItemId: invId, templateId: Number(entry.item.templateId) || 0, quantity: qty });
    }

    const patch: Record<string, unknown> = isA ? { aOffers: resolved, aConfirmed: false } : { bOffers: resolved, bConfirmed: false };
    const updated = await jsonDb.updateMarketRec(sessionId, patch);

    return NextResponse.json({ success: true, session: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
