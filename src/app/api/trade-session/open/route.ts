import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Abre uma sala de troca a partir de um anúncio: { characterId, adId, targetId? }.
 *  - o DONO pode abrir com qualquer jogador que tenha conversado no anúncio (targetId);
 *  - o INTERESSADO abre com o dono (precisa ter falado no chat).
 * A sala é 1x1: playerA = dono, playerB = interessado.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const adId = body?.adId as string;
    const targetId = body?.targetId as string | undefined;

    if (!characterId || !adId) {
      return NextResponse.json({ error: "Personagem e anúncio são obrigatórios" }, { status: 400 });
    }

    // Só o dono do personagem pode abrir sala de troca com ele.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const ad = await jsonDb.getMarketRecById(adId);
    if (!ad || ad.kind !== "tradeAd") {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }
    if (ad.status !== "active") {
      return NextResponse.json({ error: "Este anúncio não está mais ativo" }, { status: 400 });
    }

    const isPoster = ad.posterId === characterId;

    // Quem é o outro lado da sala?
    let playerB: string;
    if (isPoster) {
      // O dono escolhe com quem abrir (precisa ter conversado no chat)
      if (!targetId) {
        return NextResponse.json({ error: "Escolha com qual jogador iniciar o trade" }, { status: 400 });
      }
      const byPlayer = ad.chatByPlayer && typeof ad.chatByPlayer === "object" ? ad.chatByPlayer : {};
      const talked = byPlayer[targetId] && Array.isArray(byPlayer[targetId]) && byPlayer[targetId].length > 0;
      if (!talked) {
        return NextResponse.json({ error: "Este jogador não conversou com você" }, { status: 400 });
      }
      playerB = targetId;
    } else {
      // Interessado: precisa ter falado no chat; a sala é com o dono
      const byPlayer = ad.chatByPlayer && typeof ad.chatByPlayer === "object" ? ad.chatByPlayer : {};
      const talked = byPlayer[characterId] && Array.isArray(byPlayer[characterId]) && byPlayer[characterId].length > 0;
      if (!talked) {
        return NextResponse.json({ error: "Fale no chat do anúncio antes de abrir a troca" }, { status: 400 });
      }
      playerB = characterId;
    }

    if (playerB === characterId && !isPoster) {
      // interessado abrindo consigo mesmo? só se for o dono — bloqueado acima
    }
    const playerA = ad.posterId;

    // Impede sala duplicada para o mesmo par neste anúncio
    const already = await jsonDb.getSessionsByCharacter(playerA);
    if (already.some((s: any) => s.record.playerBId === playerB && s.record.adId === adId)) {
      return NextResponse.json({ error: "Já existe uma sala aberta para este par" }, { status: 400 });
    }

    const session = await jsonDb.insertMarketRec(
      {
        recKind: "tradeSession",
        adId,
        playerAId: playerA,
        playerBId: playerB,
        aOffers: [] as any[],
        bOffers: [] as any[],
        aConfirmed: false,
        bConfirmed: false,
        title: ad.title || "Troca",
        chat: [] as any[],
      },
      "tradeSession",
      playerA
    );

    return NextResponse.json({ success: true, session, message: "🔁 Sala de troca aberta!" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
