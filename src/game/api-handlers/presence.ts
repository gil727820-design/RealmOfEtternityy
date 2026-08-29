import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/** Janela (minutos) em que um heartbeat recente conta como "online". */
const ONLINE_WINDOW_MIN = 3;

/**
 * Sistema de presença:
 * - POST { characterId }: heartbeat do jogador (mantém lastActivity atualizado).
 * - GET: contagem de jogadores online na janela.
 */
export async function GET() {
  try {
    const online = await jsonDb.countRecentlyActive(ONLINE_WINDOW_MIN);
    return NextResponse.json({ online, windowMinutes: ONLINE_WINDOW_MIN });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { characterId?: string };
    if (body.characterId) {
      // Só o dono do personagem pode marcar a própria presença.
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      await jsonDb.updateCharacter(String(body.characterId), { lastActivity: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
