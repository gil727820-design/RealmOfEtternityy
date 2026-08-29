/**
 * SISTEMA DE MATERIAIS E CRAFTING 🧪
 *
 * Materiais são itens empilháveis (type "material", stackable) que dropam de
 * mobs de região, elites, mini-bosses e bosses. Eles são consumidos em RECEITAS
 * de craft para criar equipamentos do catálogo existente (rpgItems.gen).
 *
 * - MATERIAL_TEMPLATES: definições dos materiais (templates de item, ids 5000+).
 * - RECIPES: receitas que combinam materiais → equipamento de uma raridade.
 * - rollMaterialDrop(): sorteio de material ao derrotar um inimigo.
 * - craftRecipe(): consome os materiais e devolve o template de equipamento.
 *
 * A lógica é pura (src/game/) e usada pelas rotas da API — o servidor sempre
 * valida a quantidade de materiais antes de conceder o item (anti-cheat).
 */

export interface MaterialDef {
  id: number;
  nameKey: string;
  /** Raridade visual do material (afeta o ícone na UI). */
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "divine" | "ancestral" | "supreme";
  icon: string;
  /** A partir de qual nível de inimigo o material começa a dropar. */
  minLevel: number;
  /** Peso no sorteio (materiais comuns têm peso maior). */
  weight: number;
}

/** Materiais do jogo (ids 5000+, livres do catálogo que vai até 1271). */
export const MATERIAL_TEMPLATES: MaterialDef[] = [
  { id: 5000, nameKey: "mat.iron_fragment", rarity: "common", icon: "🪨", minLevel: 1, weight: 100 },
  { id: 5001, nameKey: "mat.wood_essence", rarity: "common", icon: "🌿", minLevel: 1, weight: 90 },
  { id: 5002, nameKey: "mat.forest_essence", rarity: "uncommon", icon: "🍃", minLevel: 5, weight: 60 },
  { id: 5003, nameKey: "mat.ruin_shard", rarity: "uncommon", icon: "🏺", minLevel: 10, weight: 50 },
  { id: 5004, nameKey: "mat.arcane_crystal", rarity: "rare", icon: "🔮", minLevel: 15, weight: 35 },
  { id: 5005, nameKey: "mat.ore_vein", rarity: "rare", icon: "⛏️", minLevel: 16, weight: 32 },
  { id: 5006, nameKey: "mat.swamp_essence", rarity: "epic", icon: "🧪", minLevel: 20, weight: 20 },
  { id: 5007, nameKey: "mat.ice_core", rarity: "epic", icon: "❄️", minLevel: 30, weight: 16 },
  { id: 5008, nameKey: "mat.dragon_scale", rarity: "legendary", icon: "🐉", minLevel: 40, weight: 9 },
  { id: 5009, nameKey: "mat.titan_heart", rarity: "legendary", icon: "❤️‍🔥", minLevel: 50, weight: 7 },
  { id: 5010, nameKey: "mat.void_shard", rarity: "mythic", icon: "🌑", minLevel: 60, weight: 4 },
  { id: 5011, nameKey: "mat.star_dust", rarity: "divine", icon: "✨", minLevel: 70, weight: 2 },
  { id: 5012, nameKey: "mat.ancient_relic", rarity: "ancestral", icon: "🕯️", minLevel: 80, weight: 1 },
  { id: 5013, nameKey: "mat.supreme_essence", rarity: "supreme", icon: "👑", minLevel: 90, weight: 0.5 },
];

/** Materiais que podem dropar em um dado nível de inimigo (ordenados por peso). */
export function materialsForLevel(level: number): MaterialDef[] {
  return MATERIAL_TEMPLATES.filter((m) => m.minLevel <= Math.max(1, Math.floor(level || 1)));
}

/**
 * Sorteia um material ao derrotar um inimigo. `rng` injetável para testes.
 * Chance base de drop: 35% (farms normais), 100% para bosses (chanceForced).
 * Raridade é ponderada: comum tem mais peso que supremo.
 */
export function rollMaterialDrop(
  enemyLevel: number,
  chance: number = 0.35,
  rng: () => number = Math.random
): MaterialDef | null {
  if (rng() > chance) return null;
  const pool = materialsForLevel(enemyLevel);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, m) => s + m.weight, 0);
  let roll = rng() * total;
  for (const m of pool) {
    roll -= m.weight;
    if (roll <= 0) return m;
  }
  return pool[pool.length - 1];
}

