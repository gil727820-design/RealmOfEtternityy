/**
 * SISTEMA DE EXPLORACAO DO MUNDO — eventos randomicos e tesouros.
 *
 * Ao explorar uma regiao, o jogador pode encontrar:
 *   - Baús com ouro/cristais
 *   - Mercador viajante com desconto
 *   - Evento de combate (monstro raro)
 *   - Bênção ancestral (XP extra)
 *   - Nada (perde energia sem ganho)
 *
 * Cada regiao tem seu proprio pool de eventos com pesos diferentes.
 */

export interface WorldEventDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "treasure" | "merchant" | "combat" | "blessing" | "trap" | "nothing";
  /** Peso no pool (mais alto = mais chance) */
  weight: number;
  /** Recompensa base (escala com nivel da regiao) */
  reward: {
    gold?: number;
    crystals?: number;
    xp?: number;
    diamonds?: number;
  };
  /** Custo de energia para participar */
  energyCost: number;
}

export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: "treasure_chest", name: "Baú Escondido", description: "Voce encontrou um baú escondido entre as arbustos!",
    icon: "\u{1F4E6}", type: "treasure", weight: 25,
    reward: { gold: 500, crystals: 3 }, energyCost: 2,
  },
  {
    id: "golden_chest", name: "Baú Dourado", description: "Um baú dourado brilha na escuridão!",
    icon: "\u{1F4E8}", type: "treasure", weight: 10,
    reward: { gold: 2000, crystals: 10, diamonds: 1 }, energyCost: 3,
  },
  {
    id: "traveling_merchant", name: "Mercador Viajante", description: "Um mercador oferece itens raros com desconto!",
    icon: "\u{1F9D9}", type: "merchant", weight: 15,
    reward: { gold: 800 }, energyCost: 1,
  },
  {
    id: "rare_monster", name: "Monstro Raro", description: "Um monstro raro aparece! Derrote-o para ganhar recompensas!",
    icon: "\u{1F47F}", type: "combat", weight: 20,
    reward: { gold: 1200, crystals: 8 }, energyCost: 5,
  },
  {
    id: "elite_monster", name: "Monstro Elite", description: "Um monstro elite de alto nivel bloqueia seu caminho!",
    icon: "\u{1F479}", type: "combat", weight: 8,
    reward: { gold: 3000, crystals: 20, diamonds: 2 }, energyCost: 8,
  },
  {
    id: "blessing", name: "Bênção Ancestral", description: "Voce sente uma energia ancestral fluindo pelo seu corpo!",
    icon: "\u{1F31F}", type: "blessing", weight: 12,
    reward: { xp: 1000 }, energyCost: 0,
  },
  {
    id: "ancient_shrine", name: "Santuário Antigo", description: "Um santuário antigo concede seus dons!",
    icon: "\u26E9\uFE0F", type: "blessing", weight: 5,
    reward: { crystals: 15, xp: 500 }, energyCost: 2,
  },
  {
    id: "trap", name: "Armadilha", description: "Voce caiu em uma armadilha! Perdeu um pouco de ouro.",
    icon: "\u26A0\uFE0F", type: "trap", weight: 10,
    reward: {}, energyCost: 3,
  },
  {
    id: "nothing", name: "Nada", description: "Nada de especial aconteceu nesta exploracao.",
    icon: "\u{1F4A4}", type: "nothing", weight: 15,
    reward: {}, energyCost: 1,
  },
];

/** Pool de eventos por regiao (pesos customizados) */
export const REGION_EVENT_WEIGHTS: Record<string, Partial<Record<string, number>>> = {
  starter_village: { treasure_chest: 30, traveling_merchant: 20, nothing: 25, blessing: 10 },
  forgotten_forest: { rare_monster: 25, treasure_chest: 20, blessing: 15, trap: 10 },
  ancient_ruins: { golden_chest: 15, ancient_shrine: 15, rare_monster: 20, trap: 15 },
  deep_mines: { treasure_chest: 25, elite_monster: 12, trap: 18, golden_chest: 10 },
  dark_swamp: { rare_monster: 30, trap: 20, blessing: 10, nothing: 15 },
  frozen_mountains: { elite_monster: 18, golden_chest: 12, ancient_shrine: 10, trap: 15 },
  scorching_desert: { treasure_chest: 20, rare_monster: 25, trap: 20, traveling_merchant: 10 },
  imperial_castle: { golden_chest: 20, ancient_shrine: 15, elite_monster: 15, blessing: 10 },
  lost_islands: { golden_chest: 25, elite_monster: 20, ancient_shrine: 12, rare_monster: 15 },
  dragon_world: { elite_monster: 30, golden_chest: 15, ancient_shrine: 15, trap: 10 },
  demon_realm: { elite_monster: 35, golden_chest: 10, trap: 20, ancient_shrine: 10 },
  celestial_temple: { ancient_shrine: 25, golden_chest: 20, elite_monster: 15, blessing: 15 },
};

/** Rola um evento randomico para uma regiao */
export function rollWorldEvent(regionId: string, playerLevel: number): WorldEventDef {
  const weights = REGION_EVENT_WEIGHTS[regionId] || {};
  const pool: { event: WorldEventDef; weight: number }[] = [];

  for (const event of WORLD_EVENTS) {
    const w = weights[event.id] ?? event.weight;
    pool.push({ event, weight: w });
  }

  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) {
      // Scale rewards with player level
      const levelMult = 1 + (playerLevel - 1) * 0.05;
      return {
        ...p.event,
        reward: {
          gold: Math.floor((p.event.reward.gold || 0) * levelMult),
          crystals: Math.floor((p.event.reward.crystals || 0) * levelMult),
          xp: Math.floor((p.event.reward.xp || 0) * levelMult),
          diamonds: p.event.reward.diamonds || 0,
        },
      };
    }
  }

  return WORLD_EVENTS[WORLD_EVENTS.length - 1]; // fallback: nothing
}

/** Calcula recompensas de exploracao por tempo (bônus AFK) */
export function explorationAFKReward(regionId: string, playerLevel: number, hours: number): Record<string, number> {
  const levelMult = 1 + (playerLevel - 1) * 0.03;
  const maxEvents = Math.floor(hours * 3); // 3 eventos por hora
  const rewards: Record<string, number> = { gold: 0, crystals: 0, xp: 0 };

  for (let i = 0; i < maxEvents; i++) {
    const event = rollWorldEvent(regionId, playerLevel);
    rewards.gold = (rewards.gold || 0) + (event.reward.gold || 0);
    rewards.crystals = (rewards.crystals || 0) + (event.reward.crystals || 0);
    rewards.xp = (rewards.xp || 0) + (event.reward.xp || 0);
  }

  return {
    gold: Math.floor((rewards.gold || 0) * levelMult * 0.5), // 50% do normal
    crystals: Math.floor((rewards.crystals || 0) * levelMult * 0.5),
    xp: Math.floor((rewards.xp || 0) * levelMult * 0.5),
  };
}
