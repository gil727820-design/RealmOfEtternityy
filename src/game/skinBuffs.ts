import type { ClassName } from "./constants";
import { skinById } from "./skins";

/**
 * Buffs de combate ativados por SKIN EQUIPADA, por classe.
 *
 * Uma skin só concede o buff da sua própria classe (e só quando está equipada
 * no personagem — activeSkinId). Assim:
 *  - Assassino → sangra o inimigo (dano ao longo do tempo).
 *  - Tanques (knight/templar/warrior/monk) → realmente tankam (menos dano).
 *  - Paladino → se cura ao longo da batalha.
 *  - DPS (berserker/mage/samurai...) → causam mais dano.
 */
export interface SkinClassBuff {
  /** Multiplicador do DANO causado pelo dono da skin (1 = normal). */
  damageMult: number;
  /** Multiplicador do DANO RECEBIDO pelo dono da skin (1 = normal; < 1 = tanka). */
  takenMult: number;
  /** Fração do maxHp recuperada por rodada (> 0 = cura). */
  healPerRound: number;
  /** Fração do ataque do dono que vira sangramento extra no inimigo por rodada. */
  bleedPerRound: number;
  /** Bônus de chance de crítico. */
  critBonus: number;
  icon: string;
  labelKey: string;
}

export const SKIN_CLASS_BUFFS: Partial<Record<ClassName, SkinClassBuff>> = {
  assassin:     { damageMult: 1.0,  takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0.13, critBonus: 6,  icon: "🩸", labelKey: "skinbuff.assassin" },
  berserker:    { damageMult: 1.24, takenMult: 1.08, healPerRound: 0,     bleedPerRound: 0,    critBonus: 7,  icon: "🌋", labelKey: "skinbuff.berserker" },
  warrior:      { damageMult: 1.1,  takenMult: 0.9,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 0,  icon: "⚔️", labelKey: "skinbuff.warrior" },
  paladin:      { damageMult: 1.0,  takenMult: 0.82, healPerRound: 0.035, bleedPerRound: 0,    critBonus: 0,  icon: "🛡️", labelKey: "skinbuff.paladin" },
  knight:       { damageMult: 1.0,  takenMult: 0.78, healPerRound: 0.02,  bleedPerRound: 0,    critBonus: 0,  icon: "🏰", labelKey: "skinbuff.knight" },
  templar:      { damageMult: 1.05, takenMult: 0.83, healPerRound: 0.02,  bleedPerRound: 0,    critBonus: 0,  icon: "✝️", labelKey: "skinbuff.templar" },
  monk:         { damageMult: 1.05, takenMult: 0.88, healPerRound: 0.02,  bleedPerRound: 0,    critBonus: 6,  icon: "🥋", labelKey: "skinbuff.monk" },
  mage:         { damageMult: 1.2,  takenMult: 1.05, healPerRound: 0,     bleedPerRound: 0,    critBonus: 4,  icon: "🔮", labelKey: "skinbuff.mage" },
  necromancer:  { damageMult: 1.12, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0.07, critBonus: 4,  icon: "💀", labelKey: "skinbuff.necromancer" },
  hunter:       { damageMult: 1.08, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 12, icon: "🏹", labelKey: "skinbuff.hunter" },
  samurai:      { damageMult: 1.14, takenMult: 0.95, healPerRound: 0,     bleedPerRound: 0,    critBonus: 7,  icon: "⛩️", labelKey: "skinbuff.samurai" },
  summoner:     { damageMult: 1.1,  takenMult: 0.95, healPerRound: 0,     bleedPerRound: 0,    critBonus: 5,  icon: "✨", labelKey: "skinbuff.summoner" },
  archer:       { damageMult: 1.08, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 13, icon: "🎯", labelKey: "skinbuff.archer" },
};

/**
 * Buffs INDIVIDUAIS por skin (id). Cada skin tem a sua própria identidade de
 * combate, em vez de todas da mesma classe serem idênticas.
 */
