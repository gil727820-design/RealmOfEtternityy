import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(url.searchParams.get("action") || body?.action || "");
    const handlers: Record<string, () => Promise<any>> = {
      "ghost-shop":    () => import("@/game/api-handlers/ghost-shop"),
      "ghost-buy":     () => import("@/game/api-handlers/ghost-shop-buy"),
      "skin-shop":     () => import("@/game/api-handlers/skin-shop"),
      "market":        () => import("@/game/api-handlers/market"),
      "market-buy":    () => import("@/game/api-handlers/market-buy"),
      "market-cancel": () => import("@/game/api-handlers/market-cancel"),
      "shop-buy":      () => import("@/game/api-handlers/shop-buy"),
      "pix-purchase":  () => import("@/game/api-handlers/pix-purchase"),
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
      "ghost-shop": () => import("@/game/api-handlers/ghost-shop"),
      "skin-shop":  () => import("@/game/api-handlers/skin-shop"),
      "market":     () => import("@/game/api-handlers/market"),
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
