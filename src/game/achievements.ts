/**
 * Catálogo de CONQUISTAS do jogo.
 * Cada conquista tem uma condição verificada contra o personagem.
 * Ao desbloquear, o jogador pode coletar (claim) a recompensa no painel.
 */

export interface AchievementDef {
  id: string;
  nameKey: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  descKey: string;
  reward: { gold?: number; crystals?: number; xp?: number };
  condition: (c: Record<string, unknown>) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_steps", nameKey: "ach.name_first_steps", descKey: "ach.desc_first_steps", icon: "👣", rarity: "common",
    reward: { gold: 500 }, condition: (c) => (c.level as number) >= 1,
  },
  {
    id: "level_10", nameKey: "ach.name_level_10", descKey: "ach.desc_level_10", icon: "📈", rarity: "common",
    reward: { gold: 2000, crystals: 15 }, condition: (c) => (c.level as number) >= 10,
  },
  {
    id: "level_25", nameKey: "ach.name_level_25", descKey: "ach.desc_level_25", icon: "🔥", rarity: "rare",
    reward: { gold: 8000, crystals: 40 }, condition: (c) => (c.level as number) >= 25,
  },
  {
    id: "level_50", nameKey: "ach.name_level_50", descKey: "ach.desc_level_50", icon: "⚡", rarity: "epic",
    reward: { gold: 18000, crystals: 100 }, condition: (c) => (c.level as number) >= 50,
  },
  {
    id: "level_100", nameKey: "ach.name_level_100", descKey: "ach.desc_level_100", icon: "👑", rarity: "legendary",
    reward: { gold: 60000, crystals: 300 }, condition: (c) => (c.level as number) >= 100,
  },
  {
    id: "rich", nameKey: "ach.name_rich", descKey: "ach.desc_rich", icon: "💰", rarity: "rare",
    reward: { gold: 5000 }, condition: (c) => (c.gold as number) >= 50000,
  },
  {
    id: "millionaire", nameKey: "ach.name_millionaire", descKey: "ach.desc_millionaire", icon: "💎", rarity: "legendary",
    reward: { crystals: 500 }, condition: (c) => (c.gold as number) >= 1000000,
  },
  {
    id: "pvp_300", nameKey: "ach.name_pvp_300", descKey: "ach.desc_pvp_300", icon: "🥊", rarity: "rare",
    reward: { gold: 3000, crystals: 30 }, condition: (c) => (c.pvpRating as number) >= 300,
  },
  {
    id: "pvp_1000", nameKey: "ach.name_pvp_1000", descKey: "ach.desc_pvp_1000", icon: "⚔️", rarity: "epic",
    reward: { gold: 12000, crystals: 80 }, condition: (c) => (c.pvpRating as number) >= 1000,
  },
  {
    id: "tower_10", nameKey: "ach.name_tower_10", descKey: "ach.desc_tower_10", icon: "🏯", rarity: "common",
    reward: { gold: 2000 }, condition: (c) => (c.towerFloor as number) >= 10,
  },
  {
    id: "tower_25", nameKey: "ach.name_tower_25", descKey: "ach.desc_tower_25", icon: "🗼", rarity: "rare",
    reward: { gold: 8000, crystals: 40 }, condition: (c) => (c.towerFloor as number) >= 25,
  },
  {
    id: "tower_50", nameKey: "ach.name_tower_50", descKey: "ach.desc_tower_50", icon: "🏛️", rarity: "epic",
    reward: { gold: 20000, crystals: 130 }, condition: (c) => (c.towerFloor as number) >= 50,
  },
  {
    id: "prestige_1", nameKey: "ach.name_prestige", descKey: "ach.desc_prestige", icon: "🌟", rarity: "epic",
    reward: { gold: 15000, crystals: 130 }, condition: (c) => (c.prestige as number) >= 1,
  },
  {
    id: "guild_join", nameKey: "ach.name_guild", descKey: "ach.desc_guild", icon: "🏰", rarity: "common",
    reward: { gold: 1500 }, condition: (c) => !!c.guildId,
  },
  {
    id: "skin_3", nameKey: "ach.name_skin3", descKey: "ach.desc_skin3", icon: "🎨", rarity: "rare",
    reward: { crystals: 30 }, condition: (c) => Array.isArray(c.skins) && (c.skins as string[]).length >= 3,
  },
  {
    id: "skin_10", nameKey: "ach.name_skin10", descKey: "ach.desc_skin10", icon: "🖌️", rarity: "epic",
    reward: { crystals: 100 }, condition: (c) => Array.isArray(c.skins) && (c.skins as string[]).length >= 10,
  },
  {
    id: "power_500", nameKey: "ach.name_power500", descKey: "ach.desc_power500", icon: "💪", rarity: "common",
    reward: { gold: 1000 }, condition: (c) => (c.power as number) >= 500,
  },
  {
    id: "power_1500", nameKey: "ach.name_power1500", descKey: "ach.desc_power1500", icon: "💪", rarity: "rare",
    reward: { gold: 6000, crystals: 30 }, condition: (c) => (c.power as number) >= 1500,
  },
  {
    id: "skill_first", nameKey: "ach.name_skill_first", descKey: "ach.desc_skill_first", icon: "🌱", rarity: "common",
    reward: { gold: 1500 }, condition: (c) => {
      const s = (c.skills as Record<string, number> | undefined) ?? {};
      return Object.values(s).reduce((a, b) => a + (Number(b) || 0), 0) >= 1;
    },
  },
  {
    id: "skill_10", nameKey: "ach.name_skill_10", descKey: "ach.desc_skill_10", icon: "🌳", rarity: "rare",
    reward: { gold: 5000, crystals: 25 }, condition: (c) => {
      const s = (c.skills as Record<string, number> | undefined) ?? {};
      return Object.values(s).reduce((a, b) => a + (Number(b) || 0), 0) >= 10;
    },
  },
  {
    id: "vip_first", nameKey: "ach.name_vip_first", descKey: "ach.desc_vip_first", icon: "👑", rarity: "rare",
    reward: { gold: 3000, crystals: 20 }, condition: (c) => {
      const until = c.vipUntil as string | undefined;
      return !!c.vipTier && !!until && new Date(until).getTime() > Date.now();
    },
  },
  {
    id: "diamond_1000", nameKey: "ach.name_diamond_1000", descKey: "ach.desc_diamond_1000", icon: "💎", rarity: "rare",
    reward: { crystals: 50 }, condition: (c) => (c.diamonds as number) >= 1000,
  },
  {
    id: "dungeon_10", nameKey: "ach.name_dungeon_10", descKey: "ach.desc_dungeon_10", icon: "🕳️", rarity: "common",
    reward: { gold: 2500 }, condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 10,
  },
  {
    id: "dungeon_50", nameKey: "ach.name_dungeon_50", descKey: "ach.desc_dungeon_50", icon: "🏰", rarity: "epic",
    reward: { gold: 15000, crystals: 90 }, condition: (c) => Number((c.dungeonStats as any)?.bestFloor) >= 50,
  },
  {
    id: "guild_leader", nameKey: "ach.name_guild_leader", descKey: "ach.desc_guild_leader", icon: "👑", rarity: "epic",
    reward: { gold: 8000, crystals: 60 }, condition: (c) => (c.guildRank as string) === "leader",
  },
  {
    id: "crystals_500", nameKey: "ach.name_crystals_500", descKey: "ach.desc_crystals_500", icon: "🔮", rarity: "rare",
    reward: { gold: 4000 }, condition: (c) => (c.crystals as number) >= 500,
  },
  {
    id: "pvp_1800", nameKey: "ach.name_pvp_1800", descKey: "ach.desc_pvp_1800", icon: "⚔️", rarity: "legendary",
    reward: { gold: 30000, crystals: 200 }, condition: (c) => (c.pvpRating as number) >= 1800,
  },
];

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}