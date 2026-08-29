/**
 * SISTEMA DE ENCANTAMENTOS — adicionar bonus especiais a itens.
 *
 * Cada encantamento tem um efeito que escala com o nivel (1-5).
 * O jogador gasta cristais e ouro para encantar, com chance de falha
 * em niveis altos (3+). Itens ja encantados podem ser re-encantados
 * (substitui o encantamento anterior).
 */

export type EnchantmentSlot = "weapon" | "armor" | "helmet" | "boots" | "accessory";

export interface EnchantmentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  slot: EnchantmentSlot;
  maxLevel: number;
  /** Custo base por nivel */
  costPerLevel: { gold: number; crystals: number };
  /** Efeito por nivel */
  effects: Array<{
    level: number;
    stat: string;
    value: number;
    label: string;
  }>;
  /** Chance de sucesso por nivel (1.0 = 100%) */
  successChance: number[];
}

export const ENCHANTMENTS: EnchantmentDef[] = [
  {
    id: "flame", name: "Gumes de Fogo", description: "Adiciona dano de fogo ao ataque.",
    icon: "\u{1F525}", slot: "weapon", maxLevel: 5,
    costPerLevel: { gold: 2000, crystals: 10 },
    effects: [
      { level: 1, stat: "attack", value: 5, label: "+5 ATK" },
      { level: 2, stat: "attack", value: 12, label: "+12 ATK" },
      { level: 3, stat: "attack", value: 22, label: "+22 ATK" },
      { level: 4, stat: "attack", value: 35, label: "+35 ATK" },
      { level: 5, stat: "attack", value: 50, label: "+50 ATK" },
    ],
    successChance: [1.0, 1.0, 0.85, 0.7, 0.5],
  },
  {
    id: "frost", name: "Armadura Gélida", description: "Aumenta defesa com bonus de resistencia.",
    icon: "\u2744\uFE0F", slot: "armor", maxLevel: 5,
    costPerLevel: { gold: 2000, crystals: 10 },
    effects: [
      { level: 1, stat: "defense", value: 5, label: "+5 DEF" },
      { level: 2, stat: "defense", value: 12, label: "+12 DEF" },
      { level: 3, stat: "defense", value: 22, label: "+22 DEF" },
      { level: 4, stat: "defense", value: 35, label: "+35 DEF" },
      { level: 5, stat: "defense", value: 50, label: "+50 DEF" },
    ],
    successChance: [1.0, 1.0, 0.85, 0.7, 0.5],
  },
  {
    id: "swift", name: "Passos de Vento", description: "Aumenta velocidade do personagem.",
    icon: "\u{1F4A8}", slot: "boots", maxLevel: 5,
    costPerLevel: { gold: 1500, crystals: 8 },
    effects: [
      { level: 1, stat: "speed", value: 3, label: "+3 SPD" },
      { level: 2, stat: "speed", value: 7, label: "+7 SPD" },
      { level: 3, stat: "speed", value: 12, label: "+12 SPD" },
      { level: 4, stat: "speed", value: 18, label: "+18 SPD" },
      { level: 5, stat: "speed", value: 25, label: "+25 SPD" },
    ],
    successChance: [1.0, 1.0, 0.9, 0.75, 0.55],
  },
  {
    id: "wisdom", name: "Sabedoria Antiga", description: "Aumenta HP maximo e regeneracao.",
    icon: "\u{1F4D6}", slot: "helmet", maxLevel: 5,
    costPerLevel: { gold: 2500, crystals: 12 },
    effects: [
      { level: 1, stat: "maxHp", value: 50, label: "+50 HP" },
      { level: 2, stat: "maxHp", value: 120, label: "+120 HP" },
      { level: 3, stat: "maxHp", value: 220, label: "+220 HP" },
      { level: 4, stat: "maxHp", value: 350, label: "+350 HP" },
      { level: 5, stat: "maxHp", value: 500, label: "+500 HP" },
    ],
    successChance: [1.0, 1.0, 0.85, 0.7, 0.5],
  },
  {
    id: "critical", name: "Golpe Critico", description: "Aumenta chance de critico.",
    icon: "\u{1F4A5}", slot: "weapon", maxLevel: 5,
    costPerLevel: { gold: 3000, crystals: 15 },
    effects: [
      { level: 1, stat: "critical", value: 3, label: "+3% CRIT" },
      { level: 2, stat: "critical", value: 6, label: "+6% CRIT" },
      { level: 3, stat: "critical", value: 10, label: "+10% CRIT" },
      { level: 4, stat: "critical", value: 15, label: "+15% CRIT" },
      { level: 5, stat: "critical", value: 20, label: "+20% CRIT" },
    ],
    successChance: [1.0, 1.0, 0.8, 0.65, 0.45],
  },
  {
    id: "dodge", name: "Evasao Sombria", description: "Aumenta chance de esquiva.",
    icon: "\u{1F6AB}", slot: "accessory", maxLevel: 5,
    costPerLevel: { gold: 2500, crystals: 12 },
    effects: [
      { level: 1, stat: "dodge", value: 2, label: "+2% EVA" },
      { level: 2, stat: "dodge", value: 5, label: "+5% EVA" },
      { level: 3, stat: "dodge", value: 8, label: "+8% EVA" },
      { level: 4, stat: "dodge", value: 12, label: "+12% EVA" },
      { level: 5, stat: "dodge", value: 16, label: "+16% EVA" },
    ],
    successChance: [1.0, 1.0, 0.85, 0.7, 0.5],
  },
  {
    id: "lifesteal", name: "Roubo de Vida", description: "Rouba vida ao atacar.",
    icon: "\u{1FA78}", slot: "weapon", maxLevel: 5,
    costPerLevel: { gold: 4000, crystals: 20 },
    effects: [
      { level: 1, stat: "lifesteal", value: 2, label: "+2% LS" },
      { level: 2, stat: "lifesteal", value: 4, label: "+4% LS" },
      { level: 3, stat: "lifesteal", value: 7, label: "+7% LS" },
      { level: 4, stat: "lifesteal", value: 10, label: "+10% LS" },
      { level: 5, stat: "lifesteal", value: 15, label: "+15% LS" },
    ],
    successChance: [1.0, 0.9, 0.75, 0.6, 0.4],
  },
  {
    id: "precision", name: "Olho de Aguia", description: "Aumenta precisao e dano critico.",
    icon: "\u{1F3AF}", slot: "accessory", maxLevel: 5,
    costPerLevel: { gold: 3000, crystals: 15 },
    effects: [
      { level: 1, stat: "precision", value: 3, label: "+3% PRE" },
      { level: 2, stat: "precision", value: 6, label: "+6% PRE" },
      { level: 3, stat: "precision", value: 10, label: "+10% PRE" },
      { level: 4, stat: "precision", value: 15, label: "+15% PRE" },
      { level: 5, stat: "precision", value: 20, label: "+20% PRE" },
    ],
    successChance: [1.0, 1.0, 0.85, 0.7, 0.5],
  },
];

