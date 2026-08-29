import { NextRequest, NextResponse } from "next/server";

/**
 * POST — /api/missions
 * GET — /api/missions?action=daily|daily-events|daily-login|questlines
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");
    const handlers: Record<string, () => Promise<any>> = {
      "daily":        () => import("@/game/api-handlers/missions-daily"),
      "claim":        () => import("@/game/api-handlers/missions-claim"),
      "start":        () => import("@/game/api-handlers/missions-start"),
      "daily-events": () => import("@/game/api-handlers/daily-events"),
      "daily-login":  () => import("@/game/api-handlers/daily-login"),
      "questlines":   () => import("@/game/api-handlers/questlines"),
    };
    if (!handlers[action]) {
      return NextResponse.json({ error: `Action inválida. Disponíveis: ${Object.keys(handlers).join(", ")}` }, { status: 400 });
    }
    const mod = await handlers[action]();
    return (mod.POST || mod.GET)(req);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const handlers: Record<string, () => Promise<any>> = {
      "daily":        () => import("@/game/api-handlers/missions-daily"),
      "daily-events": () => import("@/game/api-handlers/daily-events"),
      "daily-login":  () => import("@/game/api-handlers/daily-login"),
      "questlines":   () => import("@/game/api-handlers/questlines"),
    };
    if (!handlers[action]) {
      return NextResponse.json({ error: "GET action inválida" }, { status: 400 });
    }
    const mod = await handlers[action]();
    return (mod.GET || mod.POST)(req);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
