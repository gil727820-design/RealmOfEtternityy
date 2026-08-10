import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

/**
 * Caixa de correio do personagem.
 *
 * GET  /api/mailbox?characterId=<id>   → lista o correio (com template do item)
 * POST /api/mailbox                    → { action: "claim", id } ou { action: "claim_all", characterId }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID necessário" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const mails = await jsonDb.getMailsForCharacter(characterId);
    const pending = await jsonDb.countUnclaimedMails(characterId);
    return NextResponse.json({ mails, pending });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "claim") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const mail = await jsonDb.claimMail(String(id));
      if (!mail) return NextResponse.json({ error: "Correio inválido ou já resgatado" }, { status: 404 });
      return NextResponse.json({ success: true, claimed: mail });
    }

    if (action === "claim_all") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const count = await jsonDb.claimAllMails(String(characterId));
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}