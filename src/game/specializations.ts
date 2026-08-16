/**
 * ESPECIALIZAÇÕES DE CLASSE 🎯 — caminhos de poder por classe.
 *
 * Cada classe tem 3 especializações (arquétipos com tema próprio). O jogador
 * escolhe UMA e pode trocar pagando ouro. Cada especialização dá:
 *   - Bônus passivos permanentes (dano, defesa, HP, crítico, velocidade...)
 *   - Uma mecânica especial (ex.: cura por golpe, bônus de mana, etc.)
 *
 * Guardado no personagem: `specialization: { id, chosenAt }`.
 * O servidor valida a troca (nível mínimo + custo em ouro) — anti-cheat.
 */

import type { ClassName } from "./constants";

export interface SpecializationDef {
  id: string;
  /** Classe dona. */
  cls: ClassName;
  nameKey: string;
  descKey: string;
  icon: string;
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
  /** Mecânica especial (para exibição e futuras integrações). */
  mechanic: string;
}

/** Custo (ouro) e nível mínimo para trocar de especialização. */
export const SPEC_CHANGE_COST = 100000;
export const SPEC_MIN_LEVEL = 20;

/** Especializações por classe (3 cada). */
export const SPECIALIZATIONS: SpecializationDef[] = [
  // Guerreiro
  { id: "war_gladiator", cls: "warrior", nameKey: "spec.war_gladiator", descKey: "spec.war_gladiator.desc", icon: "🗡️", attackPct: 12, mechanic: "spec.mech.attack" },
  { id: "war_guardian", cls: "warrior", nameKey: "spec.war_guardian", descKey: "spec.war_guardian.desc", icon: "🛡️", defensePct: 15, maxHpPct: 10, mechanic: "spec.mech.tank" },
  { id: "war_berserker", cls: "warrior", nameKey: "spec.war_berserker", descKey: "spec.war_berserker.desc", icon: "⚡", attackPct: 8, critical: 8, speed: 3, mechanic: "spec.mech.crit" },
  // Paladino
  { id: "pal_crusader", cls: "paladin", nameKey: "spec.pal_crusader", descKey: "spec.pal_crusader.desc", icon: "⚔️", attackPct: 10, maxHpPct: 6, mechanic: "spec.mech.attack" },
  { id: "pal_protector", cls: "paladin", nameKey: "spec.pal_protector", descKey: "spec.pal_protector.desc", icon: "🛡️", defensePct: 18, maxHpPct: 8, mechanic: "spec.mech.tank" },
  { id: "pal_inquisitor", cls: "paladin", nameKey: "spec.pal_inquisitor", descKey: "spec.pal_inquisitor.desc", icon: "🔥", attackPct: 8, critical: 5, goldMult: 1.1, mechanic: "spec.mech.gold" },
  // Berserker
  { id: "ber_frenzy", cls: "berserker", nameKey: "spec.ber_frenzy", descKey: "spec.ber_frenzy.desc", icon: "💥", attackPct: 15, critical: 4, mechanic: "spec.mech.attack" },
  { id: "ber_warleader", cls: "berserker", nameKey: "spec.ber_warleader", descKey: "spec.ber_warleader.desc", icon: "👑", maxHpPct: 12, defensePct: 8, xpMult: 1.05, mechanic: "spec.mech.xp" },
  { id: "ber_bloodaxe", cls: "berserker", nameKey: "spec.ber_bloodaxe", descKey: "spec.ber_bloodaxe.desc", icon: "🪓", attackPct: 10, critical: 8, mechanic: "spec.mech.crit" },
  // Mago
  { id: "mag_archmage", cls: "mage", nameKey: "spec.mag_archmage", descKey: "spec.mag_archmage.desc", icon: "🔮", attackPct: 14, critical: 3, mechanic: "spec.mech.attack" },
  { id: "mag_elementalist", cls: "mage", nameKey: "spec.mag_elementalist", descKey: "spec.mag_elementalist.desc", icon: "🌪️", speed: 6, attackPct: 6, mechanic: "spec.mech.speed" },
  { id: "mag_voidwalker", cls: "mage", nameKey: "spec.mag_voidwalker", descKey: "spec.mag_voidwalker.desc", icon: "🌑", attackPct: 8, maxHpPct: 8, xpMult: 1.08, mechanic: "spec.mech.xp" },
  // Necromante
  { id: "nec_deathlord", cls: "necromancer", nameKey: "spec.nec_deathlord", descKey: "spec.nec_deathlord.desc", icon: "💀", attackPct: 12, maxHpPct: 6, mechanic: "spec.mech.attack" },
  { id: "nec_lich", cls: "necromancer", nameKey: "spec.nec_lich", descKey: "spec.nec_lich.desc", icon: "🕯️", attackPct: 6, critical: 8, speed: 3, mechanic: "spec.mech.crit" },
  { id: "nec_bloodmage", cls: "necromancer", nameKey: "spec.nec_bloodmage", descKey: "spec.nec_bloodmage.desc", icon: "🩸", maxHpPct: 14, defensePct: 6, mechanic: "spec.mech.tank" },
  // Assassino
  { id: "ass_shadow", cls: "assassin", nameKey: "spec.ass_shadow", descKey: "spec.ass_shadow.desc", icon: "🌙", critical: 10, attackPct: 6, mechanic: "spec.mech.crit" },
  { id: "ass_executioner", cls: "assassin", nameKey: "spec.ass_executioner", descKey: "spec.ass_executioner.desc", icon: "⚰️", attackPct: 14, mechanic: "spec.mech.attack" },
  { id: "ass_nightblade", cls: "assassin", nameKey: "spec.ass_nightblade", descKey: "spec.ass_nightblade.desc", icon: "🌑", critical: 6, speed: 6, mechanic: "spec.mech.speed" },
  // Caçador
  { id: "hun_beastmaster", cls: "hunter", nameKey: "spec.hun_beastmaster", descKey: "spec.hun_beastmaster.desc", icon: "🐺", attackPct: 8, maxHpPct: 8, mechanic: "spec.mech.attack" },
  { id: "hun_sniper", cls: "hunter", nameKey: "spec.hun_sniper", descKey: "spec.hun_sniper.desc", icon: "🎯", critical: 12, attackPct: 4, mechanic: "spec.mech.crit" },
  { id: "hun_trapper", cls: "hunter", nameKey: "spec.hun_trapper", descKey: "spec.hun_trapper.desc", icon: "🪤", defensePct: 12, speed: 4, goldMult: 1.08, mechanic: "spec.mech.gold" },
  // Monge
  { id: "mon_ironfist", cls: "monk", nameKey: "spec.mon_ironfist", descKey: "spec.mon_ironfist.desc", icon: "🥊", attackPct: 12, speed: 3, mechanic: "spec.mech.attack" },
  { id: "mon_guardian", cls: "monk", nameKey: "spec.mon_guardian", descKey: "spec.mon_guardian.desc", icon: "🧘", defensePct: 16, maxHpPct: 8, mechanic: "spec.mech.tank" },
  { id: "mon_windwalker", cls: "monk", nameKey: "spec.mon_windwalker", descKey: "spec.mon_windwalker.desc", icon: "💨", speed: 10, attackPct: 4, mechanic: "spec.mech.speed" },
  // Samurai
  { id: "sam_ronin", cls: "samurai", nameKey: "spec.sam_ronin", descKey: "spec.sam_ronin.desc", icon: "🍶", attackPct: 14, mechanic: "spec.mech.attack" },
  { id: "sam_katana", cls: "samurai", nameKey: "spec.sam_katana", descKey: "spec.sam_katana.desc", icon: "⚔️", critical: 10, attackPct: 4, mechanic: "spec.mech.crit" },
  { id: "sam_shogun", cls: "samurai", nameKey: "spec.sam_shogun", descKey: "spec.sam_shogun.desc", icon: "🏯", defensePct: 10, maxHpPct: 10, xpMult: 1.05, mechanic: "spec.mech.tank" },
  // Cavaleiro
  { id: "kni_champion", cls: "knight", nameKey: "spec.kni_champion", descKey: "spec.kni_champion.desc", icon: "🏆", attackPct: 10, maxHpPct: 6, mechanic: "spec.mech.attack" },
  { id: "kni_bulwark", cls: "knight", nameKey: "spec.kni_bulwark", descKey: "spec.kni_bulwark.desc", icon: "🏰", defensePct: 20, maxHpPct: 10, mechanic: "spec.mech.tank" },
  { id: "kni_cavalier", cls: "knight", nameKey: "spec.kni_cavalier", descKey: "spec.kni_cavalier.desc", icon: "🐴", speed: 6, attackPct: 6, mechanic: "spec.mech.speed" },
  // Invocador
  { id: "sum_master", cls: "summoner", nameKey: "spec.sum_master", descKey: "spec.sum_master.desc", icon: "🔮", attackPct: 12, mechanic: "spec.mech.attack" },
  { id: "sum_spirit", cls: "summoner", nameKey: "spec.sum_spirit", descKey: "spec.sum_spirit.desc", icon: "👻", maxHpPct: 10, speed: 4, mechanic: "spec.mech.speed" },
  { id: "sum_chaos", cls: "summoner", nameKey: "spec.sum_chaos", descKey: "spec.sum_chaos.desc", icon: "🌀", critical: 8, attackPct: 6, mechanic: "spec.mech.crit" },
  // Templário
  { id: "tem_holy", cls: "templar", nameKey: "spec.tem_holy", descKey: "spec.tem_holy.desc", icon: "✝️", attackPct: 10, maxHpPct: 8, mechanic: "spec.mech.attack" },
  { id: "tem_sentinel", cls: "templar", nameKey: "spec.tem_sentinel", descKey: "spec.tem_sentinel.desc", icon: "🛡️", defensePct: 18, maxHpPct: 6, mechanic: "spec.mech.tank" },
  { id: "tem_zealot", cls: "templar", nameKey: "spec.tem_zealot", descKey: "spec.tem_zealot.desc", icon: "🔥", critical: 6, attackPct: 8, goldMult: 1.05, mechanic: "spec.mech.crit" },
  // Arqueiro
  { id: "arc_marksman", cls: "archer", nameKey: "spec.arc_marksman", descKey: "spec.arc_marksman.desc", icon: "🎯", critical: 12, attackPct: 6, mechanic: "spec.mech.crit" },
  { id: "arc_ranger", cls: "archer", nameKey: "spec.arc_ranger", descKey: "spec.arc_ranger.desc", icon: "🏹", speed: 8, attackPct: 4, mechanic: "spec.mech.speed" },
  { id: "arc_hawkeye", cls: "archer", nameKey: "spec.arc_hawkeye", descKey: "spec.arc_hawkeye.desc", icon: "🦅", attackPct: 10, critical: 4, xpMult: 1.05, mechanic: "spec.mech.xp" },
];

