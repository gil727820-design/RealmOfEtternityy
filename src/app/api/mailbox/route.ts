import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

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

    // Só o dono pode ver o correio do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

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

      // Só o dono pode resgatar o correio do próprio personagem.
      const mailRec = await jsonDb.getMailById(String(id));
      if (!mailRec) return NextResponse.json({ error: "Correio não encontrado" }, { status: 404 });
      const auth = await requireCharacterAuth(req, mailRec.characterId);
      if (!auth.ok) return auth.response;

      const mail = await jsonDb.claimMail(String(id));
      if (!mail) return NextResponse.json({ error: "Correio inválido ou já resgatado" }, { status: 404 });
      return NextResponse.json({ success: true, claimed: mail });
    }

    if (action === "claim_all") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      // Só o dono pode resgatar tudo do próprio personagem.
      const auth = await requireCharacterAuth(req, String(characterId));
      if (!auth.ok) return auth.response;

      const count = await jsonDb.claimAllMails(String(characterId));
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}