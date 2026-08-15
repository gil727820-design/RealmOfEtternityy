import { NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { ghostShopStatus, sanitizeGhostShopConfig } from "@/game/ghostShop";

/**
 * Estado público da Loja Fantasma.
 * Sem autenticação (igual a /api/server/settings): devolve se está aberta,
 * quando abre/fecha, os horários agendados e os itens à venda (com o template).
 */
export async function GET() {
  try {
    const settings = await jsonDb.getServerSettings();
    const cfg = sanitizeGhostShopConfig(settings?.ghostShop);
    const status = ghostShopStatus(cfg);

    // Expande os templates dos itens configurados para o cliente exibir
    // (nome, imagem, raridade, stats...).
    const templates = await jsonDb.getAllItemTemplates();
    const byId = new Map(templates.map((t: any) => [Number(t.id), t]));
    const items = cfg.items
      .map((it) => {
        const template = byId.get(Number(it.templateId)) ?? null;
        return { template, price: it.price, quantity: it.quantity };
      })
      .filter((it) => !!it.template);

    return NextResponse.json({
      enabled: cfg.enabled,
      open: status.open,
      startsAt: status.startsAt,
      endsAt: status.endsAt,
      nextOpening: status.nextOpening,
      closingInMs: status.closingInMs,
      schedule: status.schedule,
      durationMinutes: cfg.durationMinutes,
      // Relógio do servidor: o cliente usa para corrigir a contagem regressiva
      // e exibir os horários convertidos pro fuso local do jogador.
      serverTime: new Date().toISOString(),
      serverOffsetMinutes: -new Date().getTimezoneOffset(),
      items,
    });
  } catch (e) {
    console.error("Ghost shop state error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
