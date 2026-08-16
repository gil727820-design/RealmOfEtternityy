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
import { randomUUID } from "crypto";

export { randomUUID };

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
  /** Imagem personalizada do boss (caminho /images/...). Vazio = moeda da torre. */
  bossImage?: string;
  /** Recompensas: pools distribuídas pela participação + moedas da torre fixas. */
  rewards: { gold: number; xp: number; towerCoins: number };
  /** Tamanho máximo do squad (líder + convidados). */
  maxSquadSize: number;
  /** Intervalo mínimo entre ataques do mesmo jogador (segundos). */
  attackCooldownSec: number;
  /** Segundos para regenerar 100% do HP do jogador na batalha. */
  regenSec: number;
  /** Segundos para um jogador morto na batalha RENASCER (respaw) com HP cheio. */
  respawnSec: number;
  /** Escudo por fases de HP (75%, 50%, 25% restante) — boss imune até comprarem quebra-escudo. */
  shield: {
    enabled: boolean;
    /** Thresholds (fracão do HP restante) em que o escudo aparece. */
    thresholds: number[];
    /** Quanto tempo o escudo dura sozinho (s) antes de sumir e spawnar mobs. */
    durationSec: number;
    /** Custo do quebra-escudo comprado pelo jogador. */
    breakCost: { currency: "gold" | "diamonds"; amount: number };
  };
  /** Mobs que o boss spawna quando o escudo SOME (via compra ou por expirar). */
  spawnMobs: {
    enabled: boolean;
    /** kinds de monstros da torre que podem spawnar. */
    kinds: string[];
    /** HP de cada mob. */
    hp: number;
    /** Quantos mobs spawnam por vez. */
    count: number;
    /** Recompensa para QUEM matar o mob (ouro/XP). */
    reward: { gold: number; xp: number };
  };
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
  bossImage: "",
  rewards: { gold: 500_000, xp: 60_000, towerCoins: 1_000 },
  maxSquadSize: 4,
  attackCooldownSec: 5,
  regenSec: 60,
  respawnSec: 10,
  shield: {
    enabled: true,
    thresholds: [0.75, 0.5, 0.25],
    durationSec: 180,
    breakCost: { currency: "diamonds", amount: 50 },
  },
  spawnMobs: {
    enabled: true,
    kinds: ["dragao"],
    hp: 4_000_000,
    count: 2,
    reward: { gold: 100_000, xp: 15_000 },
  },
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
  /** Epoch ms em que o jogador MORREU na batalha (null = vivo). Usado para o respawn. */
  deadAt: number | null;
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

/** Um mob spawnado pelo boss enquanto o escudo some. */
export interface WorldBossMob {
  id: string;
  kind: string;
  maxHp: number;
  hp: number;
  /** Dano total recebido pelo mob (para a recompensa ser proporcional). */
  damageDone: number;
  /** Dano causado por cada jogador (proporcional para reward). */
  damageBy: Record<string, number>;
  spawnedAt: string;
  killerName?: string;
  rewardGiven: boolean;
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
  /** Escudo por fases de HP (75/50/25). */
  shieldActive: boolean;
  shieldPhaseAt?: string | null;
  /** threshold (fracao) em que o escudo atual apareceu. */
  shieldThreshold?: number;
  shieldExpiresAt?: number;
  /** Thresholds que JÁ foram acionados (evita reactivar o mesmo). */
  shieldThresholdsHit?: number[];
  /** Mobs spawnados pelo boss. */
  mobs: WorldBossMob[];
  /** Quando os mobs foram spawnados (para expirar sozinhos). */
  mobsSpawnedAt?: number;
}

