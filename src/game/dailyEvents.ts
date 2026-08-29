/**
 * EVENTOS DIÁRIOS 📅 — eventos agendados que mudam todo dia.
 *
 * Cada dia da semana tem um evento fixo com recompensas especiais.
 * O jogador pode participar e ganhar bônus extras além do normal.
 *
 * Eventos:
 *   - Segunda:  🐉 Invasão de Monstros — waves infinitas de XP e ouro bônus
 *   - Terça:    🏰 Masmorra Especial — dungeon com loot dobrado
 *   - Quarta:   ⚔️ Torneio PvP — batalhas com recompensas 3x
 *   - Quinta:   🎪 Mercador Viajante — itens raros com desconto
 *   - Sexta:    🗺️ Caça ao Tesouro — explore regiões para achar baús
 *   - Sábado:   👹 Boss Mundial Reforçado — boss com HP/dano reduzido
 *   - Domingo:  🎁 Dia de Descanso — XP e ouro passivos bônus
 */

export interface DailyEventDef {
  id: string;
  dayOfWeek: number; // 0=Dom, 1=Seg, ..., 6=Sáb
  icon: string;
  name: string;
  description: string;
  /** Multiplicador de recompensa base */
  rewardMultiplier: number;
  /** XP bônus por hora (para eventos passivos) */
  xpPerHour: number;
  /** Ouro bônus por hora */
  goldPerHour: number;
  /** Bônus extra percentual */
  bonusPercent: number;
  /** Tipo do evento */
  type: "active" | "passive" | "boss" | "shop" | "pvp";
  /** Recompensas extras */
  rewards: {
    gold?: number;
    xp?: number;
    crystals?: number;
    diamonds?: number;
    towerCoins?: number;
    pvpCoins?: number;
  };
}

export const DAILY_EVENTS: DailyEventDef[] = [
  {
    id: "monster_invasion",
    dayOfWeek: 1, // Segunda
    icon: "🐉",
    name: "Invasão de Monstros",
    description: "Waves de monstros invadem o mundo! Cada monstro derrotado dá XP e ouro bônus.",
    rewardMultiplier: 2,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 50,
    type: "active",
    rewards: { gold: 5000, xp: 3000, crystals: 5 },
  },
  {
    id: "special_dungeon",
    dayOfWeek: 2, // Terça
    icon: "🏰",
    name: "Masmorra Especial",
    description: "Uma masmorra secreta se abre! Loot dobrado e monstros com drops raros.",
    rewardMultiplier: 2,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 100,
    type: "active",
    rewards: { gold: 8000, crystals: 10, diamonds: 2 },
  },
  {
    id: "pvp_tournament",
    dayOfWeek: 3, // Quarta
    icon: "⚔️",
    name: "Torneio PvP",
    description: "Batalhe outros jogadores em torneio! Recompensas 3x maiores.",
    rewardMultiplier: 3,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 200,
    type: "pvp",
    rewards: { gold: 10000, pvpCoins: 50, diamonds: 3 },
  },
  {
    id: "traveling_merchant",
    dayOfWeek: 4, // Quinta
    icon: "🎪",
    name: "Mercador Viajante",
    description: "Um mercador especial traz itens raros com 50% de desconto!",
    rewardMultiplier: 1,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 50,
    type: "shop",
    rewards: { gold: 3000, diamonds: 5 },
  },
  {
    id: "treasure_hunt",
    dayOfWeek: 5, // Sexta
    icon: "🗺️",
    name: "Caça ao Tesouro",
    description: "Explore as regiões para encontrar baús escondidos com tesouros!",
    rewardMultiplier: 1.5,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 75,
    type: "active",
    rewards: { gold: 12000, crystals: 15, diamonds: 4, towerCoins: 200 },
  },
  {
    id: "world_boss_reinforced",
    dayOfWeek: 6, // Sábado
    icon: "👹",
    name: "Boss Mundial Reforçado",
    description: "O boss mundial aparece mais fraco mas com loot exclusivo!",
    rewardMultiplier: 2,
    xpPerHour: 0,
    goldPerHour: 0,
    bonusPercent: 100,
    type: "boss",
    rewards: { gold: 15000, crystals: 20, diamonds: 5, towerCoins: 300 },
  },
  {
    id: "rest_day",
    dayOfWeek: 0, // Domingo
    icon: "🎁",
    name: "Dia de Descanso",
    description: "Descanse e ganhe bônus passivo! XP e ouro duplos em AFK e todas as atividades.",
    rewardMultiplier: 1,
    xpPerHour: 500,
    goldPerHour: 300,
    bonusPercent: 100,
    type: "passive",
    rewards: { gold: 20000, xp: 10000 },
  },
];

/** Pega o evento do dia atual */
export function getTodayEvent(date: Date = new Date()): DailyEventDef {
  const day = date.getDay();
  return DAILY_EVENTS.find((e) => e.dayOfWeek === day) ?? DAILY_EVENTS[0];
}

/** Pega o próximo evento */
export function getNextEvent(date: Date = new Date()): DailyEventDef {
  const today = date.getDay();
  const tomorrow = (today + 1) % 7;
  return DAILY_EVENTS.find((e) => e.dayOfWeek === tomorrow) ?? DAILY_EVENTS[0];
}

/** Calcula o tempo até o próximo evento (em horas e minutos) */
export function getTimeUntilNextEvent(date: Date = new Date()): { hours: number; minutes: number } {
  const now = date;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

/** Gera recompensas de evento com base no nível do jogador */
export function calculateEventRewards(
  event: DailyEventDef,
  playerLevel: number,
  completedCount: number = 1
): Record<string, number> {
  const levelMultiplier = 1 + (playerLevel - 1) * 0.05;
  const completionBonus = Math.min(completedCount, 10);
  const rewards: Record<string, number> = {};

  for (const [key, baseValue] of Object.entries(event.rewards)) {
    if (typeof baseValue === "number" && baseValue > 0) {
      rewards[key] = Math.floor(baseValue * levelMultiplier * (1 + completionBonus * 0.1));
    }
  }

  return rewards;
}

/** Calcula recompensas AFK para domingo */
export function calculateAFKBonus(playerLevel: number, hoursAFK: number): Record<string, number> {
  const event = DAILY_EVENTS.find((e) => e.dayOfWeek === new Date().getDay());
  if (!event || event.id !== "rest_day") return {};

  const levelMultiplier = 1 + (playerLevel - 1) * 0.03;
  const maxHours = Math.min(hoursAFK, 12); // Max 12h

  return {
    xp: Math.floor(event.xpPerHour * maxHours * levelMultiplier),
    gold: Math.floor(event.goldPerHour * maxHours * levelMultiplier),
  };
}
