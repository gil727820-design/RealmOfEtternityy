/**
 * RELÍQUIAS 🗿 — artefatos passivos que buffam o personagem.
 *
 * Cada relíquia tem um slot próprio (`relic` no inventário), raridade e um
 * buff permanente enquanto EQUIPADA:
 *   - attack%, defense%, maxHp%, speed, critical, xp%, gold%
 *
 * As relíquias dropam de bosses (regional, mini-boss, torre) e da loja
 * fantasma. O jogador equipa 1 relíquia por vez (slot único).
 *
 * O cálculo dos buffs é feito aqui (lógica pura) e somado nos pontos que
 * usam os atributos (torre, farm, PvP). Também multiplica XP/ouro via
 * boosts.ts (como pets/guilda).
 */

export interface RelicDef {
  id: string;
  nameKey: string;
  icon: string;
  image: string;
  rarity: "rare" | "epic" | "legendary" | "mythic" | "divine";
  /** Buff percentual de ataque. */
  attackPct?: number;
  /** Buff percentual de defesa. */
  defensePct?: number;
  /** Buff percentual de HP máximo. */
  maxHpPct?: number;
  /** +pontos de velocidade. */
  speed?: number;
  /** +pontos de crítico. */
  critical?: number;
  /** Multiplicador de XP ganho. */
  xpMult?: number;
  /** Multiplicador de ouro ganho. */
  goldMult?: number;
}

/** Catálogo de relíquias. */
export const RELICS: RelicDef[] = [
  { id: "relic_ember", nameKey: "relic.ember", icon: "🔥", image: "/images/relics/ember.png", rarity: "rare", attackPct: 4 },
  { id: "relic_glacier", nameKey: "relic.glacier", icon: "🧊", image: "/images/relics/glacier.png", rarity: "rare", defensePct: 5 },
  { id: "relic_heart", nameKey: "relic.heart", icon: "❤️", image: "/images/relics/heart.png", rarity: "rare", maxHpPct: 6 },
  { id: "relic_wind", nameKey: "relic.wind", icon: "💨", image: "/images/relics/wind.png", rarity: "epic", speed: 4 },
  { id: "relic_eye", nameKey: "relic.eye", icon: "👁️", image: "/images/relics/eye.png", rarity: "epic", critical: 4 },
  { id: "relic_wisdom", nameKey: "relic.wisdom", icon: "📜", image: "/images/relics/wisdom.png", rarity: "epic", xpMult: 1.08 },
  { id: "relic_golden", nameKey: "relic.golden", icon: "💰", image: "/images/relics/golden.png", rarity: "epic", goldMult: 1.08 },
  { id: "relic_dragon", nameKey: "relic.dragon", icon: "🐉", image: "/images/relics/dragon.png", rarity: "legendary", attackPct: 8, maxHpPct: 5 },
  { id: "relic_void", nameKey: "relic.void", icon: "🌑", image: "/images/relics/void.png", rarity: "legendary", attackPct: 6, critical: 5 },
  { id: "relic_guardian", nameKey: "relic.guardian", icon: "🛡️", image: "/images/relics/guardian.png", rarity: "legendary", defensePct: 10, maxHpPct: 6 },
  { id: "relic_titan", nameKey: "relic.titan", icon: "🏔️", image: "/images/relics/titan.png", rarity: "mythic", maxHpPct: 15, defensePct: 8, attackPct: 4 },
  { id: "relic_phoenix", nameKey: "relic.phoenix", icon: "🔥", image: "/images/relics/phoenix.png", rarity: "mythic", attackPct: 12, speed: 4, xpMult: 1.05 },
  { id: "relic_eternal", nameKey: "relic.eternal", icon: "⏳", image: "/images/relics/eternal.png", rarity: "divine", attackPct: 10, defensePct: 10, maxHpPct: 10, critical: 5, speed: 3, xpMult: 1.1, goldMult: 1.1 },
];

/** TemplateId no banco (6000 + índice — espelha RELIC_TEMPLATES do seed). */
export function relicTemplateId(relicId: string): number {
  const idx = RELICS.findIndex((r) => r.id === relicId);
  return idx >= 0 ? 6000 + idx : 6000;
}

/** Relíquia equipada do personagem (id do catálogo ou null). */
export function activeRelicId(char: any): string | null {
  const id = char?.activeRelicId;
  return id && typeof id === "string" ? id : null;
}

/** Relíquia equipada (definição) ou null. */
export function activeRelic(char: any): RelicDef | null {
  const id = activeRelicId(char);
  if (!id) return null;
  return RELICS.find((r) => r.id === id) ?? null;
}

/** Multiplicador de XP da relíquia equipada. */
export function relicXpMult(char: any): number {
  return activeRelic(char)?.xpMult ?? 1;
}

/** Multiplicador de ouro da relíquia equipada. */
export function relicGoldMult(char: any): number {
  return activeRelic(char)?.goldMult ?? 1;
}

/** Buffs de combate da relíquia (para somar nos atributos do personagem). */
export function relicCombatBuff(char: any): RelicDef | null {
  return activeRelic(char);
}

/** Aplica os buffs de combate da relíquia sobre um objeto de atributos. */
export function applyRelicCombat(char: any, ca: { attack: number; defense: number; maxHp: number; speed: number; critical: number }) {
  const r = activeRelic(char);
  if (!r) return ca;
  if (r.attackPct) ca.attack = Math.round(ca.attack * (1 + r.attackPct / 100));
  if (r.defensePct) ca.defense = Math.round(ca.defense * (1 + r.defensePct / 100));
  if (r.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + r.maxHpPct / 100));
  if (r.speed) ca.speed = ca.speed + r.speed;
  if (r.critical) ca.critical = Math.min(90, ca.critical + r.critical);
  return ca;
}
