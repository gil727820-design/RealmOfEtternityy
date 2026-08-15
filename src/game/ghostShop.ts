/*
 * Loja Fantasma — loja temporária paga com moedas da torre (towerCoins).
 *
 * A configuração fica nas configurações globais do servidor (`ghostShop`,
 * editada pelo painel admin) e a loja abre em horários do dia configurados,
 * ficando disponível por um tempo determinado:
 *   - schedule:      lista de horários diários "HH:MM" (hora local do servidor)
 *   - durationMinutes: por quanto tempo a loja fica aberta a cada abertura
 *   - items:         itens do catálogo (templateId) com preço em towerCoins
 *
 * O agendamento é calculado pela HORA DO SERVIDOR (novo Date()), então cliente
 * e servidor chegam sempre ao mesmo resultado — sem confiar no relógio do jogador.
 */
import {
  dailyWindowStatus,
  isValidScheduleTime,
  normalizeScheduleTime,
  type DailyWindowStatus,
} from "./schedule";

export { isValidScheduleTime, normalizeScheduleTime };

export interface GhostShopItem {
  /** id do template de item no catálogo (item_templates). */
  templateId: number;
  /** Preço em moedas da torre (towerCoins). */
  price: number;
  /** Quantas unidades são entregues por compra. */
  quantity: number;
}

export interface GhostShopConfig {
  /** Liga/desliga a loja inteira. */
  enabled: boolean;
  /** Horários diários "HH:MM" em que a loja abre. */
  schedule: string[];
  /** Quanto tempo a loja fica aberta a cada abertura (minutos). */
  durationMinutes: number;
  /** Itens à venda. */
  items: GhostShopItem[];
}

export const DEFAULT_GHOST_SHOP: GhostShopConfig = {
  enabled: false,
  schedule: ["12:00", "18:00", "21:00"],
  durationMinutes: 60,
  items: [],
};

export interface GhostShopStatus extends DailyWindowStatus {}

/**
 * Calcula o estado atual da loja fantasma com base na configuração.
 * Não lança erros — sempre devolve um status válido.
 */
export function ghostShopStatus(cfg: Partial<GhostShopConfig> | null | undefined, now = new Date()): GhostShopStatus {
  const status = dailyWindowStatus(cfg?.schedule ?? [], cfg?.durationMinutes ?? 60, now);

  // Loja desativada → nunca abre e não mostra contagem (o admin ainda não
  // programou horários): o painel mostra "ainda não está aberta".
  if (!cfg || !cfg.enabled) return { ...status, open: false, nextOpening: null };
  // Sem itens configurados ainda → não abre, MAS mantém o agendamento para o
  // painel exibir a contagem regressiva da próxima abertura (igual ao Boss
  // Mundial — "cooldown" ao vivo com os horários configurados).
  if (!Array.isArray(cfg.items) || cfg.items.length === 0) {
    return { ...status, open: false };
  }
  return status;
}

/** Sanitiza a configuração vinda do admin (evita dados inválidos no banco). */
export function sanitizeGhostShopConfig(raw: unknown): GhostShopConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GHOST_SHOP };
  const g = raw as Record<string, unknown>;

  const items: GhostShopItem[] = Array.isArray(g.items)
    ? g.items
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const o = it as Record<string, unknown>;
          const templateId = Math.floor(Number(o.templateId));
          const price = Math.floor(Number(o.price));
          if (!Number.isFinite(templateId) || templateId <= 0) return null;
          return {
            templateId,
            price: Number.isFinite(price) ? Math.max(0, price) : 0,
            quantity: Math.max(1, Math.floor(Number(o.quantity) || 1)),
          };
        })
        .filter((x): x is GhostShopItem => x !== null)
    : [];

  const schedule: string[] = Array.isArray(g.schedule)
    ? g.schedule.filter(isValidScheduleTime).map(normalizeScheduleTime)
    : [];

  return {
    enabled: !!g.enabled,
    schedule: Array.from(new Set(schedule)).sort(),
    durationMinutes: Math.max(1, Math.min(24 * 60, Math.floor(Number(g.durationMinutes) || 60))),
    items,
  };
}
