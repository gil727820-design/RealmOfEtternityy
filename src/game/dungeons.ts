/**
 * Regras das Masmorras off-line (compartilhadas entre a API e a estimativa da UI).
 *
 * Conceito de design (para não virar jogo de "cultivo"):
 *  - Aventuras finitas por dia (DUNGEON_DAILY_CAP) → recurso escasso.
 *  - Custo de energia ao iniciar (compete com missões).
 *  - Durações mais longas pagam MUITO mais (fator crescente): 4h ≈ 2.5× a 2h,
 *    8h ≈ 5.5× a 2h — vale a pena deixar o herói rodando mais tempo.
 *  - O combate é simulado por poder: tentar muito além do seu poder gera
 *    derrota e perde o bônus → incentiva escolher a dificuldade certa.
 *  - Drops: até RARO nos rolls normais — épico+ sai apenas de baús da loja ou
 *    do CHEFE do piso (que garante 1 drop ÉPICO ao ser derrotado). Andares
 *    profundos dão mais drops (e o chefe garante +1).
 */

import { xpMultiplier } from "./boosts";

/**
 * DIFICULDADES avançadas: Normal → Lendário.
 * Cada dificuldade multiplica recompensas/drops e exige nível mínimo.
 * A dificuldade também aumenta o poder exigido dos andares (+% por tier)
 * e o custo de energia — risco vs. recompensa.
 */
export type DungeonDifficulty = "normal" | "hard" | "epic" | "legendary";

export interface DungeonDifficultyDef {
  id: DungeonDifficulty;
  nameKey: string;
  icon: string;
  /** Nível mínimo para escolher. */
  minLevel: number;
  /** Multiplicador de recompensas (ouro/XP/cristais). */
  rewardMult: number;
  /** Multiplicador do poder exigido por andar (mais difícil de limpar). */
  powerMult: number;
  /** Multiplicador do custo de energia. */
  energyMult: number;
  /** Raridade máxima permitida nos rolls (índice em DUNGEON_RARITY_ORDER). */
  maxRarityIdx: number;
  /** Rolls extras de item por expedição. */
  bonusRolls: number;
}

export const DUNGEON_DIFFICULTIES: DungeonDifficultyDef[] = [
  { id: "normal", nameKey: "dungeon.diff.normal", icon: "🟢", minLevel: 1, rewardMult: 1, powerMult: 1, energyMult: 1, maxRarityIdx: 2, bonusRolls: 0 },
  { id: "hard", nameKey: "dungeon.diff.hard", icon: "🟠", minLevel: 20, rewardMult: 1.5, powerMult: 1.15, energyMult: 1.5, maxRarityIdx: 3, bonusRolls: 1 },
  { id: "epic", nameKey: "dungeon.diff.epic", icon: "🟣", minLevel: 40, rewardMult: 2.2, powerMult: 1.3, energyMult: 2, maxRarityIdx: 5, bonusRolls: 2 },
  { id: "legendary", nameKey: "dungeon.diff.legendary", icon: "🔴", minLevel: 60, rewardMult: 3.2, powerMult: 1.5, energyMult: 2.5, maxRarityIdx: 6, bonusRolls: 3 },
];

export function difficultyDef(id: string | null | undefined): DungeonDifficultyDef {
  return DUNGEON_DIFFICULTIES.find((d) => d.id === id) ?? DUNGEON_DIFFICULTIES[0];
}

/** Limite de masmorras por dia (recurso escasso → drops competitivos). */
export const DUNGEON_DAILY_CAP = 3;
/** Energia gasta para iniciar uma expedição (custo base da duração de 2h). */
export const DUNGEON_ENERGY_COST = 10;
/** Energia por hora de expedição: o custo escala junto com a duração. */
export const DUNGEON_ENERGY_PER_HOUR = DUNGEON_ENERGY_COST / 2;
/** Custo de energia conforme a duração escolhida (2h=10, 4h=20, 8h=40). */
export function dungeonEnergyCost(hours: number): number {
  return Math.round((Number(hours) || 0) * DUNGEON_ENERGY_PER_HOUR);
}

/** Custo de energia com a dificuldade (normal ×1, lendário ×2.5). */
export function dungeonEnergyCostWithDiff(hours: number, diff: DungeonDifficultyDef): number {
  return Math.round(dungeonEnergyCost(hours) * diff.energyMult);
}
/** Durações permitidas (segundos). */
export const DUNGEON_DURATIONS_SEC = [
  { hours: 2, sec: 7200 },
  { hours: 4, sec: 14400 },
  { hours: 8, sec: 28800 },
] as const;

