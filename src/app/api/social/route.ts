import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");
    const handlers: Record<string, () => Promise<any>> = {
      "mailbox-send":     () => import("@/game/api-handlers/mailbox"),
      "trade-ads-chat":   () => import("@/game/api-handlers/trade-ads-chat"),
      "trade-ads-remove": () => import("@/game/api-handlers/trade-ads-remove"),
      "trade-open":       () => import("@/game/api-handlers/trade-session-open"),
      "trade-select":     () => import("@/game/api-handlers/trade-session-select"),
      "trade-chat":       () => import("@/game/api-handlers/trade-session-chat"),
      "trade-confirm":    () => import("@/game/api-handlers/trade-session-confirm"),
      "trade-cancel":     () => import("@/game/api-handlers/trade-session-cancel"),
      "trade-ads":        () => import("@/game/api-handlers/trade-ads"),
      "trade-sessions":   () => import("@/game/api-handlers/trade-session-sessions"),
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
      "trade-ads":      () => import("@/game/api-handlers/trade-ads"),
      "trade-sessions": () => import("@/game/api-handlers/trade-session-sessions"),
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
