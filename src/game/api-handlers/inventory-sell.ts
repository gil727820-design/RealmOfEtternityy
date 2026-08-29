import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body.characterId;
    if (!characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode vender itens do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Venda em LOTE: body.items = [{ inventoryItemId, quantity }]
    const bulk = Array.isArray(body.items) ? body.items : null;
    const requests = bulk
      ? bulk.map((it: any) => ({
          id: it?.inventoryItemId ?? it?.itemId,
          quantity: it?.quantity,
        }))
      : [{ id: body.inventoryItemId ?? body.itemId, quantity: body.quantity ?? 1 }];

    if (requests.some((r: any) => !r.id)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    let totalGold = 0;
    const itemsSold: Array<{ id: string; quantity: number; gold: number }> = [];

    for (const r of requests) {
      const entry = await jsonDb.getInventoryItemById(r.id);
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
      let quantity = r.quantity;
      // "all"/"max"/vazio → vende o stack inteiro (padrão na venda em lote)
      if (quantity === "all" || quantity === "max" || quantity == null) quantity = stock;
      quantity = Math.max(1, Math.floor(Number(quantity) || 1));

      if (quantity > stock) {
        return NextResponse.json({ error: "Quantidade maior que o disponível." }, { status: 400 });
      }

      const price = Math.max(0, entry.template?.sellPrice || 0) * quantity;
      await jsonDb.decrementInventoryItem(r.id, quantity);
      totalGold += price;
      itemsSold.push({ id: r.id, quantity, gold: price });
    }

    const newGold = (char.gold || 0) + totalGold;
    const updated = await jsonDb.updateCharacter(characterId, { gold: newGold });

    return NextResponse.json({
      success: true,
      bulk: !!bulk,
      sold: itemsSold.length,
      itemsSold,
      goldEarned: totalGold,
      gold: newGold,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
