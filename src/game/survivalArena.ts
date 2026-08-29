/**
 * ARENA DE SOBREVIVENCIA — waves infinitas com dificuldade crescente.
 *
 * Conceito:
 *   - O jogador enfrenta waves consecutivas de monstros
 *   - Cada wave tem mais monstros e monstros mais fortes
   - Recompensas escalam com a wave alcancada
 *   - Se o jogador morre, perde metade das recompensas
 *   - Ranking global baseado na melhor wave alcancada
 *   - Max 3 tentativas por dia
 */

export interface WaveDef {
  wave: number;
  monsterCount: number;
  monsterPower: number;
  monsterHp: number;
  bossWave: boolean;
  bossName?: string;
  bossIcon?: string;
}

/** Calcula definicao de uma wave */
export function getWaveDef(wave: number): WaveDef {
  const baseCount = 3 + Math.floor(wave / 5);
  const count = Math.min(baseCount, 15); // max 15 monstros por wave
  const power = 50 + wave * 15 + Math.floor(wave * wave * 0.3);
  const hp = 80 + wave * 20 + Math.floor(wave * wave * 0.2);
  const bossWave = wave % 10 === 0;

  let bossName: string | undefined;
  let bossIcon: string | undefined;

  if (bossWave) {
    const bosses = [
      { name: "Guardiao da Arena", icon: "\u{1F6E1}\uFE0F" },
      { name: "Gladiador Sombrio", icon: "\u2694\uFE0F" },
      { name: "Leao de Pedra", icon: "\u{1F981}" },
      { name: "Destruidor", icon: "\u{1F4A5}" },
      { name: "Senhor da Guerra", icon: "\u{1F451}" },
      { name: "Abismo Vivente", icon: "\u{1F47F}" },
      { name: "Fenix de Guerra", icon: "\u{1F525}" },
      { name: "Titã Antigo", icon: "\u{1F30B}" },
    ];
    const bossIdx = (Math.floor(wave / 10) - 1) % bosses.length;
    bossName = bosses[bossIdx].name;
    bossIcon = bosses[bossIdx].icon;
  }

  return { wave, monsterCount: count, monsterPower: power, monsterHp: hp, bossWave, bossName, bossIcon };
}

/** Simula batalha de uma wave */
export function simulateWave(playerPower: number, waveDef: WaveDef): { won: boolean; damageDealt: number; damageTaken: number } {
  let totalEnemyPower = waveDef.monsterPower * waveDef.monsterCount;
  if (waveDef.bossWave) totalEnemyPower *= 1.5; // boss waves 50% mais fortes

  const playerDamage = playerPower * (0.8 + Math.random() * 0.4);
  const enemyDamage = totalEnemyPower * (0.5 + Math.random() * 0.5);

  return {
    won: playerDamage > enemyDamage * 0.6,
    damageDealt: Math.floor(playerDamage),
    damageTaken: Math.floor(enemyDamage),
  };
}

/** Recompensas por wave alcancada */
export function waveRewards(wave: number): { gold: number; xp: number; crystals: number; arenaCoins: number } {
  const base = wave;
  return {
    gold: Math.floor(base * 100 + base * base * 2),
    xp: Math.floor(base * 50 + base * base),
    crystals: Math.floor(base * 0.5 + base * base * 0.05),
    arenaCoins: Math.floor(base * 2 + base * 0.1),
  };
}

/** Recompensas acumuladas ate uma wave */
export function cumulativeRewards(wave: number): { gold: number; xp: number; crystals: number; arenaCoins: number } {
  let gold = 0, xp = 0, crystals = 0, arenaCoins = 0;
  for (let w = 1; w <= wave; w++) {
    const r = waveRewards(w);
    gold += r.gold;
    xp += r.xp;
    crystals += r.crystals;
    arenaCoins += r.arenaCoins;
  }
  return { gold, xp, crystals, arenaCoins };
}

/** Limite diario de tentativas */
export const ARENA_DAILY_LIMIT = 3;

/** Preco de entrada (energia) */
export const ARENA_ENERGY_COST = 15;

/** Recompensas por ranking no fim da temporada */
export const ARENA_RANKING_REWARDS: Array<{ rank: number; title: string; gold: number; crystals: number; diamonds: number }> = [
  { rank: 1, title: "Campeao da Arena", gold: 100000, crystals: 500, diamonds: 50 },
  { rank: 2, title: "Gladiador Elite", gold: 60000, crystals: 300, diamonds: 30 },
  { rank: 3, title: "Guerreiro Lendario", gold: 40000, crystals: 200, diamonds: 20 },
  { rank: 4, title: "Veterano da Arena", gold: 20000, crystals: 100, diamonds: 10 },
  { rank: 5, title: "Desafiante", gold: 10000, crystals: 50, diamonds: 5 },
  { rank: 6, title: "Competidor", gold: 5000, crystals: 25, diamonds: 3 },
  { rank: 7, title: "Participante", gold: 2000, crystals: 10, diamonds: 1 },
  { rank: 8, title: "Novato da Arena", gold: 1000, crystals: 5, diamonds: 0 },
];