export interface RecipeDef {
  id: string;
  /** Resultado: raridade do equipamento criado. */
  resultRarity: "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "divine" | "ancestral" | "supreme";
  /** Nível mínimo do equipamento criado. */
  minLevel: number;
  /** Materiais necessários: { materialId: quantidade }. */
  costs: Record<number, number>;
  /** Custo em ouro para forjar. */
  goldCost: number;
  nameKey: string;
  descKey: string;
  icon: string;
}

/** Receitas de craft — combinam materiais para criar equipamentos. */
export const RECIPES: RecipeDef[] = [
  {
    id: "craft_uncommon", resultRarity: "uncommon", minLevel: 5,
    costs: { 5000: 8, 5001: 6 }, goldCost: 1_500,
    nameKey: "craft.uncommon.name", descKey: "craft.uncommon.desc", icon: "🟢",
  },
  {
    id: "craft_rare", resultRarity: "rare", minLevel: 12,
    costs: { 5000: 12, 5002: 8, 5003: 5 }, goldCost: 4_000,
    nameKey: "craft.rare.name", descKey: "craft.rare.desc", icon: "🔵",
  },
  {
    id: "craft_epic", resultRarity: "epic", minLevel: 24,
    costs: { 5004: 10, 5005: 8, 5006: 5 }, goldCost: 10_000,
    nameKey: "craft.epic.name", descKey: "craft.epic.desc", icon: "🟣",
  },
  {
    id: "craft_legendary", resultRarity: "legendary", minLevel: 40,
    costs: { 5007: 8, 5008: 6, 5009: 4 }, goldCost: 25_000,
    nameKey: "craft.legendary.name", descKey: "craft.legendary.desc", icon: "🟠",
  },
  {
    id: "craft_mythic", resultRarity: "mythic", minLevel: 55,
    costs: { 5009: 8, 5010: 6, 5008: 6 }, goldCost: 60_000,
    nameKey: "craft.mythic.name", descKey: "craft.mythic.desc", icon: "🔴",
  },
  {
    id: "craft_divine", resultRarity: "divine", minLevel: 70,
    costs: { 5010: 8, 5011: 6, 5012: 4 }, goldCost: 150_000,
    nameKey: "craft.divine.name", descKey: "craft.divine.desc", icon: "🌟",
  },
  {
    id: "craft_supreme", resultRarity: "supreme", minLevel: 90,
    costs: { 5012: 8, 5013: 6, 5011: 6 }, goldCost: 400_000,
    nameKey: "craft.supreme.name", descKey: "craft.supreme.desc", icon: "👑",
  },

  // --- Receitas por Classe ---
  {
    id: "craft_warrior_epic", resultRarity: "epic", minLevel: 20,
    costs: { 5000: 20, 5003: 10, 5004: 5 }, goldCost: 8_000,
    nameKey: "craft.warrior.name", descKey: "craft.warrior.desc", icon: "⚔️",
  },
  {
    id: "craft_mage_epic", resultRarity: "epic", minLevel: 20,
    costs: { 5004: 15, 5001: 10, 5002: 8 }, goldCost: 8_000,
    nameKey: "craft.mage.name", descKey: "craft.mage.desc", icon: "🔮",
  },
  {
    id: "craft_assassin_epic", resultRarity: "epic", minLevel: 20,
    costs: { 5000: 15, 5002: 12, 5005: 5 }, goldCost: 8_000,
    nameKey: "craft.assassin.name", descKey: "craft.assassin.desc", icon: "🗡️",
  },
  {
    id: "craft_paladin_epic", resultRarity: "epic", minLevel: 20,
    costs: { 5000: 25, 5003: 8, 5004: 8 }, goldCost: 10_000,
    nameKey: "craft.paladin.name", descKey: "craft.paladin.desc", icon: "🛡️",
  },
  {
    id: "craft_berserker_epic", resultRarity: "epic", minLevel: 20,
    costs: { 5000: 18, 5005: 10, 5006: 5 }, goldCost: 8_000,
    nameKey: "craft.berserker.name", descKey: "craft.berserker.desc", icon: "🪓",
  },

  // --- Receitas de Upgrade (subir rarity de item existente) ---
  {
    id: "upgrade_uncommon_to_rare", resultRarity: "rare", minLevel: 10,
    costs: { 5000: 15, 5002: 10, 5003: 5 }, goldCost: 5_000,
    nameKey: "craft.upgrade.rare.name", descKey: "craft.upgrade.rare.desc", icon: "⬆️",
  },
  {
    id: "upgrade_rare_to_epic", resultRarity: "epic", minLevel: 25,
    costs: { 5004: 12, 5005: 8, 5006: 5 }, goldCost: 15_000,
    nameKey: "craft.upgrade.epic.name", descKey: "craft.upgrade.epic.desc", icon: "⬆️",
  },
  {
    id: "upgrade_epic_to_legendary", resultRarity: "legendary", minLevel: 45,
    costs: { 5007: 10, 5008: 8, 5009: 5 }, goldCost: 40_000,
    nameKey: "craft.upgrade.legendary.name", descKey: "craft.upgrade.legendary.desc", icon: "⬆️",
  },

  // --- Receitas de Encantamento ---
  {
    id: "enchant_basic", resultRarity: "rare", minLevel: 15,
    costs: { 5004: 8, 5000: 20 }, goldCost: 3_000,
    nameKey: "craft.enchant.basic.name", descKey: "craft.enchant.basic.desc", icon: "✨",
  },
  {
    id: "enchant_advanced", resultRarity: "epic", minLevel: 35,
    costs: { 5006: 10, 5004: 15, 5005: 8 }, goldCost: 20_000,
    nameKey: "craft.enchant.advanced.name", descKey: "craft.enchant.advanced.desc", icon: "✨",
  },
  {
    id: "enchant_master", resultRarity: "legendary", minLevel: 60,
    costs: { 5008: 10, 5009: 8, 5007: 8 }, goldCost: 80_000,
    nameKey: "craft.enchant.master.name", descKey: "craft.enchant.master.desc", icon: "✨",
  },

  // --- Receitas de Consumíveis ---
  {
    id: "craft_hp_potion", resultRarity: "uncommon", minLevel: 1,
    costs: { 5001: 5, 5000: 3 }, goldCost: 500,
    nameKey: "craft.potion.hp.name", descKey: "craft.potion.hp.desc", icon: "🧪",
  },
  {
    id: "craft_mana_potion", resultRarity: "uncommon", minLevel: 1,
    costs: { 5002: 5, 5001: 3 }, goldCost: 500,
    nameKey: "craft.potion.mana.name", descKey: "craft.potion.mana.desc", icon: "🧪",
  },
  {
    id: "craft_energy_potion", resultRarity: "uncommon", minLevel: 10,
    costs: { 5003: 8, 5004: 3 }, goldCost: 2_000,
    nameKey: "craft.potion.energy.name", descKey: "craft.potion.energy.desc", icon: "⚡",
  },
];

