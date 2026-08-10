/**
 * Regras das Masmorras off-line (compartilhadas entre a API e a estimativa da UI).
 *
 * Conceito de design (para não virar jogo de "cultivo"):
 *  - Aventuras finitas por dia (MORPG_DUNGEON_DAILY_CAP) → recurso escasso.
 *  - Custo de energia ao iniciar (compete com missões).
 *  - Durações longas têm RETORNO DECRESCENTE de item por hora → não compensa
 *    deixar 24h rodando apenas para dropar mais itens.
 *  - O combate é simulado por poder: tentar muito além do seu poder gera
 *    derrota e perde o bônus → incentiva escolher a dificuldade certa.
 *  - Drops pendurados na raridade: andares profundos sobem o peso de raridades
 *    altas, mas nunca saturam (fica competitivo entre as classes).
 */

import { xpMultiplier } from "./boosts";

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
/** Durações permitidas (segundos). */
export const DUNGEON_DURATIONS_SEC = [
  { hours: 2, sec: 7200 },
  { hours: 4, sec: 14400 },
  { hours: 8, sec: 28800 },
] as const;

/** Poder (bruto) de cada andar de masmorra. */
export function dungeonFloorPower(floor: number): number {
  return Math.round(15 + floor * 22);
}

/** Máximo de andares que o personagem consegue tentar (baseado no nível). */
export function dungeonCapFloor(level: number): number {
  return Math.max(1, Math.min(60, 3 + Math.floor((Number(level) || 1) / 2)));
}

/** Quantos andares o personagem limpa atendado a `attemptFloor`. */
export function dungeonClears(
  power: number,
  attemptFloor: number
): { clears: number; boss: boolean } {
  const attempt = Math.max(1, Math.floor(attemptFloor));
  if (power <= 0) return { clears: 0, boss: false };

  let clears = 0;
  for (let f = 1; f <= attempt; f++) {
    const boss = f % 10 === 0;
    const need = dungeonFloorPower(f) * (boss ? 1.35 : 1);
    if (power < need) break; // não passa deste andar
    clears = f;
  }

  const boss = clears % 10 === 0;
  return { clears, boss };
}

/** Fator de retorno decrescente (0..1): durações longas rendem menos item/hora. */
export function dungeonDurationDiminish(hours: number): number {
  if (hours <= 0) return 0;
  // 2h -> 1.0 | 4h -> ~0.5 | 8h -> ~0.25
  return Math.max(0.08, Math.pow(0.5, (hours - 2) / 2));
}

/** Quantos rolls de item a expedição concede (com retorno decrescente). */
export function dungeonItemRolls(clears: number, hours: number): number {
  const dim = dungeonDurationDiminish(hours);
  return Math.max(0, Math.floor((clears / 12) * dim));
}

/** Ordem de raridade (baixa → alta). */
export const DUNGEON_RARITY_ORDER = [
  "common", "uncommon", "rare", "epic",
  "legendary", "mythic", "divine",
] as const;

/** Raridade máxima alcançável conforme a profundidade limpa. */
export function dungeonMaxRarityIdx(clears: number): number {
  if (clears >= 40) return 6; // divine
  if (clears >= 30) return 5; // mythic
  if (clears >= 20) return 4; // legendary
  if (clears >= 10) return 3; // epic
  if (clears >= 5) return 2;  // rare
  return 1;                   // uncommon
}

/**
 * Pool ponderado de raridade para os drops. Raridades baixas dominam; as altas
 * entram com peso reduzido conforme a profundidade, mas nunca saturam.
 * Retorna um array onde a probabilidade de cada tier ≈ (ocorrências / total).
 */
export function dungeonRarityPool(clears: number): string[] {
  const maxIdx = dungeonMaxRarityIdx(clears);
  const counts = [8, 5, 3, 2]; // até o epic
  for (let i = 4; i <= Math.max(4, Math.min(6, maxIdx)); i++) {
    counts[i] = Math.max(1, 6 - Math.floor(i)); // legendary=2, mythic=1, divine=1
  }
  const pool: string[] = [];
  for (let i = 0; i <= Math.min(6, maxIdx); i++) {
    for (let k = 0; k < (counts[i] ?? 0); k++) pool.push(DUNGEON_RARITY_ORDER[i]);
  }
  return pool;
}

/** Faz um roll ponderado dentro do pool de raridade. */
export function dungeonRollRarity(clears: number): string {
  const pool = dungeonRarityPool(clears);
  if (pool.length === 0) return "common";
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Rótulo da melhor raridade alcançável (para exibir a estimativa na UI). */
export function dungeonBestRarity(clears: number): string {
  return DUNGEON_RARITY_ORDER[dungeonMaxRarityIdx(clears)];
}

/** Chave de data local (YYYY-MM-DD) usada para o limite diário. */
export function dungeonDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ouro gerado por masmorra. */
export function dungeonGoldByClears(clears: number): number {
  if (clears <= 0) return 0;
  let sum = 0;
  for (let f = 1; f <= clears; f++) sum += Math.floor(28 + f * 17);
  return sum;
}

/** XP gerado (sem aplicar boost). */
export function dungeonXpByClears(clears: number): number {
  if (clears <= 0) return 0;
  let sum = 0;
  for (let f = 1; f <= clears; f++) sum += Math.floor(15 + f * 13);
  return sum;
}

/** Cristais extras pelo avanço. */
export function dungeonCrystalsByClears(clears: number): number {
  return Math.floor(clears / 18);
}

/** Prêmio extra por vencer o chefe do piso atual. */
export function dungeonBossBonus(): { gold: number; xp: number } {
  return { gold: 180, xp: 120 };
}

/**
 * Total de ouro/XP bruto de uma expedição (sem aplicar boost de XP). Usado
 * tanto na estimativa (preview) quanto na coleta (claim) — nunca divergem.
 */
export function dungeonBaseRewards(clears: number, boss: boolean) {
  const b = dungeonBossBonus();
  return {
    gold: dungeonGoldByClears(clears) + (boss ? b.gold : 0),
    xp: dungeonXpByClears(clears) + (boss ? b.xp : 0),
  };
}

/** Xp final de uma expedição, já com o multiplicador de boost. */
export function dungeonXpEarned(char: any, buysXp: number): number {
  return Math.floor(buysXp * xpMultiplier(char));
}

/** Recompensas de uma expedição concluída (idênticas ao preview). */
export function computeDungeonRewards(char: any, attemptFloor: number, hours: number) {
  const power = Number(char.power) || 0;
  const { clears, boss } = dungeonClears(power, attemptFloor);
  const base = dungeonBaseRewards(clears, boss);
  return {
    power,
    attemptFloor,
    hours,
    clears,
    boss,
    gold: base.gold,
    xpRaw: base.xp,
    xp: dungeonXpEarned(char, base.xp),
    crystals: dungeonCrystalsByClears(clears),
    rolls: dungeonItemRolls(clears, hours),
    bestRarity: dungeonBestRarity(clears),
  };
}

/** Estado consolidado da masmorra para expor à UI (prévia + limites diários). */
export function computeDungeonStatus(char: any, now: Date = new Date()) {
  const stats = char.dungeonStats || {};
  const todayKey = dungeonDateKey(now);
  const used = stats.lastDate === todayKey ? Number(stats.runsToday) || 0 : 0;

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
      elapsedSec,
      remainingSec,
      done,
    };
  }

  const preview = computeDungeonRewards(char, Number(run?.attemptFloor) || 1, Number(run?.hours) || 2);

  return { active, daily, preview, cost: DUNGEON_ENERGY_COST };
}