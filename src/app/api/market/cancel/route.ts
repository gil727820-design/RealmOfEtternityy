import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import jsonDb, { MARKET_SYSTEM_ID } from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Cancela um anúncio: { characterId, listingId }.
 * O item volta para o inventário do vendedor (a taxa de anúncio não é reembolsada).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const listingId = body?.listingId as string;

    if (!characterId || !listingId) {
      return NextResponse.json({ error: "Personagem e anúncio são obrigatórios" }, { status: 400 });
    }

    // Só o dono pode cancelar o próprio anúncio.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const listing = await jsonDb.getMarketRecById(listingId);
    if (!listing || listing.kind !== "listing") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (listing.status !== "active") {
      return NextResponse.json({ error: "Este anúncio já foi finalizado" }, { status: 400 });
    }
    if (listing.sellerId !== characterId) {
      return NextResponse.json({ error: "Você não é o dono deste anúncio" }, { status: 400 });
    }

    // Devolve a skin ao vendedor
    if (listing.listingType === "skin") {
      await jsonDb.addCharacterSkins(characterId, [String(listing.skinId || "")]);
    } else {
      // Devolve o item ao vendedor
      const listed = await jsonDb.getInventoryItemById(listing.inventoryItemId);
      if (listed?.item) {
        const qty = Number(listing.quantity) || 1;
        if (listed.stackable) {
          await jsonDb.insertInventoryItem({
            id: uuidv4(),
            characterId,
            templateId: listed.item.templateId,
            equipped: false,
            quantity: qty,
            obtainedAt: new Date().toISOString(),
          });
          await jsonDb.removeInventoryItem(listed.item.id);
        } else {
          await jsonDb.updateInventoryItem(listed.item.id, {
            characterId,
            listed: false,
          });
        }
      }
    }

    await jsonDb.updateMarketRec(listingId, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: listing.listingType === "skin" ? "🎨 Anúncio cancelado — skin devolvida." : "📦 Anúncio cancelado — item devolvido ao inventário.",
      character: await jsonDb.findCharacterById(characterId),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
