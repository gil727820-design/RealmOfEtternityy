/**
 * CLASSES AVANÇADAS 🌟 — a evolução definitiva da classe.
 *
 * Ao atingir o nível 50, o jogador pode EVOLUIR a classe para a versão
 * avançada (ex.: Guerreiro → Senhor da Guerra, Mago → Arquimago). A evolução:
 *   - Dá buffs passivos fortes (dano, defesa, HP, crítico, velocidade)
 *   - Dá uma MECÂNICA exclusiva (golpe poderoso turbinado, cura, etc.)
 *   - Dá +XP e +ouro permanentes
 *   - Muda o nome/visual exibido (mantém a classe base para compatibilidade)
 *
 * Guardado no personagem: `advancedClass: { id, evolvedAt }`.
 * O servidor valida o requisito (nível 50+, custo em ouro/diamantes) — anti-cheat.
 */

import type { ClassName } from "./constants";

export interface AdvancedClassDef {
  id: string;
  /** Classe base dona. */
  cls: ClassName;
  nameKey: string;
  descKey: string;
  icon: string;
  /** Requisito de nível para evoluir. */
  minLevel: number;
  /** Custo em ouro. */
  goldCost: number;
  /** Custo em diamantes (moeda premium). */
  diamondCost: number;
  /** Buffs percentuais. */
  attackPct?: number;
  defensePct?: number;
  maxHpPct?: number;
  critical?: number;
  speed?: number;
  /** Multiplicador de XP ganho. */
  xpMult?: number;
  /** Multiplicador de ouro ganho. */
  goldMult?: number;
  /** Bônus de dano do golpe poderoso (multiplica o dmgMult da classe). */
  skillDmgMult?: number;
  /** Mecânica especial (para exibição). */
  mechanic: string;
}

/** Nível mínimo para evoluir a classe. */
export const ADVANCED_MIN_LEVEL = 50;

/** Classes avançadas (1 por classe base). */
export const ADVANCED_CLASSES: AdvancedClassDef[] = [
  { id: "war_warlord", cls: "warrior", nameKey: "adv.war.warlord", descKey: "adv.war.warlord.desc", icon: "👑", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 15, maxHpPct: 10, skillDmgMult: 1.2, mechanic: "adv.mech.skill" },
  { id: "pal_holyknight", cls: "paladin", nameKey: "adv.pal.holyknight", descKey: "adv.pal.holyknight.desc", icon: "⚜️", minLevel: 50, goldCost: 250_000, diamondCost: 50, defensePct: 18, maxHpPct: 12, goldMult: 1.15, mechanic: "adv.mech.tank" },
  { id: "ber_bloodlord", cls: "berserker", nameKey: "adv.ber.bloodlord", descKey: "adv.ber.bloodlord.desc", icon: "🩸", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 20, critical: 6, skillDmgMult: 1.25, mechanic: "adv.mech.skill" },
  { id: "mag_archmage", cls: "mage", nameKey: "adv.mag.archmage", descKey: "adv.mag.archmage.desc", icon: "🔮", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 16, critical: 4, xpMult: 1.15, mechanic: "adv.mech.xp" },
  { id: "nec_lichking", cls: "necromancer", nameKey: "adv.nec.lichking", descKey: "adv.nec.lichking.desc", icon: "💀", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 14, maxHpPct: 10, goldMult: 1.1, mechanic: "adv.mech.gold" },
  { id: "ass_shadowlord", cls: "assassin", nameKey: "adv.ass.shadowlord", descKey: "adv.ass.shadowlord.desc", icon: "🌑", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 12, critical: 12, speed: 5, mechanic: "adv.mech.crit" },
  { id: "hun_beastking", cls: "hunter", nameKey: "adv.hun.beastking", descKey: "adv.hun.beastking.desc", icon: "🐺", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 12, critical: 8, speed: 4, mechanic: "adv.mech.crit" },
  { id: "mon_grandmaster", cls: "monk", nameKey: "adv.mon.grandmaster", descKey: "adv.mon.grandmaster.desc", icon: "🧘", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 12, defensePct: 12, maxHpPct: 8, skillDmgMult: 1.15, mechanic: "adv.mech.skill" },
  { id: "sam_shogun", cls: "samurai", nameKey: "adv.sam.shogun", descKey: "adv.sam.shogun.desc", icon: "🏯", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 14, critical: 8, skillDmgMult: 1.2, mechanic: "adv.mech.skill" },
  { id: "kni_highlord", cls: "knight", nameKey: "adv.kni.highlord", descKey: "adv.kni.highlord.desc", icon: "🛡️", minLevel: 50, goldCost: 250_000, diamondCost: 50, defensePct: 20, maxHpPct: 15, goldMult: 1.1, mechanic: "adv.mech.tank" },
  { id: "sum_archsummoner", cls: "summoner", nameKey: "adv.sum.archsummoner", descKey: "adv.sum.archsummoner.desc", icon: "✨", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 15, maxHpPct: 8, xpMult: 1.12, mechanic: "adv.mech.xp" },
  { id: "tem_archangel", cls: "templar", nameKey: "adv.tem.archangel", descKey: "adv.tem.archangel.desc", icon: "😇", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 12, defensePct: 14, maxHpPct: 10, xpMult: 1.1, mechanic: "adv.mech.tank" },
  { id: "arc_skywarden", cls: "archer", nameKey: "adv.arc.skywarden", descKey: "adv.arc.skywarden.desc", icon: "🦅", minLevel: 50, goldCost: 250_000, diamondCost: 50, attackPct: 14, critical: 10, skillDmgMult: 1.2, mechanic: "adv.mech.skill" },
];

