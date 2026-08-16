/**
 * PITY NOS BAÚS 🎁 — garantia de raridade após N aberturas sem sucesso.
 *
 * Cada baú tem um contador de "pity" no personagem (`pityCounters`):
 *   pityCounters: { common: 0, epic: 5, ... }
 *
 * Ao abrir um baú, se o contador atingir o LIMITE, o próximo item garante a
 * raridade TOP do baú (e o contador zera). Se o item top sair antes, o
 * contador também zera. Limite escala com o nível do baú (baús caros têm pity
 * menor — mais generosos).
 */

/** Limite base de aberturas sem topo para cada baú. */
export const PITY_BASE: Record<string, number> = {
  common: 25,
  uncommon: 22,
  rare: 18,
  epic: 15,
  legendary: 12,
  mythic: 10,
  divine: 8,
  secret: 6,
};

/**
 * Limite de pity dos OVOS de pet 🥚 — garante a raridade TOP do ovo após N
 * aberturas sem ela (ovo básico → raro garantido, ovo raro → lendário, ovo
 * épico → divino). Contadores ficam no mesmo `pityCounters` do personagem,
 * com as chaves `egg_basic`, `egg_rare` e `egg_epic`.
 */
export const EGG_PITY_BASE: Record<string, number> = {
  egg_basic: 25,
  egg_rare: 20,
  egg_epic: 12,
};

/** Lê os contadores de pity do personagem. */
export function pityCounters(char: any): Record<string, number> {
  const p = char?.pityCounters;
  return p && typeof p === "object" ? (p as Record<string, number>) : {};
}

/** Lê o pity de um baú específico. */
export function pityFor(char: any, chestId: string): number {
  return Math.max(0, Math.floor(Number(pityCounters(char)[chestId]) || 0));
}

/** Limite de pity de um baú/ovo (0 = pity desativado). */
export function pityLimit(chestId: string): number {
  return PITY_BASE[chestId] ?? EGG_PITY_BASE[chestId] ?? 0;
}

/**
 * Decide se o próximo item DEVE ser o topo (pity estourou) e retorna o patch
 * a aplicar no personagem após a abertura:
 *  - `guaranteed`: true se este item deve ser forçado ao topo.
 *  - `patch.pityCounters`: contadores após processar o item.
 *    (se o item foi topo OU garantido, zera; senão +1)
 */
export function pityDecision(
  char: any,
  chestId: string,
  gotTop: boolean,
  limit?: number
): { guaranteed: boolean; pityCounters: Record<string, number> } {
  const counters = pityCounters(char);
  const current = counters[chestId] || 0;
  const lim = limit ?? pityLimit(chestId);

  // Pity estourou: força o topo.
  const guaranteed = lim > 0 && current + 1 >= lim;

  if (gotTop || guaranteed) {
    counters[chestId] = 0;
  } else {
    counters[chestId] = current + 1;
  }
  return { guaranteed, pityCounters: counters };
}

/** Estado do pity para a UI (progresso atual / limite). */
export function pityStatus(char: any, chestId: string) {
  const current = pityFor(char, chestId);
  const limit = pityLimit(chestId);
  return {
    chestId,
    current,
    limit,
    pct: limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0,
    guaranteed: limit > 0 && current + 1 >= limit,
  };
}
