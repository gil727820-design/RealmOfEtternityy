/**
 * MODO DESAFIO / TORMENT 🏰 — torre com dificuldade extrema e ranking semanal.
 *
 * Diferente da torre normal (que escala suavemente), o modo desafio:
 *   - Começa no andar 50 (inimigos já fortes)
 *   - Inimigos têm HP/ATK x3 vs torre normal
 *   - Recompensas são 5x maiores
 *   - Ranking semanal: melhores andares alcançados
 *   - Recompensas no fim da semana baseadas na posição
 */

/** Andar inicial do modo desafio. */
export const CHALLENGE_START_FLOOR = 50;

/** Multiplicador de dificuldade vs torre normal. */
export const CHALLENGE_DIFFICULTY_MULT = 3;

/** Multiplicador de recompensas vs torre normal. */
export const CHALLENGE_REWARD_MULT = 5;

/** Recompensas por posição no ranking semanal. */
export const CHALLENGE_RANK_REWARDS: Array<{
  rank: string;
  minRank: number;
  gold: number;
  crystals: number;
  towerCoins: number;
  titleKey: string | null;
}> = [
  { rank: "1º", minRank: 1, gold: 100_000, crystals: 200, towerCoins: 1_000, titleKey: "challenge.title1" },
  { rank: "2º", minRank: 2, gold: 60_000, crystals: 120, towerCoins: 600, titleKey: "challenge.title2" },
  { rank: "3º", minRank: 3, gold: 40_000, crystals: 80, towerCoins: 400, titleKey: "challenge.title3" },
  { rank: "4º-10º", minRank: 4, gold: 20_000, crystals: 40, towerCoins: 200, titleKey: null },
  { rank: "11º-25º", minRank: 11, gold: 10_000, crystals: 20, towerCoins: 100, titleKey: null },
  { rank: "26º-50º", minRank: 26, gold: 5_000, crystals: 10, towerCoins: 50, titleKey: null },
  { rank: "Todos", minRank: 51, gold: 2_000, crystals: 5, towerCoins: 25, titleKey: null },
];

/** Recompensa para uma posição no ranking. */
export function challengeRankReward(position: number) {
  for (const r of CHALLENGE_RANK_REWARDS) {
    if (position <= r.minRank || r.rank === "Todos") return r;
  }
  return CHALLENGE_RANK_REWARDS[CHALLENGE_RANK_REWARDS.length - 1];
}

/** HP do monstro no modo desafio (escala mais rápido). */
export function challengeMobHp(floor: number, baseHp: number): number {
  const difficulty = 1 + (floor - CHALLENGE_START_FLOOR) * 0.05;
  return Math.round(baseHp * CHALLENGE_DIFFICULTY_MULT * difficulty);
}

/** ATK do monstro no modo desafio. */
export function challengeMobAtk(floor: number, baseAtk: number): number {
  const difficulty = 1 + (floor - CHALLENGE_START_FLOOR) * 0.03;
  return Math.round(baseAtk * CHALLENGE_DIFFICULTY_MULT * difficulty);
}

/** Ouro ganho por andar no modo desafio. */
export function challengeFloorGold(floor: number): number {
  return Math.round((40 + floor * 25) * CHALLENGE_REWARD_MULT);
}

/** XP ganho por andar no modo desafio. */
export function challengeFloorXp(floor: number): number {
  return Math.round((20 + floor * 15) * CHALLENGE_REWARD_MULT);
}

/** Moedas da torre ganhas por andar no modo desafio. */
export function challengeFloorTowerCoins(floor: number): number {
  return Math.round((5 + floor * 2) * CHALLENGE_REWARD_MULT);
}
