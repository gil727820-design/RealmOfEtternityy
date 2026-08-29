import { NextRequest, NextResponse } from "next/server";

/**
 * POST — /api/combat
 * GET — /api/combat?action=pvp-history|pvp-ranking|pvp-season|region-audio|world-boss
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");
    const handlers: Record<string, () => Promise<any>> = {
      "tower":           () => import("@/game/api-handlers/tower-fight"),
      "tower-challenge":  () => import("@/game/api-handlers/tower-challenge"),
      "pvp-battle":      () => import("@/game/api-handlers/pvp-battle"),
      "pvp-fight":       () => import("@/game/api-handlers/pvp-fight"),
      "region-farm":     () => import("@/game/api-handlers/region-farm"),
      "region-mini-boss": () => import("@/game/api-handlers/region-mini-boss"),
      "region-boss-fight": () => import("@/game/api-handlers/region-boss-fight"),
      "region-boss":     () => import("@/game/api-handlers/region-boss"),
      "region-audio":    () => import("@/game/api-handlers/region-audio"),
      "region-change":   () => import("@/game/api-handlers/region-change"),
      "world-boss-attack": () => import("@/game/api-handlers/world-boss-attack"),
      "world-boss-enter":  () => import("@/game/api-handlers/world-boss-enter"),
      "world-boss-leave":  () => import("@/game/api-handlers/world-boss-leave"),
      "world-boss-break-shield": () => import("@/game/api-handlers/world-boss-break-shield"),
      "world-boss-invite":  () => import("@/game/api-handlers/world-boss-invite"),
      "world-boss-respond": () => import("@/game/api-handlers/world-boss-respond"),
      "survival-arena":  () => import("@/game/api-handlers/survival-arena"),
      "dungeon-start":   () => import("@/game/api-handlers/dungeon-start"),
      "dungeon-collect": () => import("@/game/api-handlers/dungeon-collect"),
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
      "pvp-history":   () => import("@/game/api-handlers/pvp-history"),
      "pvp-ranking":   () => import("@/game/api-handlers/pvp-ranking"),
      "pvp-season":    () => import("@/game/api-handlers/pvp-season"),
      "region-audio":  () => import("@/game/api-handlers/region-audio"),
      "world-boss":      () => import("@/game/api-handlers/world-boss"),
      "dungeon-ranking": () => import("@/game/api-handlers/dungeon-ranking"),
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
