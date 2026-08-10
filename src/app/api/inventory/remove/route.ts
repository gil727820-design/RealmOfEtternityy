import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemId = body.inventoryItemId ?? body.itemId;
    const characterId = body.characterId;
    // Quantidade a excluir (padrão: 1 unidade; "all" exclui o stack inteiro)
    let quantity = body.quantity ?? 1;
    if (!itemId || !characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const entry = await jsonDb.getInventoryItemById(itemId);
    if (!entry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }
    if (entry.item.equipped) {
      return NextResponse.json({ error: "Desequipe o item antes de remover." }, { status: 400 });
    }

    if (quantity === "all" || quantity === "max") quantity = entry.quantity || 1;
    quantity = Math.max(1, Math.floor(Number(quantity) || 1));
    if (quantity > (entry.quantity || 1)) {
      return NextResponse.json({ error: "Quantidade maior que o disponível." }, { status: 400 });
    }

    await jsonDb.decrementInventoryItem(itemId, quantity);

    return NextResponse.json({ success: true, removed: quantity });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}