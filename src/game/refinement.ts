/**
 * SISTEMA DE REFINAMENTO — melhorar itens existentes com materiais raros.
 *
 * Cada refinamento aumenta os stats base de um item em +5% por nivel.
 * O custo escala exponencialmente e a chance de falha aumenta com o nivel.
 * Itens refinados ganham um visual especial (+1, +2, etc).
 *
 * Materiais necessarios:
 *   - Fragmentos de Cristal (comuns)
   *   - Nucleos de Poder (medios)
 *   - Essencia Divina (raros)
 */

export interface RefinementMaterial {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const REFINEMENT_MATERIALS: RefinementMaterial[] = [
  { id: "crystal_fragment", name: "Fragmento de Cristal", icon: "\u{1F48E}", description: "Fragmento brilhante usado em refinamentos basicos.", rarity: "common" },
  { id: "power_core", name: "Nucleo de Poder", icon: "\u26A1", description: "Nucleo concentrado de energia para refinamentos medios.", rarity: "rare" },
  { id: "divine_essence", name: "Essencia Divina", icon: "\u2B50", description: "Essencia pura dos deuses para refinamentos supremos.", rarity: "legendary" },
];

export interface RefinementLevelDef {
  level: number;
  statBonus: number; // percentual
  materials: { id: string; count: number }[];
  goldCost: number;
  successChance: number;
  failPenalty: number; // levels lost on fail (0 = no penalty)
}

export const REFINEMENT_LEVELS: RefinementLevelDef[] = [
  { level: 1, statBonus: 5, materials: [{ id: "crystal_fragment", count: 3 }], goldCost: 1000, successChance: 1.0, failPenalty: 0 },
  { level: 2, statBonus: 10, materials: [{ id: "crystal_fragment", count: 5 }], goldCost: 2500, successChance: 1.0, failPenalty: 0 },
  { level: 3, statBonus: 15, materials: [{ id: "crystal_fragment", count: 8 }, { id: "power_core", count: 1 }], goldCost: 5000, successChance: 0.9, failPenalty: 0 },
  { level: 4, statBonus: 20, materials: [{ id: "crystal_fragment", count: 12 }, { id: "power_core", count: 2 }], goldCost: 10000, successChance: 0.8, failPenalty: 1 },
  { level: 5, statBonus: 25, materials: [{ id: "crystal_fragment", count: 18 }, { id: "power_core", count: 4 }], goldCost: 20000, successChance: 0.7, failPenalty: 1 },
  { level: 6, statBonus: 30, materials: [{ id: "power_core", count: 6 }, { id: "divine_essence", count: 1 }], goldCost: 40000, successChance: 0.6, failPenalty: 2 },
  { level: 7, statBonus: 35, materials: [{ id: "power_core", count: 10 }, { id: "divine_essence", count: 2 }], goldCost: 75000, successChance: 0.5, failPenalty: 2 },
  { level: 8, statBonus: 40, materials: [{ id: "divine_essence", count: 4 }], goldCost: 120000, successChance: 0.4, failPenalty: 3 },
  { level: 9, statBonus: 45, materials: [{ id: "divine_essence", count: 7 }], goldCost: 200000, successChance: 0.3, failPenalty: 3 },
  { level: 10, statBonus: 50, materials: [{ id: "divine_essence", count: 10 }], goldCost: 350000, successChance: 0.2, failPenalty: 4 },
];

/** Busca nivel de refinamento por numero */
export function getRefinementLevel(level: number): RefinementLevelDef | undefined {
  return REFINEMENT_LEVELS.find((r) => r.level === level);
}

/** Calcula custo total para refinar ate um nivel */
export function refinementCost(targetLevel: number): { gold: number; materials: Record<string, number> } {
  let gold = 0;
  const materials: Record<string, number> = {};
  for (let i = 1; i <= Math.min(targetLevel, 10); i++) {
    const def = getRefinementLevel(i);
    if (def) {
      gold += def.goldCost;
      for (const m of def.materials) {
        materials[m.id] = (materials[m.id] || 0) + m.count;
      }
    }
  }
  return { gold, materials };
}

/** Calcula bonus de stats para um nivel de refinamento */
export function refinementStatBonus(level: number): number {
  const def = getRefinementLevel(level);
  return def?.statBonus || 0;
}

/** Simula tentativa de refinamento */
export function attemptRefine(currentLevel: number, targetLevel: number): { success: boolean; newLevel: number } {
  const def = getRefinementLevel(targetLevel);
  if (!def) return { success: false, newLevel: currentLevel };
  if (targetLevel <= currentLevel) return { success: false, newLevel: currentLevel };

  const success = Math.random() < def.successChance;

  if (success) {
    return { success: true, newLevel: targetLevel };
  } else {
    const newLevel = Math.max(0, currentLevel - def.failPenalty);
    return { success: false, newLevel };
  }
}

/** Formata nome do nivel de refinamento */
export function refinementName(level: number): string {
  if (level <= 0) return "Base";
  return `+${level}`;
}

/** Cor do nivel de refinamento */
export function refinementColor(level: number): string {
  if (level <= 0) return "#9ca3af";
  if (level <= 3) return "#22c55e";
  if (level <= 5) return "#3b82f6";
  if (level <= 7) return "#a855f7";
  if (level <= 9) return "#f59e0b";
  return "#e94560";
}
