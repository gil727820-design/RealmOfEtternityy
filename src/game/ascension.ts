/**
 * ASCENSÃO 🌌 — a jornada divina do personagem.
 *
 * Diferente do Prestígio (que reseta o nível ao máximo), a Ascensão é uma
 * progressão contínua: a cada 100 níveis o personagem ASCENDE de patamar
 * divino (Ascensão I → II → III...), ganhando buffs PERMANENTES:
 *   - +6% de dano
 *   - +6% de HP máximo
 *   - +5% de XP ganho
 *   - +5% de ouro ganho
 *   - +2 de velocidade
 *
 * O personagem mantém o nível (não reseta). Guardado em `char.ascension`
 * (número inteiro: 0 = não ascendeu, 1 = Ascensão I, ...).
 * O servidor valida o nível e os custos (ouro + cristais) — anti-cheat.
 */

/** Níveis de ascensão disponíveis (I a V). */
export const ASCENSION_MAX = 5;
/** Nível necessário para cada patamar (100 × patamar). */
export const ASCENSION_LEVEL_STEP = 100;
/** Bônus % de dano por patamar. */
export const ASCENSION_DMG_PCT = 6;
/** Bônus % de HP máximo por patamar. */
export const ASCENSION_HP_PCT = 6;
/** Bônus % de XP por patamar. */
export const ASCENSION_XP_PCT = 5;
/** Bônus % de ouro por patamar. */
export const ASCENSION_GOLD_PCT = 5;
/** Bônus de velocidade (pontos) por patamar. */
export const ASCENSION_SPEED = 2;

/** Custo (ouro) para ascender ao próximo patamar — escala com o patamar. */
export function ascensionGoldCost(currentAscension: number): number {
  const next = Math.min(ASCENSION_MAX, Math.max(0, Math.floor(Number(currentAscension) || 0)) + 1);
  return 500_000 * Math.pow(2, next - 1);
}

/** Custo (cristais) para ascender — escala com o patamar. */
export function ascensionCrystalCost(currentAscension: number): number {
  const next = Math.min(ASCENSION_MAX, Math.max(0, Math.floor(Number(currentAscension) || 0)) + 1);
  return 100 * next;
}

/** Nível necessário para o próximo patamar (0 = já no máximo). */
export function ascensionNextLevel(currentAscension: number): number {
  const cur = Math.min(ASCENSION_MAX, Math.max(0, Math.floor(Number(currentAscension) || 0)));
  if (cur >= ASCENSION_MAX) return 0;
  return (cur + 1) * ASCENSION_LEVEL_STEP;
}

/** Nível de ascensão atual do personagem. */
export function ascensionLevel(char: any): number {
  return Math.min(ASCENSION_MAX, Math.max(0, Math.floor(Number(char?.ascension) || 0)));
}

/** Buffs acumulados da ascensão atual. */
export function ascensionBuffs(char: any) {
  const lv = ascensionLevel(char);
  return {
    damagePct: lv * ASCENSION_DMG_PCT,
    maxHpPct: lv * ASCENSION_HP_PCT,
    xpPct: lv * ASCENSION_XP_PCT,
    goldPct: lv * ASCENSION_GOLD_PCT,
    speed: lv * ASCENSION_SPEED,
  };
}

/**
 * Valida e monta o patch de ascensão (nível, custos). Retorna o patch a ser
 * salvo no personagem ou { error }.
 */
export function ascendPatch(char: any): { patch: any } | { error: string } {
  const cur = ascensionLevel(char);
  if (cur >= ASCENSION_MAX) return { error: "Você já atingiu o patamar máximo de Ascensão" };
  const nextLevel = ascensionNextLevel(cur);
  const level = Number(char?.level) || 1;
  if (level < nextLevel) return { error: `Requer nível ${nextLevel} para Ascensão ${cur + 1}` };
  const goldCost = ascensionGoldCost(cur);
  const crystalCost = ascensionCrystalCost(cur);
  const gold = Number(char?.gold) || 0;
  const crystals = Number(char?.crystals) || 0;
  if (gold < goldCost) return { error: `Requer ${goldCost.toLocaleString()} de ouro` };
  if (crystals < crystalCost) return { error: `Requer ${crystalCost} cristais` };
  return {
    patch: {
      gold: gold - goldCost,
      crystals: crystals - crystalCost,
      ascension: cur + 1,
    },
  };
}

/** Rótulo curto: "Ascensão III" (i18n pelo nameKey). */
export function ascensionNameKey(level: number): string {
  const lv = Math.min(ASCENSION_MAX, Math.max(0, Math.floor(Number(level) || 0)));
  if (lv <= 0) return "ascension.none";
  return `ascension.lv${lv}`;
}

/** Aplica os buffs de combate da ascensão (dano %, HP máx %, velocidade). */
export function applyAscensionCombat(char: any, ca: { attack: number; defense: number; maxHp: number; speed: number; critical: number }) {
  const b = ascensionBuffs(char);
  if (b.damagePct) ca.attack = Math.round(ca.attack * (1 + b.damagePct / 100));
  if (b.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + b.maxHpPct / 100));
  if (b.speed) ca.speed = ca.speed + b.speed;
  return ca;
}
