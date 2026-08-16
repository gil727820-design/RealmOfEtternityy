import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import jsonDb, { MARKET_SYSTEM_ID } from "@/db/repo";
import {
  MARKET_MIN_LEVEL,
  MAX_LISTINGS_PER_CHAR,
  MAX_LISTINGS_GLOBAL,
  MAX_PRICE_GOLD,
  MAX_PRICE_DIAMONDS,
  listingFee,
  sellUnlock,
} from "@/game/market";
import { requireCharacterAuth } from "@/game/auth";
import { skinById } from "@/game/skins";

/** Lista os anúncios ativos do mercado (mais recentes primeiro) + preços médios. */
export async function GET() {
  try {
    const listings = await jsonDb.listActiveListings();
    // Preço médio por item (ouro) para referência de mercado na UI.
    const raw = await jsonDb.listActiveListings(1000);
    const avg: Record<string, number> = {};
    for (const e of raw) {
      const l = e.listing;
      const key = String(l.templateId);
      if (!avg[key]) {
        const prices = raw
          .filter((x: any) => String(x.listing.templateId) === key && x.listing.currency === "gold")
          .map((x: any) => Math.round(Number(x.listing.price) / Math.max(1, Number(x.listing.quantity) || 1)));
        avg[key] = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      }
    }
    return NextResponse.json({ listings, avgPrices: avg });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Cria um anúncio: { characterId, inventoryItemId, quantity, price, currency }.
 *  - kind: "item" (padrão) | "skin" (skinId no lugar de inventoryItemId);
 *  - currency: "gold" | "diamonds"
 *  - itens equipados não podem ser anunciados;
 *  - consumíveis permitem anunciar parte do stack (quantity);
 *  - cobra uma taxa (5% do preço em ouro, ou 2 diamantes) para evitar spam.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const inventoryItemId = body?.inventoryItemId as string;
    const kind = body?.kind === "skin" ? "skin" : "item";
    const skinId = String(body?.skinId || "");
    const quantity = Math.max(1, Math.floor(Number(body?.quantity) || 1));
    const price = Math.max(1, Math.floor(Number(body?.price) || 0));
    const currency = body?.currency === "diamonds" ? "diamonds" : "gold";

    if (!characterId || (kind === "skin" ? !skinId : !inventoryItemId)) {
      return NextResponse.json({ error: "Personagem e item são obrigatórios" }, { status: 400 });
    }
    // Só o dono pode anunciar itens do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    if (price < 1) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
    }
    if (currency === "gold" && price > MAX_PRICE_GOLD) {
      return NextResponse.json({ error: `Preço máximo por item: ${MAX_PRICE_GOLD.toLocaleString("pt-BR")} de ouro` }, { status: 400 });
    }
    if (currency === "diamonds" && price > MAX_PRICE_DIAMONDS) {
      return NextResponse.json({ error: `Preço máximo por item: ${MAX_PRICE_DIAMONDS.toLocaleString("pt-BR")} diamantes` }, { status: 400 });
    }

    const char = auth.char;
    // Vender (anunciar) exige nível mínimo + andar da torre ("feito" para liberar).
    const unlock = sellUnlock(char);
    if (!unlock.unlocked) {
      return NextResponse.json(
        { error: unlock.missing || `Nível mínimo para usar o mercado: ${MARKET_MIN_LEVEL}` },
        { status: 400 }
      );
    }

    // Limites de anúncios
    const mine = await jsonDb.getListingsByCharacter(characterId);
    const activeMine = mine.filter((l: any) => l.status === "active").length;
    if (activeMine >= MAX_LISTINGS_PER_CHAR) {
      return NextResponse.json({ error: `Máximo de ${MAX_LISTINGS_PER_CHAR} anúncios ativos por personagem` }, { status: 400 });
    }
    const global = (await jsonDb.listActiveListings()).length;
    if (global >= MAX_LISTINGS_GLOBAL) {
      return NextResponse.json({ error: "Mercado cheio! Tente mais tarde." }, { status: 400 });
    }

    // ----- Skins: anunciar uma skin que o personagem possui -----
    if (kind === "skin") {
      const template = skinById(skinId);
      if (!template) return NextResponse.json({ error: "Skin não encontrada" }, { status: 404 });
      const ownedSkins: string[] = Array.isArray(char.skins) ? (char.skins as string[]) : [];
      if (!ownedSkins.includes(skinId)) {
        return NextResponse.json({ error: "Você não possui esta skin" }, { status: 400 });
      }

      const fee = listingFee(price, currency);
      if (currency === "diamonds") {
        if ((Number(char.diamonds) || 0) < fee) {
          return NextResponse.json({ error: `Taxa de anúncio: ${fee} 💎` }, { status: 400 });
        }
        await jsonDb.updateCharacter(characterId, { diamonds: (Number(char.diamonds) || 0) - fee });
      } else {
        if ((Number(char.gold) || 0) < fee) {
          return NextResponse.json({ error: `Taxa de anúncio: ${fee} 🪙` }, { status: 400 });
        }
        await jsonDb.updateCharacter(characterId, { gold: (Number(char.gold) || 0) - fee });
      }

      // Remove a skin do vendedor enquanto estiver listada
      const nextSkins = ownedSkins.filter((s: string) => s !== skinId);
      await jsonDb.updateCharacter(characterId, { skins: nextSkins });

      const listing = await jsonDb.insertMarketRec(
        {
          sellerId: characterId,
          sellerName: char.name || "Jogador",
          listingType: "skin",
          skinId,
          quantity: 1,
          price,
          currency,
          fee,
        },
        "listing",
        characterId
      );

      jsonDb.addAdminLog("economy", {
        source: "market",
        event: "listing",
        characterId,
        charName: char.name || "Jogador",
        listingType: "skin",
        skinId,
        price,
        currency,
        fee,
      });

      return NextResponse.json({
        success: true,
        listing,
        message: `🎨 Anunciado: ${price.toLocaleString("pt-BR")} ${currency === "diamonds" ? "💎" : "🪙"}`,
      });
    }

    const entry = await jsonDb.getInventoryItemById(inventoryItemId);
    if (!entry?.item) return NextResponse.json({ error: "Item não encontrado no inventário" }, { status: 404 });
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Este item não pertence ao seu personagem" }, { status: 400 });
    }
    if (entry.item.equipped) {
      return NextResponse.json({ error: "Desequipe o item antes de anunciar" }, { status: 400 });
    }
    if (entry.item.listed) {
      return NextResponse.json({ error: "Este item já está anunciado no mercado" }, { status: 400 });
    }
    const stackable = !!entry.stackable;
    const maxQty = entry.quantity || 1;
    if (quantity > maxQty) {
      return NextResponse.json({ error: `Você só tem ×${maxQty} deste item` }, { status: 400 });
    }

    // Taxa de anúncio
    const fee = listingFee(price, currency);
    if (currency === "diamonds") {
      if ((Number(char.diamonds) || 0) < fee) {
        return NextResponse.json({ error: `Taxa de anúncio: ${fee} 💎` }, { status: 400 });
      }
      await jsonDb.updateCharacter(characterId, { diamonds: (Number(char.diamonds) || 0) - fee });
    } else {
      if ((Number(char.gold) || 0) < fee) {
        return NextResponse.json({ error: `Taxa de anúncio: ${fee} 🪙` }, { status: 400 });
      }
      await jsonDb.updateCharacter(characterId, { gold: (Number(char.gold) || 0) - fee });
    }

    // Guarda o item: consumível vira uma linha separada no "sistema", equipamento muda de dono.
    let listedItemId = inventoryItemId;
    if (stackable) {
      const listedInv = await jsonDb.insertInventoryItem({
        id: uuidv4(),
        characterId: MARKET_SYSTEM_ID,
        templateId: entry.item.templateId,
        equipped: false,
        quantity,
        listed: true,
        obtainedAt: new Date().toISOString(),
      });
      listedItemId = listedInv.id;
      await jsonDb.decrementInventoryItem(inventoryItemId, quantity);
    } else {
      await jsonDb.updateInventoryItem(inventoryItemId, {
        characterId: MARKET_SYSTEM_ID,
        listed: true,
      });
    }

    const listing = await jsonDb.insertMarketRec(
      {
        sellerId: characterId,
        sellerName: char.name || "Jogador",
        templateId: entry.item.templateId,
        quantity,
        price,
        currency,
        fee,
        inventoryItemId: listedItemId,
      },
      "listing",
      characterId
    );

    // Log de economia para o painel admin (detecção de duplicação/exploit).
    jsonDb.addAdminLog("economy", {
      source: "market",
      event: "listing",
      characterId,
      charName: char.name || "Jogador",
      templateId: entry.item.templateId,
      quantity,
      price,
      currency,
      fee,
    });

    return NextResponse.json({
      success: true,
      listing,
      message: `📦 Anunciado: ${price.toLocaleString("pt-BR")} ${currency === "diamonds" ? "💎" : "🪙"}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
