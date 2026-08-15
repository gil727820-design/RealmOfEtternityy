import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import jsonDb, { MARKET_SYSTEM_ID } from "@/db/repo";
import { MARKET_MIN_LEVEL } from "@/game/market";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Compra um anúncio: { characterId, listingId }.
 *  - o comprador paga o preço em ouro/diamantes;
 *  - o item sai do "sistema" para o inventário do comprador;
 *  - o vendedor recebe o preço (a taxa já foi paga no anúncio).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const listingId = body?.listingId as string;

    if (!characterId || !listingId) {
      return NextResponse.json({ error: "Personagem e anúncio são obrigatórios" }, { status: 400 });
    }

    // Só o dono pode comprar com o ouro/diamantes do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const buyer = auth.char;
    if ((Number(buyer.level) || 0) < MARKET_MIN_LEVEL) {
      return NextResponse.json({ error: `Nível mínimo para usar o mercado: ${MARKET_MIN_LEVEL}` }, { status: 400 });
    }

    const listing = await jsonDb.getMarketRecById(listingId);
    if (!listing || listing.kind !== "listing") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (listing.status !== "active") {
      return NextResponse.json({ error: "Este anúncio não está mais disponível" }, { status: 400 });
    }
    if (listing.sellerId === characterId) {
      return NextResponse.json({ error: "Você não pode comprar o próprio anúncio" }, { status: 400 });
    }

    const price = Number(listing.price) || 0;
    const currency = listing.currency === "diamonds" ? "diamonds" : "gold";
    if (currency === "gold" && (Number(buyer.gold) || 0) < price) {
      return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
    }
    if (currency === "diamonds" && (Number(buyer.diamonds) || 0) < price) {
      return NextResponse.json({ error: "Diamantes insuficientes" }, { status: 400 });
    }

    // Item guardado no "sistema" enquanto listado
    const listed = await jsonDb.getInventoryItemById(listing.inventoryItemId);
    if (!listed?.item) {
      return NextResponse.json({ error: "O item deste anúncio não está mais disponível" }, { status: 400 });
    }
    const listedItem = listed.item;
    const qty = Number(listing.quantity) || 1;

    // Transfere para o comprador
    if (listedItem.characterId !== MARKET_SYSTEM_ID) {
      // Item ainda estava com o vendedor (caso raro) — valida dono
      if (listedItem.characterId !== listing.sellerId) {
        return NextResponse.json({ error: "Item deste anúncio indisponível" }, { status: 400 });
      }
    }
    if (listed.stackable) {
      await jsonDb.insertInventoryItem({
        id: uuidv4(),
        characterId,
        templateId: listedItem.templateId,
        equipped: false,
        quantity: qty,
        obtainedAt: new Date().toISOString(),
      });
      await jsonDb.removeInventoryItem(listedItem.id);
    } else {
      await jsonDb.updateInventoryItem(listedItem.id, {
        characterId,
        listed: false,
      });
    }

    // Cobra o comprador e paga o vendedor
    const seller = await jsonDb.findCharacterById(listing.sellerId);
    if (currency === "gold") {
      await jsonDb.updateCharacter(characterId, { gold: (Number(buyer.gold) || 0) - price });
      if (seller) {
        await jsonDb.updateCharacter(seller.id, { gold: (Number(seller.gold) || 0) + price });
      }
    } else {
      await jsonDb.updateCharacter(characterId, { diamonds: (Number(buyer.diamonds) || 0) - price });
      if (seller) {
        await jsonDb.updateCharacter(seller.id, { diamonds: (Number(seller.diamonds) || 0) + price });
      }
    }

    await jsonDb.updateMarketRec(listingId, {
      status: "sold",
      buyerId: characterId,
      buyerName: buyer.name || "Jogador",
      soldAt: new Date().toISOString(),
    });

    const fresh = await jsonDb.findCharacterById(characterId);

    // Log de economia (compra realizada) para o painel admin.
    jsonDb.addAdminLog("economy", {
      source: "market",
      event: "buy",
      characterId,
      charName: buyer.name || "Jogador",
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || "Jogador",
      templateId: listedItem.templateId,
      quantity: qty,
      price,
      currency,
    });

    return NextResponse.json({
      success: true,
      message: `✅ Comprado por ${price.toLocaleString("pt-BR")} ${currency === "diamonds" ? "💎" : "🪙"}`,
      character: fresh,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
