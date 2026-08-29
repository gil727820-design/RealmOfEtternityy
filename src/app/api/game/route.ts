import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");
    const handlers: Record<string, () => Promise<any>> = {
      "pets":              () => import("@/game/api-handlers/pets"),
      "relics":            () => import("@/game/api-handlers/relics"),
      "codes-redeem":      () => import("@/game/api-handlers/codes-redeem"),
      "afk-start":         () => import("@/game/api-handlers/afk-start"),
      "afk-claim":         () => import("@/game/api-handlers/afk-claim"),
      "world-exploration": () => import("@/game/api-handlers/world-exploration"),
      "random-event":      () => import("@/game/api-handlers/random-event"),
      "presence":          () => import("@/game/api-handlers/presence"),
      "seed":              () => import("@/game/api-handlers/seed"),
      "craft":             () => import("@/game/api-handlers/craft"),
      "server-settings":   () => import("@/game/api-handlers/server-settings"),
      "rankings":          () => import("@/game/api-handlers/rankings"),
      "season":            () => import("@/game/api-handlers/season"),
      "health":            () => import("@/game/api-handlers/health"),
      "notifications":     () => import("@/game/api-handlers/notifications-check"),
      "craft-recipes":     () => import("@/game/api-handlers/craft-recipes"),
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
      "server-settings": () => import("@/game/api-handlers/server-settings"),
      "rankings":        () => import("@/game/api-handlers/rankings"),
      "season":          () => import("@/game/api-handlers/season"),
      "health":          () => import("@/game/api-handlers/health"),
      "notifications":   () => import("@/game/api-handlers/notifications-check"),
      "craft-recipes":   () => import("@/game/api-handlers/craft-recipes"),
      "presence":        () => import("@/game/api-handlers/presence"),
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