/** Poder (bruto) de cada andar de masmorra. */
export function dungeonFloorPower(floor: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): number {
  return Math.round((15 + floor * 22) * diff.powerMult);
}

/** Máximo de andares que o personagem consegue tentar (baseado no nível). */
export function dungeonCapFloor(level: number): number {
  return Math.max(1, Math.min(60, 3 + Math.floor((Number(level) || 1) / 2)));
}

/** Quantos andares o personagem limpa atendado a `attemptFloor`. */
export function dungeonClears(
  power: number,
  attemptFloor: number,
  diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]
): { clears: number; boss: boolean } {
  const attempt = Math.max(1, Math.floor(attemptFloor));
  if (power <= 0) return { clears: 0, boss: false };

  let clears = 0;
  for (let f = 1; f <= attempt; f++) {
    const boss = f % 10 === 0;
    const need = dungeonFloorPower(f, diff) * (boss ? 1.35 : 1);
    if (power < need) break; // não passa deste andar
    clears = f;
  }

  const boss = clears % 10 === 0;
  return { clears, boss };
}

/** Fator de recompensa por duração: quanto mais tempo, mais recompensa (com parcimônia). */
export function dungeonDurationFactor(hours: number): number {
  if (hours <= 0) return 0;
  // 2h -> 0.5 | 4h -> 0.8 | 8h -> 1.0
  if (hours <= 4) return Math.round((0.5 + (hours - 2) * 0.15) * 100) / 100;
  return Math.round((0.8 + (hours - 4) * 0.05) * 100) / 100;
}

/** Quantos rolls de item a expedição concede (sobe com duração e profundidade).
 * Vencer um chefe (andar múltiplo de 10) garante +1 drop. Dificuldades altas
 * dão rolls extras. */
export function dungeonItemRolls(clears: number, hours: number, boss: boolean = false, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): number {
  const factor = dungeonDurationFactor(hours);
  if (clears <= 0) return 0;
  return Math.max(1, Math.floor((clears / 12) * factor) + (boss ? 1 : 0) + diff.bonusRolls);
}

/** Ordem de raridade (baixa → alta). */
export const DUNGEON_RARITY_ORDER = [
  "common", "uncommon", "rare", "epic",
  "legendary", "mythic", "divine",
] as const;

/**
 * Raridade máxima dos rolls conforme a DIFICULDADE:
 *  - normal: até raro (épico+ só de chefe/baús)
 *  - hard: até épico
 *  - epic: até mítico
 *  - legendary: até divino
 */
export function dungeonMaxRarityIdx(_clears: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): number {
  return diff.maxRarityIdx;
}

/**
 * Pool ponderado de raridade para os drops. Andares profundos sobem o peso de
 * raridades altas. Retorna um array onde a probabilidade ≈ (ocorrências/total).
 */
export function dungeonRarityPool(clears: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): string[] {
  const maxIdx = dungeonMaxRarityIdx(clears, diff);
  const counts = [6, 4, 3, 3]; // common, uncommon, rare, epic
  for (let i = 4; i <= Math.max(4, Math.min(6, maxIdx)); i++) {
    counts[i] = Math.max(2, 10 - Math.floor(i) * 2); // legendary=2, mythic=2, divine=2
  }
  const pool: string[] = [];
  for (let i = 0; i <= Math.min(6, maxIdx); i++) {
    for (let k = 0; k < (counts[i] ?? 0); k++) pool.push(DUNGEON_RARITY_ORDER[i]);
  }
  return pool;
}

