/**
 * EVENTOS ALEATÓRIOS 🎲 — surpresas que aparecem ao concluir atividades.
 *
 * Ao terminar uma missão, farm de região, mini-boss ou boss, há uma chance de
 * o jogador encontrar um evento especial. Cada evento tem um CUSTO e uma
 * RECOMPENSA — o jogador decide aceitar ou ignorar.
 *
 * Eventos:
 *   - merchant  : mercador ambulante — pague ouro, ganhe diamantes
 *   - chest     : baú misterioso — pague cristais, ganhe ouro/energia
 *   - blessing  : bênção ancestral — pague ouro, ganhe XP
 *   - shrine    : santuário — pague cristais, ganhe moedas da torre
 *   - gamble    : apostador — pague ouro, 50/50 de dobrar ou perder
 *
 * O evento é gerado no servidor (nunca no cliente) e expira após um tempo
 * curto (5 min) — anti-cheat: o servidor valida o evento salvo no personagem.
 */

export interface RandomEventDef {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
  /** Custo em ouro (0 = não usa). */
  goldCost?: number;
  /** Custo em cristais (0 = não usa). */
  crystalCost?: number;
  /** Recompensa em ouro. */
  goldReward?: number;
  /** Recompensa em diamantes. */
  diamondReward?: number;
  /** Recompensa em cristais. */
  crystalReward?: number;
  /** Recompensa em energia. */
  energyReward?: number;
  /** Recompensa em moedas da torre. */
  towerCoinReward?: number;
  /** Recompensa em XP (multiplicada pelo nível). */
  xpRewardBase?: number;
  /** 50/50: pode falhar (gamble). */
  gamble?: boolean;
}

export const RANDOM_EVENTS: RandomEventDef[] = [
  { id: "merchant", icon: "🧙", nameKey: "event.merchant", descKey: "event.merchant.desc", goldCost: 500, diamondReward: 3 },
  { id: "chest", icon: "🧰", nameKey: "event.chest", descKey: "event.chest.desc", crystalCost: 3, goldReward: 1500, energyReward: 20 },
  { id: "blessing", icon: "🕊️", nameKey: "event.blessing", descKey: "event.blessing.desc", goldCost: 800, xpRewardBase: 4 },
  { id: "shrine", icon: "⛩️", nameKey: "event.shrine", descKey: "event.shrine.desc", crystalCost: 5, towerCoinReward: 150 },
  { id: "gamble", icon: "🎰", nameKey: "event.gamble", descKey: "event.gamble.desc", goldCost: 1000, goldReward: 2500, gamble: true },
];

/** Chance de um evento aparecer ao concluir uma atividade. */
export const EVENT_CHANCE = 0.12;

/** Tempo de validade do evento pendente (ms). */
export const EVENT_TTL_MS = 5 * 60 * 1000;

/** Estado do evento pendente salvo no personagem. */
export interface PendingEvent {
  id: string;
  createdAt: number;
}

/** Rola um evento aleatório (rng injetável para testes). */
export function rollRandomEvent(rng: () => number = Math.random): RandomEventDef | null {
  if (rng() > EVENT_CHANCE) return null;
  const pool = RANDOM_EVENTS;
  return pool[Math.floor(rng() * pool.length)];
}

/** Lê o evento pendente do personagem (null se expirou ou não há). */
export function pendingEvent(char: any): { event: RandomEventDef; state: PendingEvent } | null {
  const st = char?.pendingEvent;
  if (!st || typeof st !== "object") return null;
  const state = st as PendingEvent;
  if (Date.now() - Number(state.createdAt) > EVENT_TTL_MS) return null;
  const def = RANDOM_EVENTS.find((e) => e.id === state.id);
  if (!def) return null;
  return { event: def, state };
}

/**
 * Resolve o evento (aceitar): valida custo, aplica recompensa e limpa o estado.
 * Devolve patch + recompensa ou erro.
 */
export function resolveRandomEvent(
  char: any,
  rng: () => number = Math.random
): { patch: any; reward: Record<string, number>; failed?: boolean } | { error: string } {
  const pending = pendingEvent(char);
  if (!pending) return { error: "Nenhum evento disponível" };
  const { event, state } = pending;
  void state;
  const goldCost = event.goldCost || 0;
  const crystalCost = event.crystalCost || 0;

  // Valida custos.
  if (goldCost > 0 && (Number(char.gold) || 0) < goldCost) {
    return { error: "Ouro insuficiente" };
  }
  if (crystalCost > 0 && (Number(char.crystals) || 0) < crystalCost) {
    return { error: "Cristais insuficientes" };
  }

  const reward: Record<string, number> = {};
  const patch: any = { pendingEvent: null };
  patch.gold = (Number(char.gold) || 0) - goldCost;
  patch.crystals = (Number(char.crystals) || 0) - crystalCost;

  // Gamble: 50/50 — pode falhar (perde o custo sem ganhar nada).
  let failed = false;
  if (event.gamble && rng() < 0.5) {
    failed = true;
    return { patch, reward: {}, failed };
  }

  if (event.goldReward) { patch.gold = (patch.gold || 0) + event.goldReward; reward.gold = event.goldReward; }
  if (event.diamondReward) { patch.diamonds = (Number(char.diamonds) || 0) + event.diamondReward; reward.diamonds = event.diamondReward; }
  if (event.crystalReward) { patch.crystals = (patch.crystals || 0) + event.crystalReward; reward.crystals = event.crystalReward; }
  if (event.energyReward) {
    const maxE = Math.max(0, Number(char.maxEnergy) || 100);
    patch.energy = Math.min(maxE, (Number(char.energy) || 0) + event.energyReward);
    reward.energy = Math.min(event.energyReward, maxE - (Number(char.energy) || 0));
  }
  if (event.towerCoinReward) { patch.towerCoins = (Number(char.towerCoins) || 0) + event.towerCoinReward; reward.towerCoins = event.towerCoinReward; }
  if (event.xpRewardBase) {
    const base = Math.floor((Number(char.xpToNext) || 100) * event.xpRewardBase / 100);
    patch.xp = (Number(char.xp) || 0) + base;
    reward.xp = base;
  }
  // Registra para auditoria.
  patch.lastEvent = { id: event.id, at: new Date().toISOString() };
  return { patch, reward, failed };
}
