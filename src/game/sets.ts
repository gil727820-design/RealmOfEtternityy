/**
 * Sistema de SETS de equipamentos 🧩.
 *
 * Como os itens do jogo são gerados por raridade + slot, os sets funcionam por
 * RARIDADE: quanto mais peças equipadas da mesma raridade, maior o bônus.
 *
 *   Set Lendário (3 peças) → +bônus; (5 peças) → +bônus maior; (7 peças) → efeito.
 *
 * Os bônus escalam com o NÍVEL do personagem (pontos = % do nível), então o
 * set nunca fica obsoleto e acompanha o progresso. A lógica é pura (src/game/)
 * e é usada pelas rotas de equipar/forjar/admin — a UI só exibe.
 */

import { equipmentBonus } from "./forge";

export type SetRarity = "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "divine" | "ancestral" | "supreme";

export interface SetTier {
  pieces: number;
  /** % do nível virada em pontos de ataque. */
  attackPct?: number;
  /** % do nível virada em pontos de defesa. */
  defensePct?: number;
  /** % do nível virada em pontos de vida máxima. */
  maxHpPct?: number;
  /** Pontos planos de crítico. */
  critFlat?: number;
}

export interface SetDef {
  rarity: SetRarity;
  nameKey: string;
  icon: string;
  color: string;
  tiers: SetTier[];
}

/** Sets disponíveis — do incomum ao supremo, bônus crescentes. */
export const SET_DEFS: SetDef[] = [
  {
    rarity: "uncommon",
    nameKey: "set.uncommon",
    icon: "🌿",
    color: "#22c55e",
    tiers: [
      { pieces: 3, attackPct: 3, defensePct: 2 },
      { pieces: 5, attackPct: 6, defensePct: 4 },
      { pieces: 7, attackPct: 10, defensePct: 6, maxHpPct: 4 },
    ],
  },
  {
    rarity: "rare",
    nameKey: "set.rare",
    icon: "🔷",
    color: "#3b82f6",
    tiers: [
      { pieces: 3, attackPct: 5, defensePct: 3 },
      { pieces: 5, attackPct: 10, defensePct: 6 },
      { pieces: 7, attackPct: 15, defensePct: 9, critFlat: 5 },
    ],
  },
  {
    rarity: "epic",
    nameKey: "set.epic",
    icon: "🟣",
    color: "#a855f7",
    tiers: [
      { pieces: 3, attackPct: 8, defensePct: 5 },
      { pieces: 5, attackPct: 15, defensePct: 9 },
      { pieces: 7, attackPct: 22, defensePct: 13, critFlat: 8 },
    ],
  },
  {
    rarity: "legendary",
    nameKey: "set.legendary",
    icon: "🟠",
    color: "#f59e0b",
    tiers: [
      { pieces: 3, attackPct: 10, defensePct: 6, critFlat: 3 },
      { pieces: 5, attackPct: 20, defensePct: 12, critFlat: 6 },
      { pieces: 7, attackPct: 30, defensePct: 18, critFlat: 10, maxHpPct: 6 },
    ],
  },
  {
    rarity: "mythic",
    nameKey: "set.mythic",
    icon: "🔴",
    color: "#ef4444",
    tiers: [
      { pieces: 3, attackPct: 12, defensePct: 8, critFlat: 4 },
      { pieces: 5, attackPct: 25, defensePct: 15, critFlat: 8 },
      { pieces: 7, attackPct: 38, defensePct: 22, critFlat: 12, maxHpPct: 8 },
    ],
  },
  {
    rarity: "divine",
    nameKey: "set.divine",
    icon: "✨",
    color: "#eab308",
    tiers: [
      { pieces: 3, attackPct: 15, defensePct: 10, critFlat: 5 },
      { pieces: 5, attackPct: 30, defensePct: 18, critFlat: 10 },
      { pieces: 7, attackPct: 45, defensePct: 26, critFlat: 15, maxHpPct: 10 },
    ],
  },
  {
    rarity: "ancestral",
    nameKey: "set.ancestral",
    icon: "🌌",
    color: "#06b6d4",
    tiers: [
      { pieces: 3, attackPct: 18, defensePct: 12, critFlat: 6 },
      { pieces: 5, attackPct: 35, defensePct: 22, critFlat: 12 },
      { pieces: 7, attackPct: 52, defensePct: 30, critFlat: 18, maxHpPct: 12 },
    ],
  },
  {
    rarity: "supreme",
    nameKey: "set.supreme",
    icon: "👑",
    color: "#ffd700",
    tiers: [
      { pieces: 3, attackPct: 20, defensePct: 14, critFlat: 8 },
      { pieces: 5, attackPct: 40, defensePct: 26, critFlat: 15 },
      { pieces: 7, attackPct: 60, defensePct: 36, critFlat: 22, maxHpPct: 15 },
    ],
  },
];

