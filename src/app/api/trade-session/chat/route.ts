import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { MAX_CHAT_MESSAGES } from "@/game/tradeAds";
import { requireCharacterAuth } from "@/game/auth";

/** Estado da sala (para polling): mensagens + ofertas + confirmações. */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId") as string;
    const characterId = req.nextUrl.searchParams.get("characterId") as string;
    if (!sessionId || !characterId) {
      return NextResponse.json({ error: "Sala e personagem são obrigatórios" }, { status: 400 });
    }

    // Só o dono do personagem pode ver as salas em que ele participa.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const session = await jsonDb.getMarketRecById(sessionId);
    if (!session || session.kind !== "tradeSession") {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }

    const otherId = session.playerAId === characterId ? session.playerBId : session.playerAId;
    const other = otherId ? await jsonDb.findCharacterById(otherId) : null;

    const expand = async (items: any[]) =>
      Promise.all(
        (items || []).map(async (it: any) => {
          const template = await jsonDb.getItemTemplateById(Number(it.templateId) || 0);
          return { ...it, template };
        })
      );

    const isA = session.playerAId === characterId;
    return NextResponse.json({
      session,
      status: session.status,
      title: session.title || "Troca",
      otherName: other?.name || "Jogador",
      otherLevel: other?.level || 1,
      myConfirmed: isA ? !!session.aConfirmed : !!session.bConfirmed,
      otherConfirmed: isA ? !!session.bConfirmed : !!session.aConfirmed,
      myOffers: await expand(isA ? session.aOffers : session.bOffers),
      otherOffers: await expand(isA ? session.bOffers : session.aOffers),
      myGold: isA ? Number(session.aGold) || 0 : Number(session.bGold) || 0,
      myDiamonds: isA ? Number(session.aDiamonds) || 0 : Number(session.bDiamonds) || 0,
      otherGold: isA ? Number(session.bGold) || 0 : Number(session.aGold) || 0,
      otherDiamonds: isA ? Number(session.bDiamonds) || 0 : Number(session.aDiamonds) || 0,
      chat: Array.isArray(session.chat) ? session.chat : [],
      completed: session.status === "completed",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Envia mensagem na sala: { characterId, sessionId, text }. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string;
    const sessionId = body?.sessionId as string;
    const text = String(body?.text || "").trim().slice(0, 200);

    if (!characterId || !sessionId) {
      return NextResponse.json({ error: "Personagem e sala são obrigatórios" }, { status: 400 });
    }
    if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

    // Só o dono do personagem pode mandar mensagem como ele.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const session = await jsonDb.getMarketRecById(sessionId);
    if (!session || session.kind !== "tradeSession") {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "Esta sala não está mais ativa" }, { status: 400 });
    }

    const chat = Array.isArray(session.chat) ? session.chat : [];
    chat.push({ senderId: characterId, senderName: char.name || "Jogador", text, at: new Date().toISOString() });
    await jsonDb.updateMarketRec(sessionId, { chat: chat.slice(-MAX_CHAT_MESSAGES) });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
