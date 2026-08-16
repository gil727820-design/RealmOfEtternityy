import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { pendingEvent, resolveRandomEvent } from "@/game/randomEvents";

/** GET — evento pendente do personagem (se houver e não expirou). */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const pending = pendingEvent(auth.char);
    return NextResponse.json({
      event: pending ? { ...pending.event, createdAt: pending.state.createdAt } : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — aceitar (resolve) ou ignorar (descarta) o evento. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, action } = await req.json();
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Ignorar: só limpa o evento pendente.
    if (action === "ignore") {
      const updated = await jsonDb.updateCharacter(char.id, { pendingEvent: null });
      return NextResponse.json({ success: true, ignored: true, character: updated });
    }

    if (action !== "accept") {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const res = resolveRandomEvent(char);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const updated = await jsonDb.updateCharacter(char.id, res.patch);
    return NextResponse.json({
      success: true,
      reward: res.reward,
      failed: res.failed ?? false,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Random event error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
