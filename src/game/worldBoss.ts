/*
 * Evento Global — Boss Mundial.
 *
 * Igual à Loja Fantasma no agendamento (abre em horários do dia por um tempo
 * determinado, configuração no painel admin), mas é uma BATALHA conjunta:
 *   - jogadores entram no evento e podem se agrupar em SQUADS (líder + convites)
 *   - todos os participantes atacam o MESMO boss (HP compartilhado, "milhões")
 *   - cada ataque aplica dano ao boss e o boss revida (reduz o HP do jogador,
 *     que regenera automaticamente)
 *   - quando o boss morre, TODOS os participantes recebem recompensas
 *     proporcionais ao dano causado
 *
 * O ESTADO do evento (HP atual, participantes, squads, convites, log) fica em
 * `server_settings.worldBossEvent` e é RESETADO automaticamente a cada nova
 * janela de abertura (novo occurrenceId), sem precisar de cron.
 */
import {
  dailyWindowStatus,
  isValidScheduleTime,
  normalizeScheduleTime,
  type DailyWindowStatus,
} from "./schedule";
import { MAX_LEVEL } from "./constants";

export interface WorldBossStats {
  kind: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  critical: number;
}

export interface WorldBossConfig {
  enabled: boolean;
  /** Horários diários "HH:MM" em que o evento abre. */
  schedule: string[];
  /** Quanto tempo a batalha fica disponível (minutos). */
  durationMinutes: number;
  /** Estatísticas do boss (kind = um chefe da torre, reusa imagem/nome). */
  boss: WorldBossStats;
  /** Recompensas: pools distribuídas pela participação + moedas da torre fixas. */
  rewards: { gold: number; xp: number; towerCoins: number };
  /** Tamanho máximo do squad (líder + convidados). */
  maxSquadSize: number;
  /** Intervalo mínimo entre ataques do mesmo jogador (segundos). */
  attackCooldownSec: number;
  /** Segundos para regenerar 100% do HP do jogador na batalha. */
  regenSec: number;
}

export const DEFAULT_WORLD_BOSS: WorldBossConfig = {
  enabled: false,
  schedule: ["12:00", "18:00", "21:00"],
  durationMinutes: 60,
  boss: {
    kind: "void_wyrm",
    maxHp: 10_000_000,
    attack: 260,
    defense: 120,
    speed: 8,
    critical: 12,
  },
  rewards: { gold: 500_000, xp: 60_000, towerCoins: 1_000 },
  maxSquadSize: 4,
  attackCooldownSec: 5,
  regenSec: 60,
};

/* ─── Estado do evento (persistido em server_settings.worldBossEvent) ─── */

export interface WorldBossParticipant {
  characterId: string;
  name: string;
  level: number;
  classType: string;
  /** Dano total causado pelo jogador ao boss. */
  damageDealt: number;
  hits: number;
  /** HP do jogador DENTRO da batalha (revida do boss). */
  hp: number;
  maxHp: number;
  /** Epoch ms do último ataque (cooldown). */
  lastAttackAt: number;
  joinedAt: string;
}

export interface WorldBossSquad {
  id: string;
  leaderId: string;
  /** characterIds (líder incluso). */
  members: string[];
  /** Convites pendentes: { targetId, at } */
  invites: { targetId: string; at: number }[];
}

export interface WorldBossEventState {
  /** Muda a cada janela — identifica a ocorrência atual do evento. */
  occurrenceId: string;
  windowStart: string;
  windowEnd: string;
  status: "open" | "won" | "ended";
  bossHp: number;
  bossMaxHp: number;
  totalDamage: number;
  participants: Record<string, WorldBossParticipant>;
  squads: WorldBossSquad[];
  log: string[];
  rewardsGiven: boolean;
}

export function sanitizeWorldBossConfig(raw: unknown): WorldBossConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WORLD_BOSS };
  const g = raw as Record<string, unknown>;
  const b = (g.boss || {}) as Record<string, unknown>;

  const num = (v: unknown, d: number, min = 0, max = Infinity) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : d;
  };

  const schedule: string[] = Array.isArray(g.schedule)
    ? g.schedule.filter(isValidScheduleTime).map(normalizeScheduleTime)
    : [];

  return {
    enabled: !!g.enabled,
    schedule: Array.from(new Set(schedule)).sort(),
    durationMinutes: num(g.durationMinutes, 60, 1, 24 * 60),
    boss: {
      kind: String(b.kind || DEFAULT_WORLD_BOSS.boss.kind),
      maxHp: num(b.maxHp, 10_000_000, 100_000, 2_000_000_000),
      attack: num(b.attack, 260, 1, 100_000),
      defense: num(b.defense, 120, 0, 100_000),
      speed: num(b.speed, 8, 0, 1000),
      critical: num(b.critical, 12, 0, 100),
    },
    rewards: {
      gold: num((g.rewards as Record<string, unknown>)?.gold, 500_000, 0),
      xp: num((g.rewards as Record<string, unknown>)?.xp, 60_000, 0),
      towerCoins: num((g.rewards as Record<string, unknown>)?.towerCoins, 1_000, 0),
    },
    maxSquadSize: Math.max(2, num(g.maxSquadSize, 4, 2, 20)),
    attackCooldownSec: num(g.attackCooldownSec, 5, 1, 3600),
    regenSec: num(g.regenSec, 60, 5, 3600),
  };
}

