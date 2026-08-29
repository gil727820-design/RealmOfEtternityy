/**
 * QUESTLINES EPICAS — missoes de longo prazo com recompensas grandes.
 *
 * Cada questline e uma cadeia de missoes que o jogador progressa ao longo
 * do jogo. Completar todos os passos da questline desbloqueia recompensas
 * exclusivas como titulos, skins, diamantes e itens raros.
 */

export interface QuestStepDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Condicao para completar o passo */
  condition: (c: Record<string, unknown>) => boolean;
  /** Recompensa ao completar este passo */
  reward: { gold?: number; crystals?: number; xp?: number; diamonds?: number; pvpCoins?: number };
  /** Texto mostrado ao jogador sobre o que fazer */
  objective: string;
}

export interface QuestlineDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "combat" | "exploration" | "collection" | "social" | "challenge";
  difficulty: "normal" | "hard" | "epic" | "legendary";
  steps: QuestStepDef[];
  /** Recompensa final ao completar toda a questline */
  finalReward: {
    gold?: number;
    crystals?: number;
    diamonds?: number;
    title?: string;
    skin?: string;
  };
}

export const QUESTLINES: QuestlineDef[] = [
  // ═══ CAMINHO DO GUERREIRO ═══
  {
    id: "warrior_path",
    name: "Caminho do Guerreiro",
    description: "Prove seu valor como guerreiro em batalhas cada vez mais dificeis.",
    icon: "\u2694\uFE0F",
    category: "combat",
    difficulty: "normal",
    steps: [
      { id: "wp_1", name: "Primeiro Golpe", description: "Derrote 10 monstros", icon: "\u{1F480}", objective: "Derrote 10 monstros", condition: (c) => (c.level as number) >= 3, reward: { gold: 500, xp: 200 } },
      { id: "wp_2", name: "Aprendiz de Luta", description: "Atinga nivel 10", icon: "\u{1F4AA}", objective: "Atinga nivel 10", condition: (c) => (c.level as number) >= 10, reward: { gold: 2000, xp: 1000 } },
      { id: "wp_3", name: "Guerreiro Experiente", description: "Atinga nivel 25", icon: "\u{1F5E1}\uFE0F", objective: "Atinga nivel 25", condition: (c) => (c.level as number) >= 25, reward: { gold: 5000, crystals: 20 } },
      { id: "wp_4", name: "Mestre de Armas", description: "Atinga nivel 50", icon: "\u{1F480}", objective: "Atinga nivel 50", condition: (c) => (c.level as number) >= 50, reward: { gold: 15000, crystals: 50 } },
      { id: "wp_5", name: "Lenda Viva", description: "Atinga nivel 100", icon: "\u{1F451}", objective: "Atinga nivel 100", condition: (c) => (c.level as number) >= 100, reward: { gold: 50000, crystals: 200, diamonds: 10 } },
    ],
    finalReward: { gold: 100000, diamonds: 50, title: "Lenda do Campo de Batalha" },
  },

  // ═══ EXPLORADOR DA TORRE ═══
  {
    id: "tower_explorer",
    name: "Explorador da Torre",
    description: "Suba os andares da torre infinita e enfrente o impossivel.",
    icon: "\u{1F3F0}",
    category: "exploration",
    difficulty: "hard",
    steps: [
      { id: "te_1", name: "Primeiros Andares", description: "Alcance o andar 10 da torre", icon: "\u{1F3EF}", objective: "Alcance o andar 10", condition: (c) => (c.towerFloor as number) >= 10, reward: { gold: 1000, crystals: 5 } },
      { id: "te_2", name: "Subindo Alto", description: "Alcance o andar 25", icon: "\u{1F3F0}", objective: "Alcance o andar 25", condition: (c) => (c.towerFloor as number) >= 25, reward: { gold: 3000, crystals: 15 } },
      { id: "te_3", name: "Guardiao dos Andares", description: "Alcance o andar 50", icon: "\u{1F3DB}\uFE0F", objective: "Alcance o andar 50", condition: (c) => (c.towerFloor as number) >= 50, reward: { gold: 8000, crystals: 40, diamonds: 3 } },
      { id: "te_4", name: "Mestre da Torre", description: "Alcance o andar 100", icon: "\u{1F30B}", objective: "Alcance o andar 100", condition: (c) => (c.towerFloor as number) >= 100, reward: { gold: 25000, crystals: 100, diamonds: 10 } },
      { id: "te_5", name: "Cume do Infinito", description: "Alcance o andar 150", icon: "\u2B50", objective: "Alcance o andar 150", condition: (c) => (c.towerFloor as number) >= 150, reward: { gold: 80000, crystals: 300, diamonds: 25 } },
    ],
    finalReward: { gold: 200000, diamonds: 100, title: "Conquistador do Infinito" },
  },

  // ═══ CAÇADOR DE TESOUROS ═══
  {
    id: "treasure_hunter",
    name: "Cacador de Tesouros",
    description: "Acumule riquezas e colecoes que impressionam ate os reis.",
    icon: "\u{1F4B0}",
    category: "collection",
    difficulty: "normal",
    steps: [
      { id: "th_1", name: "Primeiras Moedas", description: "Acumule 10.000 de ouro", icon: "\u{1FA99}", objective: "Acumule 10.000 de ouro", condition: (c) => (c.gold as number) >= 10000, reward: { gold: 1000 } },
      { id: "th_2", name: "Rico", description: "Acumule 50.000 de ouro", icon: "\u{1F4B0}", objective: "Acumule 50.000 de ouro", condition: (c) => (c.gold as number) >= 50000, reward: { gold: 3000, crystals: 10 } },
      { id: "th_3", name: "Milionario", description: "Acumule 200.000 de ouro", icon: "\u{1F3E6}", objective: "Acumule 200.000 de ouro", condition: (c) => (c.gold as number) >= 200000, reward: { gold: 8000, crystals: 30 } },
      { id: "th_4", name: "Magnata", description: "Acumule 500.000 de ouro", icon: "\u{1F48E}", objective: "Acumule 500.000 de ouro", condition: (c) => (c.gold as number) >= 500000, reward: { gold: 20000, crystals: 80, diamonds: 5 } },
      { id: "th_5", name: "Lenda da Riqueza", description: "Acumule 1.000.000 de ouro", icon: "\u{1F451}", objective: "Acumule 1.000.000 de ouro", condition: (c) => (c.gold as number) >= 1000000, reward: { gold: 50000, crystals: 200, diamonds: 20 } },
    ],
    finalReward: { gold: 300000, diamonds: 75, title: "Lenda da Riqueza" },
  },

  // ═══ CAMPEAO PVP ═══
  {
    id: "pvp_champion",
    name: "Campeao PvP",
    description: "Domine os campos de batalha e suba no ranking PvP.",
    icon: "\u{1F3C6}",
    category: "combat",
    difficulty: "epic",
    steps: [
      { id: "pc_1", name: "Desafiante", description: "Alcance rating PvP 200", icon: "\u{1F94A}", objective: "Alcance rating 200", condition: (c) => (c.pvpRating as number) >= 200, reward: { gold: 2000, pvpCoins: 20 } },
      { id: "pc_2", name: "Guerreiro", description: "Alcance rating PvP 500", icon: "\u2694\uFE0F", objective: "Alcance rating 500", condition: (c) => (c.pvpRating as number) >= 500, reward: { gold: 5000, crystals: 20, pvpCoins: 30 } },
      { id: "pc_3", name: "Veterano", description: "Alcance rating PvP 1000", icon: "\u{1F3C6}", objective: "Alcance rating 1000", condition: (c) => (c.pvpRating as number) >= 1000, reward: { gold: 15000, crystals: 60, diamonds: 5 } },
      { id: "pc_4", name: "Elite", description: "Alcance rating PvP 1500", icon: "\u{1F451}", objective: "Alcance rating 1500", condition: (c) => (c.pvpRating as number) >= 1500, reward: { gold: 30000, crystals: 120, diamonds: 10 } },
      { id: "pc_5", name: "Lenda PvP", description: "Alcance rating PvP 2000", icon: "\u2B50", objective: "Alcance rating 2000", condition: (c) => (c.pvpRating as number) >= 2000, reward: { gold: 80000, crystals: 300, diamonds: 30 } },
    ],
    finalReward: { gold: 150000, diamonds: 100, title: "Lenda dos Campos de Batalha" },
  },

  // ═══ MESTRE DAS MAS MORRAS ═══
  {
    id: "dungeon_master",
    name: "Mestre das Masmorras",
    description: "Explore todas as masmorras e derrote seus bosses mais perigosos.",
    icon: "\u{1F573}\uFE0F",
    category: "exploration",
    difficulty: "hard",
    steps: [
      { id: "dm_1", name: "Aprendiz Explorador", description: "Complete 10 masmorras", icon: "\u{1F573}\uFE0F", objective: "Complete 10 masmorras", condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 10, reward: { gold: 2000, crystals: 10 } },
      { id: "dm_2", name: "Explorador", description: "Complete 25 masmorras", icon: "\u{1F3DA}\uFE0F", objective: "Complete 25 masmorras", condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 25, reward: { gold: 5000, crystals: 25 } },
      { id: "dm_3", name: "Veterano", description: "Complete 50 masmorras", icon: "\u{1F3F0}", objective: "Complete 50 masmorras", condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 50, reward: { gold: 12000, crystals: 50, diamonds: 3 } },
      { id: "dm_4", name: "Mestre", description: "Complete 100 masmorras", icon: "\u{1F409}", objective: "Complete 100 masmorras", condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 100, reward: { gold: 30000, crystals: 100, diamonds: 8 } },
      { id: "dm_5", name: "Lenda das Profundezas", description: "Complete 200 masmorras", icon: "\u{1F47F}", objective: "Complete 200 masmorras", condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 200, reward: { gold: 80000, crystals: 250, diamonds: 20 } },
    ],
    finalReward: { gold: 200000, diamonds: 80, title: "Mestre das Profundezas" },
  },

  // ═══ LIDER GUILDA ═══
  {
    id: "guild_leader",
    name: "Lider da Guilda",
    description: "Construa uma guilda lendaria e lidere seus membros a gloria.",
    icon: "\u{1F3F0}",
    category: "social",
    difficulty: "normal",
    steps: [
      { id: "gl_1", name: "Primeiro Passo", description: "Junte-se a uma guilda", icon: "\u{1F3F0}", objective: "Junte-se a uma guilda", condition: (c) => !!c.guildId, reward: { gold: 1000 } },
      { id: "gl_2", name: "Membro Ativo", description: "Atinga nivel 15", icon: "\u{1F4AA}", objective: "Atinga nivel 15", condition: (c) => (c.level as number) >= 15, reward: { gold: 3000, crystals: 15 } },
      { id: "gl_3", name: "Oficial", description: "Atinga nivel 30", icon: "\u{1F451}", objective: "Atinga nivel 30", condition: (c) => (c.level as number) >= 30, reward: { gold: 8000, crystals: 40 } },
      { id: "gl_4", name: "Vice-Lider", description: "Atinga nivel 50", icon: "\u2694\uFE0F", objective: "Atinga nivel 50", condition: (c) => (c.level as number) >= 50, reward: { gold: 20000, crystals: 80, diamonds: 5 } },
      { id: "gl_5", name: "Lenda da Guilda", description: "Atinga nivel 80 e seja lider", icon: "\u{1F3C6}", objective: "Atinga nivel 80 e seja lider", condition: (c) => (c.level as number) >= 80, reward: { gold: 50000, crystals: 150, diamonds: 15 } },
    ],
    finalReward: { gold: 150000, diamonds: 60, title: "Lenda da Guilda" },
  },
];