export const SKIN_BUFFS: Record<string, SkinClassBuff> = {
  // PACOTE ASSASINO
  assassin_corte:  { damageMult: 1.10, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0.12, critBonus: 10, icon: "🗡️", labelKey: "skinbuff.assassin" },
  assassin_veneno: { damageMult: 1.05, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0.16, critBonus: 5,  icon: "☠️", labelKey: "skinbuff.assassin" },

  // PACOTE BERSERKER
  berserker_glacial: { damageMult: 1.12, takenMult: 0.88, healPerRound: 0,     bleedPerRound: 0,    critBonus: 4,  icon: "❄️", labelKey: "skinbuff.berserker" },
  berserker_lava:    { damageMult: 1.30, takenMult: 1.10, healPerRound: 0,     bleedPerRound: 0,    critBonus: 10, icon: "🌋", labelKey: "skinbuff.berserker" },

  // PACOTE CACADOR (arqueiro_* → hunter)
  hunter_dourada: { damageMult: 1.15, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 14, icon: "🏹", labelKey: "skinbuff.hunter" },
  hunter_prata:   { damageMult: 1.08, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 9,  icon: "🎯", labelKey: "skinbuff.hunter" },

  // PACOTE CAVALEIRO
  knight_dragon: { damageMult: 1.05, takenMult: 0.80, healPerRound: 0.015, bleedPerRound: 0,    critBonus: 0,  icon: "🐉", labelKey: "skinbuff.knight" },
  knight_holy:   { damageMult: 1.0,  takenMult: 0.72, healPerRound: 0.030, bleedPerRound: 0,    critBonus: 0,  icon: "✨", labelKey: "skinbuff.knight" },

  // PACOTE GUERREIRO
  warrior_real_01: { damageMult: 1.15, takenMult: 0.85, healPerRound: 0,     bleedPerRound: 0,    critBonus: 5,  icon: "⚔️", labelKey: "skinbuff.warrior" },
  warrior_real_02: { damageMult: 1.30, takenMult: 0.80, healPerRound: 0.020, bleedPerRound: 0,    critBonus: 8,  icon: "👑", labelKey: "skinbuff.warrior" },

  // PACOTE INVOCADOR
  summoner_druida: { damageMult: 1.0,  takenMult: 0.85, healPerRound: 0.030, bleedPerRound: 0,    critBonus: 0,  icon: "🌿", labelKey: "skinbuff.summoner" },
  summoner_necro:  { damageMult: 1.20, takenMult: 0.95, healPerRound: 0,     bleedPerRound: 0.08, critBonus: 5,  icon: "💀", labelKey: "skinbuff.summoner" },

  // PACOTE MAGO
  mage_fogo:  { damageMult: 1.24, takenMult: 1.08, healPerRound: 0,     bleedPerRound: 0,    critBonus: 5,  icon: "🔥", labelKey: "skinbuff.mage" },
  mage_vento: { damageMult: 1.28, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0,    critBonus: 7,  icon: "🌪️", labelKey: "skinbuff.mage" },
// PACOTE MONGE
  monk_drao:  { damageMult: 1.10, takenMult: 0.88, healPerRound: 0.020, bleedPerRound: 0,    critBonus: 5,  icon: "🐉", labelKey: "skinbuff.monk" },
  monk_tigre: { damageMult: 1.18, takenMult: 0.90, healPerRound: 0,     bleedPerRound: 0,    critBonus: 9,  icon: "🐯", labelKey: "skinbuff.monk" },

  // PACOTE NECROMANTE
  necromancer_praga:  { damageMult: 1.15, takenMult: 1.0,  healPerRound: 0,     bleedPerRound: 0.10, critBonus: 5,  icon: "🦠", labelKey: "skinbuff.necromancer" },
  necromancer_sangue: { damageMult: 1.24, takenMult: 0.95, healPerRound: 0.020, bleedPerRound: 0.14, critBonus: 6,  icon: "❤️‍🔥", labelKey: "skinbuff.necromancer" },

  // PACOTE PALADINO
  paladin_lua: { damageMult: 1.0,  takenMult: 0.85, healPerRound: 0.030, bleedPerRound: 0,    critBonus: 0,  icon: "🌙", labelKey: "skinbuff.paladin" },
  paladin_sol: { damageMult: 1.08, takenMult: 0.82, healPerRound: 0.045, bleedPerRound: 0,    critBonus: 4,  icon: "☀️", labelKey: "skinbuff.paladin" },

  // PACOTE SAMURAI
  samurai_fogo: { damageMult: 1.18, takenMult: 0.97, healPerRound: 0,     bleedPerRound: 0,    critBonus: 9,  icon: "⛩️", labelKey: "skinbuff.samurai" },
  samurai_gelo: { damageMult: 1.22, takenMult: 0.92, healPerRound: 0,     bleedPerRound: 0,    critBonus: 12, icon: "❄️", labelKey: "skinbuff.samurai" },

  // PACOTE TEMPLARIO
  templar_fogo: { damageMult: 1.12, takenMult: 0.80, healPerRound: 0.020, bleedPerRound: 0,    critBonus: 4,  icon: "🔥", labelKey: "skinbuff.templar" },
  templar_mar:  { damageMult: 1.02, takenMult: 0.82, healPerRound: 0.025, bleedPerRound: 0,    critBonus: 0,  icon: "🌊", labelKey: "skinbuff.templar" },
};

