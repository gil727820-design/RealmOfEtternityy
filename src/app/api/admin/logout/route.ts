import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie } from "@/game/auth";

/** POST /api/admin/logout — remove o cookie de sessão do admin. */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}
