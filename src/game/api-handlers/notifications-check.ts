import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { computeEnergyRegen } from "@/game/energy";
import { xpMultiplier } from "@/game/boosts";
import { ghostShopStatus, sanitizeGhostShopConfig } from "@/game/ghostShop";
import { loadCtx } from "../api-handlers/world-boss-state";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Estado global para o cliente gerar NOTIFICAÇÕES DO NAVEGADOR:
 *  - energia cheia (volta do estado "recarregando" para "cheia");
 *  - Loja Fantasma aberta;
 *  - Evento Global (Boss Mundial) aberto.
 * O cliente polla a cada ~30s e dispara `new Notification(...)` nas transições.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const regen = computeEnergyRegen(char, new Date(), xpMultiplier(char));
    const settings = await jsonDb.getServerSettings();
    const ghost = ghostShopStatus(sanitizeGhostShopConfig(settings?.ghostShop));
    const wb = await loadCtx();

    return NextResponse.json({
      energyFull: regen.full,
      ghostShopOpen: ghost.open,
      worldBossOpen: wb.cfg.enabled && wb.status.open,
      mailboxCount: await jsonDb.countUnclaimedMails(String(characterId)),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
