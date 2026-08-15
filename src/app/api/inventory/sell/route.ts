import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemId = body.inventoryItemId ?? body.itemId;
    const characterId = body.characterId;
    // Quantidade a vender (padrão: 1 unidade; use "all" para vender o stack inteiro)
    let quantity = body.quantity ?? 1;
    if (!itemId || !characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode vender itens do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const entry = await jsonDb.getInventoryItemById(itemId);
    if (!entry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }
    if (entry.item.equipped) {
      return NextResponse.json({ error: "Desequipe o item antes de vender." }, { status: 400 });
    }
    if (entry.item.listed) {
      return NextResponse.json({ error: "Cancele o anúncio no mercado antes de vender." }, { status: 400 });
    }
    if (entry.item.reservedFor) {
      return NextResponse.json({ error: "Este item está reservado em uma troca pendente." }, { status: 400 });
    }

    const stock = entry.quantity || 1;
    if (quantity === "all" || quantity === "max") quantity = stock;
    quantity = Math.max(1, Math.floor(Number(quantity) || 1));

    if (quantity > stock) {
      return NextResponse.json({ error: "Quantidade maior que o disponível." }, { status: 400 });
    }

    const price = Math.max(0, entry.template?.sellPrice || 0) * quantity;
    await jsonDb.decrementInventoryItem(itemId, quantity);

    const newGold = (char.gold || 0) + price;
    const updated = await jsonDb.updateCharacter(characterId, { gold: newGold });

    return NextResponse.json({
      success: true,
      sold: quantity,
      goldEarned: price,
      gold: newGold,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}