/** Faz um roll ponderado dentro do pool de raridade. */
export function dungeonRollRarity(clears: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): string {
  const pool = dungeonRarityPool(clears, diff);
  if (pool.length === 0) return "common";
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Rótulo da melhor raridade alcançável (para exibir a estimativa na UI). */
export function dungeonBestRarity(clears: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): string {
  return DUNGEON_RARITY_ORDER[dungeonMaxRarityIdx(clears, diff)];
}

/** Chave de data local (YYYY-MM-DD) usada para o limite diário. */
export function dungeonDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ouro gerado por masmorra (escala com a duração da expedição). */
export function dungeonGoldByClears(clears: number, hours: number): number {
  if (clears <= 0) return 0;
  const factor = dungeonDurationFactor(hours);
  let sum = 0;
  for (let f = 1; f <= clears; f++) sum += Math.floor(22 + f * 13);
  return Math.floor(sum * factor);
}

/** XP gerado (escala com a duração da expedição, sem aplicar boost). */
export function dungeonXpByClears(clears: number, hours: number): number {
  if (clears <= 0) return 0;
  const factor = dungeonDurationFactor(hours);
  let sum = 0;
  for (let f = 1; f <= clears; f++) sum += Math.floor(15 + f * 13);
  return Math.floor(sum * factor);
}

/** Cristais extras pelo avanço (escala com a duração da expedição). */
export function dungeonCrystalsByClears(clears: number, hours: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]): number {
  if (clears <= 0) return 0;
  return Math.floor((clears / 14) * dungeonDurationFactor(hours) * diff.rewardMult);
}

/** Prêmio extra por vencer o chefe do piso atual. */
export function dungeonBossBonus(): { gold: number; xp: number } {
  return { gold: 120, xp: 120 };
}

/**
 * Total de ouro/XP bruto de uma expedição (sem aplicar boost de XP). Usado
 * tanto na estimativa (preview) quanto na coleta (claim) — nunca divergem.
 */
export function dungeonBaseRewards(clears: number, boss: boolean, hours: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]) {
  const b = dungeonBossBonus();
  const mult = diff.rewardMult;
  return {
    gold: Math.floor((dungeonGoldByClears(clears, hours) + (boss ? b.gold : 0)) * mult),
    xp: Math.floor((dungeonXpByClears(clears, hours) + (boss ? b.xp : 0)) * mult),
  };
}

/** Xp final de uma expedição, já com o multiplicador de boost. */
export function dungeonXpEarned(char: any, rawXp: number): number {
  return Math.floor(rawXp * xpMultiplier(char));
}

/** Recompensas de uma expedição concluída (idênticas ao preview). */
export function computeDungeonRewards(char: any, attemptFloor: number, hours: number, diff: DungeonDifficultyDef = DUNGEON_DIFFICULTIES[0]) {
  const power = Number(char.power) || 0;
  const { clears, boss } = dungeonClears(power, attemptFloor, diff);
  const base = dungeonBaseRewards(clears, boss, hours, diff);
  return {
    power,
    attemptFloor,
    hours,
    difficulty: diff.id,
    clears,
    boss,
    gold: base.gold,
    xpRaw: base.xp,
    xp: dungeonXpEarned(char, base.xp),
    crystals: dungeonCrystalsByClears(clears, hours, diff),
    rolls: dungeonItemRolls(clears, hours, boss, diff),
    bestRarity: clears > 0 ? dungeonBestRarity(clears, diff) : "none",
    factor: dungeonDurationFactor(hours),
  };
}

/** Estado consolidado da masmorra para expor à UI (prévia + limites diários). */
export function computeDungeonStatus(char: any, now: Date = new Date()) {
  const stats = char.dungeonStats || {};
  const todayKey = dungeonDateKey(now);
  const used = stats.lastDate === todayKey ? Number(stats.runsToday) || 0 : 0;

  const diff = difficultyDef(char.dungeonDifficulty);

  const daily = {
    cap: DUNGEON_DAILY_CAP,
    used,
    remaining: Math.max(0, DUNGEON_DAILY_CAP - used),
    dateKey: todayKey,
    reset: false,
  };

  let active = null;
  const run = char.dungeonActive;
  if (run && run.startedAt) {
    const started = new Date(run.startedAt).getTime();
    const durationSec = Number(run.durationSec) || 0;
    const elapsedSec = Math.max(0, Math.floor((now.getTime() - started) / 1000));
    const remainingSec = Math.max(0, durationSec - elapsedSec);
    const done = elapsedSec >= durationSec;
    active = {
      startedAt: run.startedAt,
      durationSec,
      hours: Number(run.hours) || (durationSec / 3600),
      attemptFloor: Number(run.attemptFloor) || 1,
      difficulty: run.difficulty || diff.id,
      elapsedSec,
      remainingSec,
      done,
    };
  }

  const preview = computeDungeonRewards(char, Number(run?.attemptFloor) || 1, Number(run?.hours) || 2, diff);

  return { active, daily, preview, cost: DUNGEON_ENERGY_COST, difficulty: diff };
}