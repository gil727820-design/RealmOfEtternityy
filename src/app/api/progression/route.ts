import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");
    const handlers: Record<string, () => Promise<any>> = {
      "achievements":    () => import("@/game/api-handlers/achievements"),
      "ascension":       () => import("@/game/api-handlers/ascension"),
      "bestiary":        () => import("@/game/api-handlers/bestiary"),
      "collection":      () => import("@/game/api-handlers/collection"),
      "enchantments":    () => import("@/game/api-handlers/enchantments"),
      "forge":           () => import("@/game/api-handlers/forge"),
      "specialization":  () => import("@/game/api-handlers/specialization"),
      "refinement":      () => import("@/game/api-handlers/refinement"),
      "advanced-class":  () => import("@/game/api-handlers/advanced-class"),
      "inheritance":     () => import("@/game/api-handlers/inheritance"),
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
      "achievements":    () => import("@/game/api-handlers/achievements"),
      "bestiary":        () => import("@/game/api-handlers/bestiary"),
      "collection":      () => import("@/game/api-handlers/collection"),
      "specialization":  () => import("@/game/api-handlers/specialization"),
      "refinement":      () => import("@/game/api-handlers/refinement"),
      "advanced-class":  () => import("@/game/api-handlers/advanced-class"),
      "inheritance":     () => import("@/game/api-handlers/inheritance"),
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
