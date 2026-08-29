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
    const aGold = Math.max(0, Math.floor(Number(after.aGold) || 0));
    const aDiamonds = Math.max(0, Math.floor(Number(after.aDiamonds) || 0));
    const bGold = Math.max(0, Math.floor(Number(after.bGold) || 0));
    const bDiamonds = Math.max(0, Math.floor(Number(after.bDiamonds) || 0));

    // Troca unilateral é permitida: basta UM lado oferecer algo (itens ou
    // moedas). O outro pode confirmar sem enviar nada (presente).
    const aHas = aOffers.length > 0 || aGold > 0 || aDiamonds > 0;
    const bHas = bOffers.length > 0 || bGold > 0 || bDiamonds > 0;
    if (!aHas && !bHas) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "Nenhum dos lados ofereceu itens ou moedas." }, { status: 400 });
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

    // Valida o saldo de moedas dos DOIS lados (leitura fresca) antes de mover
    // qualquer coisa — evita oferecer ouro/diamantes que já não existem mais.
    const charA = await jsonDb.findCharacterById(session.playerAId);
    const charB = await jsonDb.findCharacterById(session.playerBId);
    if (aGold > 0 && (!charA || (Number(charA.gold) || 0) < aGold)) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "Seu ouro mudou desde a seleção. Revise e confirme de novo." }, { status: 400 });
    }
    if (aDiamonds > 0 && (!charA || (Number(charA.diamonds) || 0) < aDiamonds)) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "Seus diamantes mudaram desde a seleção. Revise e confirme de novo." }, { status: 400 });
    }
    if (bGold > 0 && (!charB || (Number(charB.gold) || 0) < bGold)) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "O ouro do outro jogador mudou desde a seleção." }, { status: 400 });
    }
    if (bDiamonds > 0 && (!charB || (Number(charB.diamonds) || 0) < bDiamonds)) {
      await jsonDb.updateMarketRec(sessionId, { aConfirmed: false, bConfirmed: false });
      return NextResponse.json({ error: "Os diamantes do outro jogador mudaram desde a seleção." }, { status: 400 });
    }

    // Move os itens dos dois lados
    for (const o of aOffers) {
      await moveItem(o.inventoryItemId, session.playerAId, session.playerBId, o.quantity || 1);
    }
    for (const o of bOffers) {
      await moveItem(o.inventoryItemId, session.playerBId, session.playerAId, o.quantity || 1);
    }

    // Transfere ouro/diamantes (quem ofereceu paga; quem recebeu ganha)
    if (aGold > 0 || bGold > 0) {
      const newA = (Number(charA?.gold) || 0) - aGold + bGold;
      const newB = (Number(charB?.gold) || 0) - bGold + aGold;
      await jsonDb.updateCharacter(session.playerAId, { gold: Math.max(0, newA) });
      await jsonDb.updateCharacter(session.playerBId, { gold: Math.max(0, newB) });
    }
    if (aDiamonds > 0 || bDiamonds > 0) {
      const newA = (Number(charA?.diamonds) || 0) - aDiamonds + bDiamonds;
      const newB = (Number(charB?.diamonds) || 0) - bDiamonds + aDiamonds;
      await jsonDb.updateCharacter(session.playerAId, { diamonds: Math.max(0, newA) });
      await jsonDb.updateCharacter(session.playerBId, { diamonds: Math.max(0, newB) });
    }

    await jsonDb.updateMarketRec(sessionId, { status: "completed", completedAt: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      completed: true,
      message: "🎉 TROCA CONCLUÍDA! Os itens e moedas foram trocados.",
      character: await jsonDb.findCharacterById(characterId),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
