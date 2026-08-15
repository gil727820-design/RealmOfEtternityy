import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

async function validateItem(inventoryItemId: string, ownerId: string, qty: number): Promise<{ ok: boolean; reason?: string; stackable?: boolean }> {
  const entry = await jsonDb.getInventoryItemById(inventoryItemId);
  if (!entry?.item) return { ok: false, reason: "Item não encontrado" };
  if (entry.item.characterId !== ownerId) return { ok: false, reason: "Item não é mais seu" };
  if (entry.item.equipped) return { ok: false, reason: "Item equipado" };
  if (entry.item.listed || entry.item.reservedFor) return { ok: false, reason: "Item em uso no mercado" };
  if (entry.stackable && qty > (entry.quantity || 1)) return { ok: false, reason: "Quantidade insuficiente" };
  return { ok: true, stackable: entry.stackable };
}

async function moveItem(inventoryItemId: string, fromId: string, toId: string, qty: number) {
  const entry = await jsonDb.getInventoryItemById(inventoryItemId);
  if (!entry?.item) return false;
  if (entry.stackable) {
    await jsonDb.insertInventoryItem({
      id: uuidv4(),
      characterId: toId,
      templateId: entry.item.templateId,
      equipped: false,
      quantity: qty,
      obtainedAt: new Date().toISOString(),
    });
    await jsonDb.decrementInventoryItem(inventoryItemId, qty);
  } else {
    await jsonDb.updateInventoryItem(inventoryItemId, { characterId: toId });
  }
  return true;
}

/** Confirma o seu lado. A troca só executa quando AMBOS confirmaram (atômica). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const sessionId = body?.sessionId as string;

    if (!characterId || !sessionId) {
      return NextResponse.json({ error: "Personagem e sala são obrigatórios" }, { status: 400 });
    }

    // Só o dono pode confirmar o lado do próprio personagem na troca.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

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
    if (isA ? session.aConfirmed : session.bConfirmed) {
      return NextResponse.json({ error: "Você já confirmou este lado" }, { status: 400 });
    }

    const patch: Record<string, unknown> = isA ? { aConfirmed: true } : { bConfirmed: true };
    await jsonDb.updateMarketRec(sessionId, patch);

    const after = await jsonDb.getMarketRecById(sessionId);
    const bothConfirmed = !!(after?.aConfirmed && after?.bConfirmed);

    if (!bothConfirmed) {
      return NextResponse.json({ success: true, waiting: true, message: "✅ Lado confirmado! Aguardando o outro jogador confirmar..." });
    }

    // ---- TROCA ATÔMICA ----
    const aOffers = Array.isArray(after.aOffers) ? after.aOffers : [];
    const bOffers = Array.isArray(after.bOffers) ? after.bOffers : [];
    if (aOffers.length === 0 || bOffers.length === 0) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "Os dois lados precisam oferecer itens. Confirme novamente." }, { status: 400 });
    }

    for (const o of aOffers) {
      const v = await validateItem(o.inventoryItemId, session.playerAId, o.quantity || 1);
      if (!v.ok) {
        await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
        return NextResponse.json({ error: `Seus itens mudaram (${v.reason}). Revise e confirme de novo.` }, { status: 400 });
      }
    }
    for (const o of bOffers) {
      const v = await validateItem(o.inventoryItemId, session.playerBId, o.quantity || 1);
      if (!v.ok) {
        await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
        return NextResponse.json({ error: `Os itens do outro jogador mudaram (${v.reason}). Peça para ele rever.` }, { status: 400 });
      }
    }

    for (const o of aOffers) {
      await moveItem(o.inventoryItemId, session.playerAId, session.playerBId, o.quantity || 1);
    }
    for (const o of bOffers) {
      await moveItem(o.inventoryItemId, session.playerBId, session.playerAId, o.quantity || 1);
    }

    await jsonDb.updateMarketRec(sessionId, { status: "completed", completedAt: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      completed: true,
      message: "🎉 TROCA CONCLUÍDA! Os itens foram trocados.",
      character: await jsonDb.findCharacterById(characterId),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