/** Classe avançada da classe base do personagem (definição ou null). */
export function advancedClassForClass(cls: ClassName | string): AdvancedClassDef | null {
  return ADVANCED_CLASSES.find((a) => a.cls === cls) ?? null;
}

/** Classe avançada atual do personagem (definição ou null). */
export function activeAdvancedClass(char: any): AdvancedClassDef | null {
  const id = char?.advancedClass?.id;
  if (!id) return null;
  return ADVANCED_CLASSES.find((a) => a.id === id) ?? null;
}

/** Multiplicador de XP da classe avançada. */
export function advXpMult(char: any): number {
  return activeAdvancedClass(char)?.xpMult ?? 1;
}

/** Multiplicador de ouro da classe avançada. */
export function advGoldMult(char: any): number {
  return activeAdvancedClass(char)?.goldMult ?? 1;
}

/** Multiplicador do golpe poderoso da classe avançada. */
export function advSkillDmgMult(char: any): number {
  return activeAdvancedClass(char)?.skillDmgMult ?? 1;
}

/** Aplica os buffs de combate da classe avançada sobre os atributos. */
export function applyAdvancedClassCombat(char: any, ca: { attack: number; defense: number; maxHp: number; speed: number; critical: number }) {
  const a = activeAdvancedClass(char);
  if (!a) return ca;
  if (a.attackPct) ca.attack = Math.round(ca.attack * (1 + a.attackPct / 100));
  if (a.defensePct) ca.defense = Math.round(ca.defense * (1 + a.defensePct / 100));
  if (a.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + a.maxHpPct / 100));
  if (a.speed) ca.speed = ca.speed + a.speed;
  if (a.critical) ca.critical = Math.min(90, ca.critical + a.critical);
  return ca;
}

/**
 * Valida e monta o patch de evolução (nível, custos). Retorna o patch a ser
 * salvo no personagem ou { error }.
 */
export function evolveAdvancedClass(char: any): { patch: any } | { error: string } {
  const def = advancedClassForClass(char?.classType || "warrior");
  if (!def) return { error: "Sua classe não tem evolução disponível" };
  if ((Number(char.level) || 0) < def.minLevel) {
    return { error: `Requer nível ${def.minLevel}+ para evoluir a classe` };
  }
  const gold = Number(char.gold) || 0;
  const diamonds = Number(char.diamonds) || 0;
  if (gold < def.goldCost) return { error: `Requer ${def.goldCost.toLocaleString()} de ouro` };
  if (diamonds < def.diamondCost) return { error: `Requer ${def.diamondCost} diamantes` };
  return {
    patch: {
      gold: gold - def.goldCost,
      diamonds: diamonds - def.diamondCost,
      advancedClass: { id: def.id, evolvedAt: new Date().toISOString() },
    },
  };
}