/** Busca uma questline pelo ID */
export function getQuestlineById(id: string): QuestlineDef | undefined {
  return QUESTLINES.find((q) => q.id === id);
}

/** Retorna o progresso de uma questline para um personagem */
export function getQuestlineProgress(
  questline: QuestlineDef,
  character: Record<string, unknown>,
  completedSteps: string[]
): { currentStep: number; totalSteps: number; completed: boolean; steps: Array<{ step: QuestStepDef; done: boolean }> } {
  const steps = questline.steps.map((step) => ({
    step,
    done: completedSteps.includes(step.id),
  }));

  const currentStep = steps.findIndex((s) => !s.done);
  const completed = steps.every((s) => s.done);

  return {
    currentStep: currentStep >= 0 ? currentStep : steps.length,
    totalSteps: steps.length,
    completed,
    steps,
  };
}

/** Calcula recompensas totais de uma questline */
export function questlineTotalRewards(questline: QuestlineDef): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const step of questline.steps) {
    for (const [key, val] of Object.entries(step.reward)) {
      if (typeof val === "number") totals[key] = (totals[key] || 0) + val;
    }
  }
  // Add final reward
  for (const [key, val] of Object.entries(questline.finalReward)) {
    if (typeof val === "number") totals[key] = (totals[key] || 0) + val;
  }
  return totals;
}
