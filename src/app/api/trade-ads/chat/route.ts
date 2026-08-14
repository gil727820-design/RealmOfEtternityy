import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { MAX_CHAT_MESSAGES } from "@/game/tradeAds";

/**
 * Chat PRIVADO do anúncio de troca.
 *
 * Cada par (dono do anúncio + um interessado) tem a PRÓPRIA conversa — o
 * jogador A não vê as mensagens do jogador B. As mensagens ficam em
 * `ad.chatByPlayer = { [idDoOutro]: [mensagens...] }`:
 *  - para o DONO: a chave é o id do interessado;
 *  - para o INTERESSADO: a chave é o id do dono.
 *
 * Estrutura da mensagem: { senderId, senderName, text, at }.
 */

/** Retorna o id do "outro lado" da conversa (o dono do anúncio). */
function peerId(ad: any, characterId: string): string | null {
  if (ad.posterId === characterId) return characterId; // dono vendo o anúncio dele
  return ad.posterId; // interessado → conversa com o dono
}

/** Traz o anúncio + APENAS a conversa entre o personagem e o dono. */
export async function GET(req: NextRequest) {
  try {
    const adId = req.nextUrl.searchParams.get("adId") as string;
    const characterId = req.nextUrl.searchParams.get("characterId") as string;
    if (!adId) return NextResponse.json({ error: "Anúncio é obrigatório" }, { status: 400 });

    const ad = await jsonDb.getMarketRecById(adId);
    if (!ad || ad.kind !== "tradeAd") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (ad.status !== "active") {
      return NextResponse.json({ error: "Este anúncio foi finalizado" }, { status: 400 });
    }

    const expanded = await jsonDb.getMarketRecExpanded(adId);

    // Conversa do personagem (quem vê) com o dono do anúncio.
    let chat: any[] = [];
    if (characterId && ad.chatByPlayer) {
      if (ad.posterId === characterId) {
        // Dono vendo: mostra TODAS as conversas dos interessados (cada uma no seu card)
        chat = [];
      } else {
        chat = Array.isArray(ad.chatByPlayer[characterId]) ? ad.chatByPlayer[characterId] : [];
      }
    }

    return NextResponse.json({
      ad: expanded?.record ?? ad,
      poster: expanded?.poster ?? null,
      offeredItems: expanded?.offeredItems ?? [],
      chat, // conversa do personagem com o dono (ou vazia para o dono)
      myId: characterId,
      isPoster: characterId === ad.posterId,
      // Para o dono: o mapa completo de conversas, cada uma no próprio card.
      chatByPlayer: ad.posterId === characterId ? (ad.chatByPlayer || {}) : undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Envia mensagem: { characterId, adId, text }. Sempre vai para a conversa do par. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const adId = body?.adId as string;
    const text = String(body?.text || "").trim().slice(0, 200);

    if (!characterId || !adId) {
      return NextResponse.json({ error: "Personagem e anúncio são obrigatórios" }, { status: 400 });
    }
    if (text.length < 1) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const ad = await jsonDb.getMarketRecById(adId);
    if (!ad || ad.kind !== "tradeAd") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (ad.status !== "active") {
      return NextResponse.json({ error: "Este anúncio foi finalizado" }, { status: 400 });
    }

    // Qual é a chave da conversa? O "outro lado" é sempre o DONO do anúncio.
    // - interessado → conversa com a chave = characterId (id do interessado);
    // - dono respondendo → precisa saber PARA QUEM está respondendo.
    const toId = body?.toId as string | undefined;
    const threadKey = ad.posterId === characterId ? (toId || characterId) : characterId;

    const byPlayer: Record<string, any[]> =
      ad.chatByPlayer && typeof ad.chatByPlayer === "object" ? ad.chatByPlayer : {};

    const msgs = Array.isArray(byPlayer[threadKey]) ? byPlayer[threadKey] : [];
    msgs.push({
      senderId: characterId,
      senderName: char.name || "Jogador",
      text,
      at: new Date().toISOString(),
    });
    byPlayer[threadKey] = msgs.slice(-MAX_CHAT_MESSAGES);

    await jsonDb.updateMarketRec(adId, { chatByPlayer: byPlayer });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