/** Estado do evento para a janela ATUAL (ou null se o evento não estiver aberto). */
export function freshWorldBossEvent(cfg: WorldBossConfig, status: DailyWindowStatus): WorldBossEventState {
  return {
    occurrenceId: `wb_${new Date(status.startsAt as string).getTime()}`,
    windowStart: status.startsAt as string,
    windowEnd: status.endsAt as string,
    status: "open",
    bossHp: cfg.boss.maxHp,
    bossMaxHp: cfg.boss.maxHp,
    totalDamage: 0,
    participants: {},
    squads: [],
    log: [`👹 O Boss Mundial apareceu! Reúna sua squad e derrube-o!`],
    rewardsGiven: false,
  };
}

/**
 * Garante que o estado persistido corresponde à janela ATUAL; se não (ou se não
 * existir), devolve um estado novo (reset automático a cada abertura).
 */
export function ensureWorldBossEvent(
  cfg: WorldBossConfig,
  saved: WorldBossEventState | null,
  now = new Date()
): { status: DailyWindowStatus; event: WorldBossEventState | null; reset: boolean } {
  const status = dailyWindowStatus(cfg.schedule, cfg.durationMinutes, now);
  if (!cfg.enabled || !status.open || !status.startsAt || !status.endsAt) {
    return { status, event: null, reset: false };
  }
  const fresh = freshWorldBossEvent(cfg, status);
  if (!saved || saved.occurrenceId !== fresh.occurrenceId) {
    return { status, event: fresh, reset: true };
  }
  return { status, event: saved, reset: false };
}

/* ─── Combate ─── */

/** Dano de um ataque do jogador (baseado em ataque/nível, com crítico e variação). */
export function computePlayerDamage(
  char: { attack?: number; level?: number; critical?: number },
  cfg: WorldBossConfig
): { damage: number; crit: boolean } {
  const attack = Number(char.attack) || 1;
  const level = Number(char.level) || 1;
  const critChance = Number(char.critical) || 0;
  const crit = Math.random() * 100 < critChance;
  const base = attack * 60 + level * 150;
  const variance = 0.85 + Math.random() * 0.3;
  const dmg = Math.max(1, Math.floor(base * (crit ? 2.2 : 1) * variance));
  return { damage: dmg, crit };
}

/** Dano que o boss causa no jogador (revide). */
export function computeBossHit(
  cfg: WorldBossConfig,
  playerDefense = 0
): { damage: number; crit: boolean } {
  const variance = 0.85 + Math.random() * 0.3;
  const crit = Math.random() * 100 < (cfg.boss.critical || 0);
  const base = Math.max(1, (cfg.boss.attack || 100) - Number(playerDefense) * 0.4);
  return { damage: Math.max(1, Math.floor(base * (crit ? 1.8 : 1) * variance)), crit };
}

/** Formata números grandes (ex.: 12.4M, 850K). */
export function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return String(Math.floor(n));
}

/* ─── Level up (recompensas) ─── */

/**
 * Aplica XP e faz os level-ups pendentes, devolvendo o patch para updateCharacter
 * (mesmo padrão do resgate de missões).
 */
export function applyXp(
  char: { xp?: number; level?: number; xpToNext?: number; unspentStatPoints?: number; skillPoints?: number },
  xpGain: number,
  maxLevel = MAX_LEVEL
): { patch: Record<string, number>; newLevel: number } {
  const xpForLevel = (lv: number) => Math.floor(165 * Math.pow(1.18, lv - 1));
  let xp = (char.xp || 0) + Math.floor(xpGain);
  let level = char.level || 1;
  let xpToNext = char.xpToNext || 100;
  let statPoints = char.unspentStatPoints || 0;
  let skillPoints = char.skillPoints || 0;

  while (level < maxLevel && xp >= xpToNext) {
    xp -= xpToNext;
    level++;
    xpToNext = xpForLevel(level);
    statPoints += 3;
    if (level % 3 === 0) skillPoints += 1;
  }

  return {
    patch: { xp, level, xpToNext, unspentStatPoints: statPoints, skillPoints },
    newLevel: level,
  };
}
