import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/game/auth";

/** POST /api/auth/logout — remove o cookie de sessão do jogador. */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