export function setDefByRarity(rarity: string): SetDef | null {
  return SET_DEFS.find((s) => s.rarity === rarity) ?? null;
}

/** Conta quantas peças EQUIPADAS existem de cada raridade. */
export function countEquippedByRarity(entries: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.template?.type === "consumable") continue;
    const r = String(e.template?.rarity || "common");
    counts[r] = (counts[r] || 0) + 1;
  }
  return counts;
}

/** Bônus do set de uma raridade com N peças equipadas (0 se não atingiu tier). */
export function setTierBonus(def: SetDef, pieces: number, level: number) {
  let active: SetTier | null = null;
  for (const tier of def.tiers) {
    if (pieces >= tier.pieces) active = tier;
  }
  if (!active) return null;
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return {
    attack: Math.round((active.attackPct || 0) * lv / 100),
    defense: Math.round((active.defensePct || 0) * lv / 100),
    maxHp: Math.round((active.maxHpPct || 0) * lv / 100),
    critical: active.critFlat || 0,
    tier: active,
  };
}

export interface SetStatus {
  rarity: string;
  nameKey: string;
  icon: string;
  color: string;
  pieces: number;
  maxPieces: number;
  nextTier: SetTier | null;
  bonus: { attack: number; defense: number; maxHp: number; critical: number } | null;
  tier: SetTier | null;
}

/** Status de TODOS os sets para um conjunto de itens equipados (UI). */
export function setStatuses(entries: any[], level: number): SetStatus[] {
  const counts = countEquippedByRarity(entries);
  return SET_DEFS.map((def) => {
    const pieces = counts[def.rarity] || 0;
    const tierBonus = setTierBonus(def, pieces, level);
    const nextTier = def.tiers.find((t) => pieces < t.pieces) ?? null;
    return {
      rarity: def.rarity,
      nameKey: def.nameKey,
      icon: def.icon,
      color: def.color,
      pieces,
      maxPieces: 7,
      nextTier,
      bonus: tierBonus ? { attack: tierBonus.attack, defense: tierBonus.defense, maxHp: tierBonus.maxHp, critical: tierBonus.critical } : null,
      tier: tierBonus ? tierBonus.tier : null,
    };
  });
}

/** Soma o bônus de TODOS os sets ativos (equipamentos + sets). */
export function totalSetBonus(entries: any[], level: number) {
  const counts = countEquippedByRarity(entries);
  const total = { attack: 0, defense: 0, maxHp: 0, critical: 0 };
  for (const def of SET_DEFS) {
    const b = setTierBonus(def, counts[def.rarity] || 0, level);
    if (b) {
      total.attack += b.attack;
      total.defense += b.defense;
      total.maxHp += b.maxHp;
      total.critical += b.critical;
    }
  }
  return total;
}

/**
 * Soma bônus de equipamento (forja + encanto) + bônus de SETS.
 * Substitui as funções locais `sumEquippedBonuses` das rotas — um único ponto
 * de cálculo para todos os fluxos (equipar, auto-equipar, forjar, admin...).
 */
export function sumEquippedBonusesWithSets(entries: any[], level: number) {
  const total = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
  for (const e of entries) {
    if (e.template?.type === "consumable") continue;
    const b = equipmentBonus(e.template, e.item);
    total.attack += b.attack;
    total.defense += b.defense;
    total.maxHp += b.maxHp;
    total.speed += b.speed;
    total.critical += b.critical;
  }
  const setB = totalSetBonus(entries, level);
  total.attack += setB.attack;
  total.defense += setB.defense;
  total.maxHp += setB.maxHp;
  total.critical += setB.critical;
  return total;
}