/** Especializações disponíveis para uma classe. */
export function specsForClass(cls: ClassName | string): SpecializationDef[] {
  return SPECIALIZATIONS.filter((s) => s.cls === cls);
}

/** Especialização atual do personagem (definição ou null). */
export function activeSpecialization(char: any): SpecializationDef | null {
  const id = char?.specialization?.id;
  if (!id) return null;
  return SPECIALIZATIONS.find((s) => s.id === id) ?? null;
}

/** Multiplicador de XP da especialização. */
export function specXpMult(char: any): number {
  return activeSpecialization(char)?.xpMult ?? 1;
}

/** Multiplicador de ouro da especialização. */
export function specGoldMult(char: any): number {
  return activeSpecialization(char)?.goldMult ?? 1;
}

/** Aplica os buffs de combate da especialização sobre os atributos. */
export function applySpecializationCombat(char: any, ca: { attack: number; defense: number; maxHp: number; speed: number; critical: number }) {
  const s = activeSpecialization(char);
  if (!s) return ca;
  if (s.attackPct) ca.attack = Math.round(ca.attack * (1 + s.attackPct / 100));
  if (s.defensePct) ca.defense = Math.round(ca.defense * (1 + s.defensePct / 100));
  if (s.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + s.maxHpPct / 100));
  if (s.speed) ca.speed = ca.speed + s.speed;
  if (s.critical) ca.critical = Math.min(90, ca.critical + s.critical);
  return ca;
}
