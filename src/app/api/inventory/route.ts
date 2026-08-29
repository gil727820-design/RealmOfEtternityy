import { NextRequest, NextResponse } from "next/server";

/**
 * POST — /api/inventory?action=equip|sell|use|auto-equip|skin|remove
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = String(body?.action || url.searchParams.get("action") || "");

    if (action === "equip") {
      const mod = await import("@/game/api-handlers/inventory-equip");
      return mod.POST(req);
    }
    if (action === "sell") {
      const mod = await import("@/game/api-handlers/inventory-sell");
      return mod.POST(req);
    }
    if (action === "use") {
      const mod = await import("@/game/api-handlers/inventory-use");
      return mod.POST(req);
    }
    if (action === "auto-equip") {
      const mod = await import("@/game/api-handlers/inventory-auto-equip");
      return mod.POST(req);
    }
    if (action === "skin") {
      const mod = await import("@/game/api-handlers/inventory-skin");
      return mod.POST(req);
    }
    if (action === "remove") {
      const mod = await import("@/game/api-handlers/inventory-remove");
      return mod.POST(req);
    }

    return NextResponse.json({ error: "Action inválida. Use: equip, sell, use, auto-equip, skin, remove" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