/** Fator de força por raridade da skin (epic < legendary < mythic). */
const RARITY_MULT: Record<string, number> = { epic: 1, legendary: 1.3, mythic: 1.6 };
export function skinRarityMult(activeSkinId?: string | null): number {
  if (!activeSkinId) return 1;
  const r = skinById(activeSkinId)?.rarity ?? "epic";
  return RARITY_MULT[r] ?? 1;
}

/**
 * Retorna o buff vigente de um personagem — só existe se ele tiver uma skin
 * EQUIPADA (activeSkinId) da própria classe.
 */
export function getSkinClassBuff(
  classType: string,
  activeSkinId?: string | null
): SkinClassBuff | null {
  if (!activeSkinId) return null;
  const skin = skinById(activeSkinId);
  if (!skin || skin.className !== classType) return null;
  // Prioriza o buff INDIVIDUAL da skin e cai no buff padrão da classe.
  return SKIN_BUFFS[activeSkinId] ?? SKIN_CLASS_BUFFS[classType as ClassName] ?? null;
}

function buildBuffDesc(b: SkinClassBuff, locale: string): string {
  const parts: string[] = [];
  if (b.bleedPerRound > 0) parts.push(`🩸 ${locale.startsWith("pt") ? "Sangra o inimigo" : "Bleeds enemies"}`);
  if (b.healPerRound > 0) parts.push(`✚ ${locale.startsWith("pt") ? "Se cura na batalha" : "Heals in battle"}`);
  if (b.takenMult < 1) parts.push(`🛡️ ${locale.startsWith("pt") ? "Tanka mais dano" : "Tanks more"}`);
  if (b.damageMult > 1) parts.push(`💥 ${locale.startsWith("pt") ? "Causa mais dano" : "Deals more damage"}`);
  if (b.critBonus > 0) parts.push(`🎯 +${b.critBonus}% ${locale.startsWith("pt") ? "crítico" : "crit"}`);
  return parts.join(" · ");
}

/**
 * Descrição curta (PT/EN) do buff vigente. Recebe opcionalmente o buff
 * individual da skin; quando omitido, usa o buff padrão da classe.
 */
export function shortBuffDesc(classType: string, locale: string, buff?: SkinClassBuff): string {
  const b = buff ?? SKIN_CLASS_BUFFS[classType as ClassName];
  if (!b) return "";
  return buildBuffDesc(b, locale);
}

/** Descrição do buff INDIVIDUAL de uma skin (pelo id). */
export function skinBuffDesc(skinId: string, locale: string): string {
  const skin = skinById(skinId);
  if (!skin) return "";
  return shortBuffDesc(skin.className, locale, SKIN_BUFFS[skinId]);
}

/**
 * Estatísticas EFETIVAS de combate de um personagem, já considerando o buff da
 * skin equipada. Usado no painel de STATUS para que o número exibido seja o
 * mesmo aplicado nas batalhas (ex.: crítico base + bônus da skin).
 */
export function effectiveStats(char: Record<string, unknown> | null | undefined) {
  const c = char || {};
  const base = {
    attack: Number(c.attack) || 0,
    defense: Number(c.defense) || 0,
    speed: Number(c.speed) || 0,
    critical: Number(c.critical) || 0,
    precision: Number(c.precision) || 0,
    dodge: Number(c.dodge) || 0,
  };
  const classType = String(c.classType || "warrior");
  const buff = getSkinClassBuff(classType, c.activeSkinId as string | null | undefined);
  return {
    ...base,
    // Crítico efetivo = base + bônus da skin (aplicado em todos os combates).
    critical: base.critical + (buff?.critBonus || 0),
    // Multiplicador de dano efetivo (dano × multiplicador da skin × raridade).
    damageMult: buff ? buff.damageMult * skinRarityMult(c.activeSkinId as string | null) : 1,
    buff,
    hasSkin: !!buff,
  };
}