import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import {
  TRADE_AD_MIN_LEVEL,
  MAX_TRADE_ADS_PER_CHAR,
  MAX_TRADE_ADS_GLOBAL,
  MAX_CHAT_MESSAGES,
  TRADE_AD_TTL_HOURS,
} from "@/game/tradeAds";
import { requireCharacterAuth } from "@/game/auth";

/** Lista os anúncios de troca ativos (mais recentes primeiro). */
export async function GET() {
  try {
    const ads = await jsonDb.listTradeAds();
    return NextResponse.json({ ads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Cria um anúncio de troca:
 *   { characterId, title, offeredItems: [{ inventoryItemId, templateId, quantity }],
 *     want, price }
 *  - title: título livre do anúncio (o que você quer / a oferta);
 *  - offeredItems: itens que você está oferecendo (NÃO são reservados, só mostrados);
 *  - want: descrição livre do que você quer em troca;
 *  - price (opcional): pedido em ouro/diamantes além dos itens.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const title = String(body?.title || "").trim().slice(0, 60);
    const want = String(body?.want || "").trim().slice(0, 120);
    const offeredItems = Array.isArray(body?.offeredItems) ? body.offeredItems : [];

    if (!characterId) {
      return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });
    }
    // Só o dono pode criar anúncios de troca com itens do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    if (title.length < 3) {
      return NextResponse.json({ error: "Dê um título ao anúncio (mín. 3 letras)" }, { status: 400 });
    }
    if (offeredItems.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos um item para oferecer" }, { status: 400 });
    }
    if (offeredItems.length > 8) {
      return NextResponse.json({ error: "Máximo de 8 itens por anúncio" }, { status: 400 });
    }

    const char = auth.char;
    if ((Number(char.level) || 0) < TRADE_AD_MIN_LEVEL) {
      return NextResponse.json({ error: `Nível mínimo para criar anúncios: ${TRADE_AD_MIN_LEVEL}` }, { status: 400 });
    }

    // Limites
    const mine = await jsonDb.getTradeAdsByCharacter(characterId);
    if (mine.length >= MAX_TRADE_ADS_PER_CHAR) {
      return NextResponse.json({ error: `Máximo de ${MAX_TRADE_ADS_PER_CHAR} anúncios ativos` }, { status: 400 });
    }
    const all = await jsonDb.listTradeAds();
    if (all.length >= MAX_TRADE_ADS_GLOBAL) {
      return NextResponse.json({ error: "Muitos anúncios no servidor! Espere alguns expirarem." }, { status: 400 });
    }

    // Valida os itens anunciados (dono, não equipado, não listado/reservado)
    const resolved: Array<{ inventoryItemId: string; templateId: number; quantity: number }> = [];
    for (const o of offeredItems) {
      const invId = o?.inventoryItemId as string;
      const qty = Math.max(1, Math.floor(Number(o?.quantity) || 1));
      if (!invId) continue;
      const entry = await jsonDb.getInventoryItemById(invId);
      if (!entry?.item || entry.item.characterId !== characterId) {
        return NextResponse.json({ error: "Um dos itens não é seu" }, { status: 400 });
      }
      if (entry.item.equipped) {
        return NextResponse.json({ error: "Desequipe os itens antes de anunciar" }, { status: 400 });
      }
      if (entry.item.listed || entry.item.reservedFor) {
        return NextResponse.json({ error: "Um dos itens está anunciado no mercado ou em outra troca" }, { status: 400 });
      }
      if (entry.stackable && qty > (entry.quantity || 1)) {
        return NextResponse.json({ error: "Quantidade maior do que você possui" }, { status: 400 });
      }
      resolved.push({ inventoryItemId: invId, templateId: Number(entry.item.templateId) || 0, quantity: qty });
    }
    if (resolved.length === 0) {
      return NextResponse.json({ error: "Nenhum item válido selecionado" }, { status: 400 });
    }

    const ad = await jsonDb.insertMarketRec(
      {
        recKind: "tradeAd",
        posterId: characterId,
        posterName: char.name || "Jogador",
        title,
        want,
        offeredItems: resolved,
        price: Math.max(0, Math.floor(Number(body?.price) || 0)),
        chat: [] as any[],
        expiresAt: new Date(Date.now() + TRADE_AD_TTL_HOURS * 3600_000).toISOString(),
      },
      "tradeAd",
      characterId
    );

    return NextResponse.json({
      success: true,
      ad,
      message: `📢 Anúncio criado: "${title}"!`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