/** Verifica se o personagem tem os materiais da receita (por templateId). */
export function hasRecipeMaterials(
  costs: Record<number, number>,
  inventory: Array<{ item: { templateId: number; quantity?: number } }>
): boolean {
  for (const [templateId, qty] of Object.entries(costs)) {
    const entry = inventory.find((e) => Number(e.item.templateId) === Number(templateId));
    const have = Number(entry?.item?.quantity) || 0;
    if (have < qty) return false;
  }
  return true;
}

/**
 * Retorna os ids das linhas de inventário a consumir para uma receita.
 * Lança erro se faltar material (a rota chama após hasRecipeMaterials).
 */
export function recipeMaterialEntries(
  costs: Record<number, number>,
  inventory: Array<{ item: { id: string; templateId: number; quantity?: number } }>
): Array<{ itemId: string; amount: number }> {
  const out: Array<{ itemId: string; amount: number }> = [];
  for (const [templateId, qty] of Object.entries(costs)) {
    const entry = inventory.find((e) => Number(e.item.templateId) === Number(templateId));
    if (!entry) throw new Error(`Material ${templateId} ausente`);
    const have = Number(entry.item.quantity) || 0;
    const need = Math.min(have, qty);
    if (need < qty) throw new Error(`Material ${templateId} insuficiente`);
    out.push({ itemId: String(entry.item.id), amount: need });
  }
  return out;
}

/** Nome localizado de um material. */
export function materialName(m: MaterialDef, locale: string): string {
  // O i18n resolve nameKey dinamicamente na UI; aqui devolvemos o fallback.
  void locale;
  return m.nameKey;
}