export function sanitizeWorldBossConfig(raw: unknown): WorldBossConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WORLD_BOSS };
  const g = raw as Record<string, unknown>;
  const b = (g.boss || {}) as Record<string, unknown>;
  const sh = (g.shield || {}) as Record<string, unknown>;
  const shCost = (sh.breakCost || {}) as Record<string, unknown>;
  const mobs = (g.spawnMobs || {}) as Record<string, unknown>;
  const mobReward = (mobs.reward || {}) as Record<string, unknown>;

  const num = (v: unknown, d: number, min = 0, max = Infinity) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : d;
  };

  const schedule: string[] = Array.isArray(g.schedule)
    ? g.schedule.filter(isValidScheduleTime).map(normalizeScheduleTime)
    : [];

  const thresholds: number[] = (Array.isArray(sh.thresholds) ? sh.thresholds : [0.75, 0.5, 0.25])
    .map((t) => {
      const n = Number(t);
      return Number.isFinite(n) && n > 0 && n <= 1 ? n : NaN;
    })
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  const kinds: string[] = (Array.isArray(mobs.kinds) ? mobs.kinds : []).filter((k) => typeof k === "string").slice(0, 20);

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
    bossImage: typeof g.bossImage === "string" ? g.bossImage : "",
    rewards: {
      gold: num((g.rewards as Record<string, unknown>)?.gold, 500_000, 0),
      xp: num((g.rewards as Record<string, unknown>)?.xp, 60_000, 0),
      towerCoins: num((g.rewards as Record<string, unknown>)?.towerCoins, 1_000, 0),
    },
    maxSquadSize: Math.max(2, num(g.maxSquadSize, 4, 2, 20)),
    attackCooldownSec: num(g.attackCooldownSec, 5, 1, 3600),
    regenSec: num(g.regenSec, 60, 5, 3600),
    respawnSec: num(g.respawnSec, 10, 1, 600),
    shield: {
      enabled: !!sh.enabled,
      thresholds: thresholds.length ? thresholds : [0.75, 0.5, 0.25],
      durationSec: num(sh.durationSec, 180, 10, 3600),
      breakCost: {
        currency: shCost.currency === "diamonds" ? "diamonds" : "gold",
        amount: num(shCost.amount, 50, 1, 100_000_000),
      },
    },
    spawnMobs: {
      enabled: !!mobs.enabled,
      kinds: kinds.length ? kinds : (mobs.enabled ? ["dragao"] : []),
      hp: num(mobs.hp, 4_000_000, 100_000, 2_000_000_000),
      count: Math.min(12, Math.max(0, num(mobs.count, 2, 0, 12))),
      reward: {
        gold: num(mobReward.gold, 100_000, 0),
        xp: num(mobReward.xp, 15_000, 0),
      },
    },
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
    shieldActive: false,
    shieldPhaseAt: null,
    shieldThreshold: undefined,
    shieldExpiresAt: undefined,
    shieldThresholdsHit: [],
    mobs: [],
    mobsSpawnedAt: undefined,
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

/* ─── Fases de enfurecimento (evolução do boss) ─── */

/**
 * Fase de enfurecimento do boss com base no HP restante (0–1):
 *  - Fase 1: 76%–100% — normal
 *  - Fase 2: 51%–75%  — +15% dano, +10% velocidade
 *  - Fase 3: 26%–50%  — +35% dano, +15% velocidade, +5% crítico
 *  - Fase 4: 0%–25%   — ENFURECIDO: +60% dano, +20% velocidade, +10% crítico
 */
export function worldBossPhase(hpPct: number): {
  phase: number;
  nameKey: string;
  attackMult: number;
  speedBonus: number;
  critBonus: number;
} {
  const n = Number(hpPct);
  const pct = Math.max(0, Math.min(1, Number.isFinite(n) ? n : 1));
  if (pct <= 0.25) {
    return { phase: 4, nameKey: "worldBoss.phase4", attackMult: 1.6, speedBonus: 20, critBonus: 10 };
  }
  if (pct <= 0.5) {
    return { phase: 3, nameKey: "worldBoss.phase3", attackMult: 1.35, speedBonus: 15, critBonus: 5 };
  }
  if (pct <= 0.75) {
    return { phase: 2, nameKey: "worldBoss.phase2", attackMult: 1.15, speedBonus: 10, critBonus: 0 };
  }
  return { phase: 1, nameKey: "worldBoss.phase1", attackMult: 1, speedBonus: 0, critBonus: 0 };
}

/** Dano que o boss causa no jogador (revide) — PROPORCIONAL ao HP do jogador:
 * sem defesa ~12% do HP máximo por golpe; defesa alta reduz até ~2-4%.
 * Assim o boss é ameaçador em qualquer nível (não fica em "1" com defesa alta). */
export function computeBossHit(
  cfg: WorldBossConfig,
  player: { defense?: number; maxHp?: number } = {}
): { damage: number; crit: boolean } {
  const maxHp = Math.max(1, Number(player.maxHp) || 100);
  const def = Math.max(0, Number(player.defense) || 0);
  // Mitigação: defesa igual ao ataque do boss corta o dano pela metade (~6% HP).
  const mit = 1 - Math.min(0.9, def / (def + (cfg.boss.attack || 100)));
  const pct = Math.max(0.025, 0.12 * mit);
  const variance = 0.85 + Math.random() * 0.3;
  const crit = Math.random() * 100 < (cfg.boss.critical || 0);
  const dmg = Math.max(1, Math.floor(maxHp * pct * (crit ? 1.5 : 1) * variance));
  return { damage: dmg, crit };
}

/** Formata números grandes (ex.: 12.4M, 850K). */
export function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return String(Math.floor(n));
}

/**
 * Próxima abertura agendada a partir de `from`, mesmo que exista uma janela
 * aberta agora (usado quando o boss foi derrotado e queremos avisar quando
 * será o próximo evento). Retorna ISO ou null.
 */
export function nextWorldBossOpening(cfg: WorldBossConfig, from: Date = new Date()): string | null {
  const clean = (cfg.schedule || []).filter(isValidScheduleTime).map(normalizeScheduleTime).sort();
  const t = from.getTime();
  let next: number | null = null;
  for (const hhmm of clean) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(from);
    d.setHours(h, m, 0, 0);
    let start = d.getTime();
    if (start <= t) start += 24 * 3600_000;
    if (next === null || start < next) next = start;
  }
  return next !== null ? new Date(next).toISOString() : null;
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
