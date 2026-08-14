import type { ClassName } from "./constants";
import { skillTreeForClass } from "./skillTree";

/**
 * MAESTRIA DA CLASSE — o "capstone" da Árvore de Habilidades.
 *
 * Quando TODAS as 10 habilidades da classe estão no rank máximo (30 pontos),
 * o personagem desbloqueia um buff temático PERMANENTE de combate. Cada classe
 * tem um estilo próprio (DPS causa mais dano, tank recebe menos, etc.).
 *
 * Implementado como MULTIPLICADOR de combate (igual ao sistema de skins), então:
 *  - não mexe nos atributos salvos nem no Poder (nada de reset/refund quebrar);
 *  - vale na Torre e no PvP automaticamente;
 *  - some sozinho se o jogador RESETAR a árvore (buff é calculado ao vivo).
 */

export interface MasteryBuff {
  /** Multiplicador do dano causado (1 = normal; >1 = mais dano). */
  damageMult: number;
  /** Multiplicador do dano recebido (1 = normal; <1 = tanka mais). */
  takenMult: number;
  /** Bônus de chance de crítico. */
  critBonus: number;
}

export const MASTERY_BUFFS: Record<ClassName, MasteryBuff> = {
  warrior:     { damageMult: 1.12, takenMult: 0.95, critBonus: 0 },
  paladin:     { damageMult: 1.08, takenMult: 0.90, critBonus: 0 },
  berserker:   { damageMult: 1.18, takenMult: 1.05, critBonus: 8 },
  mage:        { damageMult: 1.16, takenMult: 1.0,  critBonus: 0 },
  necromancer: { damageMult: 1.14, takenMult: 1.0,  critBonus: 6 },
  assassin:    { damageMult: 1.12, takenMult: 1.0,  critBonus: 10 },
  hunter:      { damageMult: 1.14, takenMult: 1.0,  critBonus: 6 },
  monk:        { damageMult: 1.08, takenMult: 0.92, critBonus: 5 },
  samurai:     { damageMult: 1.16, takenMult: 1.0,  critBonus: 5 },
  knight:      { damageMult: 1.0,  takenMult: 0.86, critBonus: 0 },
  summoner:    { damageMult: 1.12, takenMult: 1.0,  critBonus: 6 },
  templar:     { damageMult: 1.10, takenMult: 0.90, critBonus: 0 },
  archer:      { damageMult: 1.14, takenMult: 1.0,  critBonus: 8 },
};

/** Título temático da maestria de cada classe. */
export const MASTERY_TITLES: Record<ClassName, { pt: string; en: string; es: string }> = {
  warrior:     { pt: "Mestre de Guerra",        en: "War Master",            es: "Maestro de Guerra" },
  paladin:     { pt: "Cruzado Perfeito",        en: "Perfect Crusader",      es: "Cruzado Perfecto" },
  berserker:   { pt: "Fúria Ancestral",         en: "Ancestral Fury",        es: "Furia Ancestral" },
  mage:        { pt: "Arquimago",               en: "Archmage",              es: "Archimago" },
  necromancer: { pt: "Senhor dos Mortos",       en: "Lord of the Dead",      es: "Señor de los Muertos" },
  assassin:    { pt: "Sombra Lendária",         en: "Legendary Shadow",      es: "Sombra Legendaria" },
  hunter:      { pt: "Predador Supremo",        en: "Apex Predator",         es: "Depredador Supremo" },
  monk:        { pt: "Mestre do Ki",            en: "Ki Master",             es: "Maestro del Ki" },
  samurai:     { pt: "Espadachim Lendário",     en: "Legendary Swordsman",   es: "Espadachín Legendario" },
  knight:      { pt: "Guardião Imortal",        en: "Immortal Guardian",     es: "Guardián Inmortal" },
  summoner:    { pt: "Senhor das Invocações",   en: "Lord of Summoning",     es: "Señor de las Invocaciones" },
  templar:     { pt: "Santo Guerreiro",         en: "Holy Warrior",          es: "Santo Guerrero" },
  archer:      { pt: "Atirador de Elite",       en: "Sharpshooter",          es: "Francotirador de Élite" },
};

/** Total de ranks para completar a árvore (10 habilidades × 3 ranks). */
export const MASTERY_TOTAL_RANKS = 30;

/** A árvore da classe está 100% maximizada? (calculado ao vivo — reset desativa). */
export function isTreeMastered(char: any): boolean {
  const tree = skillTreeForClass(char?.classType);
  const invested = (char?.skills as Record<string, number> | undefined) ?? {};
  return tree.every((s) => (Number(invested[s.id]) || 0) >= s.maxRank);
}

/** Buff de maestria vigente (null se a árvore não estiver completa). */
export function masteryBuff(char: any): MasteryBuff | null {
  if (!isTreeMastered(char)) return null;
  const cls = (char?.classType as ClassName) || "warrior";
  return MASTERY_BUFFS[cls] ?? null;
}

/** Título temático da maestria (localizado). */
export function masteryTitle(char: any, locale: string): string {
  const cls = (char?.classType as ClassName) || "warrior";
  const t = MASTERY_TITLES[cls];
  if (!t) return "";
  if (locale?.toLowerCase().startsWith("en")) return t.en;
  if (locale?.toLowerCase().startsWith("es")) return t.es;
  return t.pt;
}

/** Descrição curta do buff (ex.: "+18% dano · 🎯 +8% crítico"). */
export function masteryBuffDesc(char: any, locale: string): string {
  const b = masteryBuff(char);
  if (!b) return "";
  const pt = !locale?.toLowerCase().startsWith("en") && !locale?.toLowerCase().startsWith("es");
  const parts: string[] = [];
  if (b.damageMult > 1) parts.push(`💥 +${Math.round((b.damageMult - 1) * 100)}% ${pt ? "dano" : "damage"}`);
  if (b.takenMult < 1) parts.push(`🛡️ -${Math.round((1 - b.takenMult) * 100)}% ${pt ? "dano recebido" : "damage taken"}`);
  if (b.critBonus > 0) parts.push(`🎯 +${b.critBonus}% ${pt ? "crítico" : "crit"}`);
  return parts.join(" · ");
}
