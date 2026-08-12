/**
 * Regras da Arena PvP (compartilhadas entre a API e a UI).
 *
 * Conceito de design (mesmo padrão de src/game/dungeons.ts):
 *  - Limite de batalhas por dia (PVP_DAILY_MAX) → recurso escasso e competitivo,
 *    evita que a Arena vire "farm" infinito de ouro/XP/rating.
 *  - O limite é persistido no personagem via `pvpDailyDate` (YYYY-MM-DD) e
 *    `pvpDailyCount`; sem data de reset = reseta sozinho a cada dia.
 */

/** Limite de batalhas na Arena por dia. */
export const PVP_DAILY_MAX = 10;

/** Chave de data local (YYYY-MM-DD) usada para o limite diário do PvP. */
export function pvpDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Alias de `pvpDateKey` mantido para compatibilidade com código antigo que
 * usava o nome `todayKey` (builds existentes continuam funcionando).
 */
export const todayKey = pvpDateKey;

/** Estado diário consolidado (para a resposta da API e o chip da UI). */
export function computePvpDaily(char: any, now: Date = new Date()) {
  const dateKey = pvpDateKey(now);
  const used = char?.pvpDailyDate === dateKey ? Number(char.pvpDailyCount) || 0 : 0;
  return {
    dailyMax: PVP_DAILY_MAX,
    dateKey,
    used: Math.max(0, Math.min(PVP_DAILY_MAX, used)),
    dailyLeft: Math.max(0, PVP_DAILY_MAX - used),
  };
}