/** Busca encantamento por ID */
export function getEnchantmentById(id: string): EnchantmentDef | undefined {
  return ENCHANTMENTS.find((e) => e.id === id);
}

/** Retorna encantamentos disponiveis para um slot */
export function getEnchantmentsForSlot(slot: EnchantmentSlot): EnchantmentDef[] {
  return ENCHANTMENTS.filter((e) => e.slot === slot);
}

/** Calcula custo total para encantar ate um nivel */
export function enchantmentCost(def: EnchantmentDef, targetLevel: number): { gold: number; crystals: number } {
  let gold = 0;
  let crystals = 0;
  for (let i = 1; i <= Math.min(targetLevel, def.maxLevel); i++) {
    gold += def.costPerLevel.gold * i;
    crystals += def.costPerLevel.crystals * i;
  }
  return { gold, crystals };
}

/** Simula tentativa de encantamento */
export function attemptEnchant(def: EnchantmentDef, currentLevel: number, targetLevel: number): { success: boolean; newLevel: number } {
  const level = Math.min(targetLevel, def.maxLevel);
  if (level <= currentLevel) return { success: false, newLevel: currentLevel };

  const chance = def.successChance[level - 1] ?? 0.5;
  const success = Math.random() < chance;

  return {
    success,
    newLevel: success ? level : currentLevel,
  };
}
