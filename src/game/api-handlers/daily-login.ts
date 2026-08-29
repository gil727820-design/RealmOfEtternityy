import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { dailyLoginStatus, applyDailyClaim } from "@/game/dailyLogin";
import { seasonPatch } from "@/game/season";

/** GET — status do login diário do personagem (para a UI). */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    return NextResponse.json({ status: dailyLoginStatus(auth.char) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — resgata a recompensa do dia (1x por dia, validado no servidor). */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const status = dailyLoginStatus(char);
    if (!status.canClaim) {
      return NextResponse.json({ error: "Recompensa de hoje já foi resgatada" }, { status: 400 });
    }

    const { patch, reward, newStreak } = applyDailyClaim(char);
    const updated = await jsonDb.updateCharacter(char.id, {
      ...patch,
      // Temporada global: login diário dá pontos de temporada.
      ...seasonPatch(char, "daily"),
    });

    return NextResponse.json({
      success: true,
      reward,
      newStreak,
      status: dailyLoginStatus(updated ?? char),
      character: updated ?? char,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Daily login error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
