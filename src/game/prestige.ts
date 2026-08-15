/**
 * Sistema de PRESTÍGIO (renascimento).
 *
 * Ao prestigiar, o personagem reseta o nível para 1 (XP zerada), mas ganha
 * um bônus PERMANENTE em atributos base que escala com o número de prestígios.
 * O progresso (itens, moedas, skins, torre, PvP, guilda) é mantido.
 *
 * Regras:
 *  - Nível mínimo para prestigiar: PRESTIGE_MIN_LEVEL (padrão 100).
 *  - Cada prestígio soma PRESTIGE_STAT_BONUS_PCT % da base da classe aos
 *    atributos base (arredondado). Ex.: +15% por prestígio.
 *  - A base dos atributos cresce: base_final = base_classe × (1 + 0.15 × prestígio).
 *  - Mantém itens equipados (o bônus de equipamento é somado depois).
 */

import { CLASS_BASE_STATS, powerCalc, xpForLevel, type ClassName } from "./constants";

/** Nível mínimo para prestigiar. */
export const PRESTIGE_MIN_LEVEL = 100;

/** Bônus % por prestígio sobre os atributos base da classe. */
export const PRESTIGE_STAT_BONUS_PCT = 0.15;

/** Diz se o personagem pode prestigiar agora. */
export function canPrestige(char: any): { ok: boolean; reason?: string } {
  const level = Number(char?.level) || 1;
  if (level < PRESTIGE_MIN_LEVEL) {
    return {
      ok: false,
      reason: `Requer nível ${PRESTIGE_MIN_LEVEL} (você está no nível ${level})`,
    };
  }
  return { ok: true };
}

/**
 * Base de atributos da classe escalada pelo prestígio:
 * base × (1 + PRESTIGE_STAT_BONUS_PCT × prestígio).
 */
export function prestigeScaledBase(char: any) {
  const cls = ((char?.classType as string) || "warrior") as ClassName;
  const base = CLASS_BASE_STATS[cls] ?? CLASS_BASE_STATS.warrior;
  const prestige = Math.max(0, Math.floor(Number(char?.prestige) || 0));
  const mult = 1 + PRESTIGE_STAT_BONUS_PCT * prestige;
  return {
    attack: Math.floor(base.attack * mult),
    defense: Math.floor(base.defense * mult),
    maxHp: Math.floor(base.hp * mult),
    speed: Math.floor(base.speed * mult),
    critical: Math.floor(base.critical * mult),
    mana: Math.floor(base.mana * mult),
    maxMana: Math.floor(base.mana * mult),
  };
}

/**
 * Aplica o renascimento: reseta nível/XP/pontos e recalcula os atributos
 * base com o novo prestígio. Retorna o patch completo a ser persistido.
 * Os bônus de itens EQUIPADOS são preservados (somados em cima da base).
 * @param equippedBonus bônus atual dos itens equipados (attack/defense/maxHp/speed/critical).
 */
export function prestigePatch(char: any, equippedBonus: {
  attack: number; defense: number; maxHp: number; speed: number; critical: number;
}) {
  const nextPrestige = Math.max(0, Math.floor(Number(char?.prestige) || 0)) + 1;
  const base = prestigeScaledBase({ ...char, prestige: nextPrestige });

  const attack = base.attack + Math.round(equippedBonus.attack);
  const defense = base.defense + Math.round(equippedBonus.defense);
  const maxHp = base.maxHp + Math.round(equippedBonus.maxHp);
  const speed = base.speed + Math.round(equippedBonus.speed);
  const critical = base.critical + Math.round(equippedBonus.critical);

  return {
    prestige: nextPrestige,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    unspentStatPoints: 0,
    skillPoints: 0,
    // Atributos base escalados pelo prestígio (sem equipamento).
    baseStats: {
      attack: base.attack,
      defense: base.defense,
      maxHp: base.maxHp,
      speed: base.speed,
      critical: base.critical,
    },
    attack,
    defense,
    maxHp,
    hp: maxHp,
    speed,
    critical,
    mana: base.maxMana,
    maxMana: base.maxMana,
    power: powerCalc({ attack, defense, hp: maxHp, speed, critical, level: 1 }),
    lastActivity: new Date().toISOString(),
  };
}
