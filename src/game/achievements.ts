/**
 * Catalogo de CONQUISTAS do jogo — Mega Update
 * 55 conquistas em 7 categorias.
 */

export interface AchievementDef {
  id: string;
  nameKey: string;
  icon: string;
  category: "combat" | "exploration" | "social" | "collection" | "economy" | "progression" | "special";
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  descKey: string;
  reward: { gold?: number; crystals?: number; xp?: number; diamonds?: number };
  condition: (c: Record<string, unknown>) => boolean;
  progress?: (c: Record<string, unknown>) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // COMBAT
  { id: "first_blood", nameKey: "ach.name_first_blood", icon: "\u{1FA78}", category: "combat", rarity: "common", descKey: "ach.desc_first_blood", reward: { gold: 300 }, condition: (c) => (c.level as number) >= 2 },
  { id: "slayer_10", nameKey: "ach.name_slayer_10", icon: "\u2694\uFE0F", category: "combat", rarity: "common", descKey: "ach.desc_slayer_10", reward: { gold: 1000, xp: 500 }, condition: (c) => (c.level as number) >= 5 },
  { id: "slayer_100", nameKey: "ach.name_slayer_100", icon: "\u{1F5E1}\uFE0F", category: "combat", rarity: "rare", descKey: "ach.desc_slayer_100", reward: { gold: 5000, crystals: 20 }, condition: (c) => (c.level as number) >= 15 },
  { id: "slayer_1000", nameKey: "ach.name_slayer_1000", icon: "\u{1F480}", category: "combat", rarity: "epic", descKey: "ach.desc_slayer_1000", reward: { gold: 20000, crystals: 80, diamonds: 3 }, condition: (c) => (c.level as number) >= 40 },
  { id: "boss_slayer", nameKey: "ach.name_boss_slayer", icon: "\u{1F479}", category: "combat", rarity: "rare", descKey: "ach.desc_boss_slayer", reward: { gold: 8000, crystals: 30 }, condition: (c) => (c.level as number) >= 10 },
  { id: "boss_hunter", nameKey: "ach.name_boss_hunter", icon: "\u{1F3AF}", category: "combat", rarity: "epic", descKey: "ach.desc_boss_hunter", reward: { gold: 25000, crystals: 100, diamonds: 5 }, condition: (c) => (c.level as number) >= 50 },
  { id: "pvp_novice", nameKey: "ach.name_pvp_novice", icon: "\u{1F94A}", category: "combat", rarity: "common", descKey: "ach.desc_pvp_novice", reward: { gold: 1500 }, condition: (c) => (c.pvpRating as number) >= 100 },
  { id: "pvp_warrior", nameKey: "ach.name_pvp_warrior", icon: "\u2694\uFE0F", category: "combat", rarity: "rare", descKey: "ach.desc_pvp_warrior", reward: { gold: 5000, crystals: 25 }, condition: (c) => (c.pvpRating as number) >= 500 },
  { id: "pvp_champion", nameKey: "ach.name_pvp_champion", icon: "\u{1F3C6}", category: "combat", rarity: "epic", descKey: "ach.desc_pvp_champion", reward: { gold: 15000, crystals: 80, diamonds: 5 }, condition: (c) => (c.pvpRating as number) >= 1200 },
  { id: "pvp_legend", nameKey: "ach.name_pvp_legend", icon: "\u{1F451}", category: "combat", rarity: "legendary", descKey: "ach.desc_pvp_legend", reward: { gold: 40000, crystals: 200, diamonds: 15 }, condition: (c) => (c.pvpRating as number) >= 1800 },
  // EXPLORATION
  { id: "tower_climber", nameKey: "ach.name_tower_climber", icon: "\u{1F3EF}", category: "exploration", rarity: "common", descKey: "ach.desc_tower_climber", reward: { gold: 1500 }, condition: (c) => (c.towerFloor as number) >= 5, progress: (c) => Math.min(100, ((c.towerFloor as number) || 0) / 5 * 100) },
  { id: "tower_10", nameKey: "ach.name_tower_10", icon: "\u{1F5FC}", category: "exploration", rarity: "common", descKey: "ach.desc_tower_10", reward: { gold: 3000 }, condition: (c) => (c.towerFloor as number) >= 10 },
  { id: "tower_25", nameKey: "ach.name_tower_25", icon: "\u{1F3F0}", category: "exploration", rarity: "rare", descKey: "ach.desc_tower_25", reward: { gold: 10000, crystals: 40 }, condition: (c) => (c.towerFloor as number) >= 25 },
  { id: "tower_50", nameKey: "ach.name_tower_50", icon: "\u{1F3DB}\uFE0F", category: "exploration", rarity: "epic", descKey: "ach.desc_tower_50", reward: { gold: 25000, crystals: 120, diamonds: 5 }, condition: (c) => (c.towerFloor as number) >= 50 },
  { id: "tower_100", nameKey: "ach.name_tower_100", icon: "\u{1F30B}", category: "exploration", rarity: "legendary", descKey: "ach.desc_tower_100", reward: { gold: 60000, crystals: 300, diamonds: 20 }, condition: (c) => (c.towerFloor as number) >= 100 },
  { id: "dungeon_novice", nameKey: "ach.name_dungeon_novice", icon: "\u{1F573}\uFE0F", category: "exploration", rarity: "common", descKey: "ach.desc_dungeon_novice", reward: { gold: 2000 }, condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 5 },
  { id: "dungeon_10", nameKey: "ach.name_dungeon_10", icon: "\u{1F3DA}\uFE0F", category: "exploration", rarity: "common", descKey: "ach.desc_dungeon_10", reward: { gold: 3000 }, condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 10 },
  { id: "dungeon_50", nameKey: "ach.name_dungeon_50", icon: "\u{1F3F0}", category: "exploration", rarity: "epic", descKey: "ach.desc_dungeon_50", reward: { gold: 18000, crystals: 90, diamonds: 5 }, condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 50 },
  { id: "dungeon_master", nameKey: "ach.name_dungeon_master", icon: "\u{1F409}", category: "exploration", rarity: "legendary", descKey: "ach.desc_dungeon_master", reward: { gold: 50000, crystals: 250, diamonds: 15 }, condition: (c) => Number((c.dungeonStats as any)?.totalRuns) >= 100 },
  // SOCIAL
  { id: "guild_join", nameKey: "ach.name_guild", icon: "\u{1F3F0}", category: "social", rarity: "common", descKey: "ach.desc_guild", reward: { gold: 1500 }, condition: (c) => !!c.guildId },
  { id: "guild_leader", nameKey: "ach.name_guild_leader", icon: "\u{1F451}", category: "social", rarity: "epic", descKey: "ach.desc_guild_leader", reward: { gold: 10000, crystals: 60 }, condition: (c) => (c.guildRank as string) === "leader" },
  { id: "trader_1", nameKey: "ach.name_trader_1", icon: "\u{1F504}", category: "social", rarity: "common", descKey: "ach.desc_trader_1", reward: { gold: 1000 }, condition: (c) => (c.level as number) >= 5 },
  { id: "social_butterfly", nameKey: "ach.name_social_butterfly", icon: "\u{1F98B}", category: "social", rarity: "rare", descKey: "ach.desc_social_butterfly", reward: { gold: 5000, crystals: 20 }, condition: (c) => (c.level as number) >= 20 },
  // COLLECTION
  { id: "first_pet", nameKey: "ach.name_first_pet", icon: "\u{1F43E}", category: "collection", rarity: "common", descKey: "ach.desc_first_pet", reward: { gold: 1000 }, condition: (c) => Array.isArray(c.pets) && (c.pets as any[]).length >= 1 },
  { id: "pet_collector", nameKey: "ach.name_pet_collector", icon: "\u{1F431}", category: "collection", rarity: "rare", descKey: "ach.desc_pet_collector", reward: { gold: 5000, crystals: 25 }, condition: (c) => Array.isArray(c.pets) && (c.pets as any[]).length >= 5 },
  { id: "pet_master", nameKey: "ach.name_pet_master", icon: "\u{1F409}", category: "collection", rarity: "epic", descKey: "ach.desc_pet_master", reward: { gold: 20000, crystals: 100, diamonds: 5 }, condition: (c) => Array.isArray(c.pets) && (c.pets as any[]).length >= 9 },
  { id: "relic_collector", nameKey: "ach.name_relic_collector", icon: "\u{1F4FF}", category: "collection", rarity: "common", descKey: "ach.desc_relic_collector", reward: { gold: 2000 }, condition: (c) => Array.isArray(c.relics) && (c.relics as any[]).length >= 3 },
  { id: "relic_master", nameKey: "ach.name_relic_master", icon: "\u{1F52E}", category: "collection", rarity: "epic", descKey: "ach.desc_relic_master", reward: { gold: 15000, crystals: 80 }, condition: (c) => Array.isArray(c.relics) && (c.relics as any[]).length >= 10 },
  { id: "skin_3", nameKey: "ach.name_skin3", icon: "\u{1F3A8}", category: "collection", rarity: "rare", descKey: "ach.desc_skin3", reward: { crystals: 30 }, condition: (c) => Array.isArray(c.skins) && (c.skins as string[]).length >= 3 },
  { id: "skin_10", nameKey: "ach.name_skin10", icon: "\u{1F58C}\uFE0F", category: "collection", rarity: "epic", descKey: "ach.desc_skin10", reward: { crystals: 100, diamonds: 3 }, condition: (c) => Array.isArray(c.skins) && (c.skins as string[]).length >= 10 },
  { id: "bestiary_10", nameKey: "ach.name_bestiary_10", icon: "\u{1F4DA}", category: "collection", rarity: "common", descKey: "ach.desc_bestiary_10", reward: { gold: 2000 }, condition: (c) => Array.isArray(c.bestiary) && (c.bestiary as any[]).length >= 10 },
  { id: "bestiary_50", nameKey: "ach.name_bestiary_50", icon: "\u{1F4D6}", category: "collection", rarity: "rare", descKey: "ach.desc_bestiary_50", reward: { gold: 10000, crystals: 50 }, condition: (c) => Array.isArray(c.bestiary) && (c.bestiary as any[]).length >= 50 },
  { id: "bestiary_100", nameKey: "ach.name_bestiary_100", icon: "\u{1F4D5}", category: "collection", rarity: "legendary", descKey: "ach.desc_bestiary_100", reward: { gold: 50000, crystals: 250, diamonds: 20 }, condition: (c) => Array.isArray(c.bestiary) && (c.bestiary as any[]).length >= 100 },
  // ECONOMY
  { id: "first_gold", nameKey: "ach.name_first_gold", icon: "\u{1FA99}", category: "economy", rarity: "common", descKey: "ach.desc_first_gold", reward: { gold: 500 }, condition: (c) => (c.gold as number) >= 1000, progress: (c) => Math.min(100, ((c.gold as number) || 0) / 1000 * 100) },
  { id: "rich", nameKey: "ach.name_rich", icon: "\u{1F4B0}", category: "economy", rarity: "rare", descKey: "ach.desc_rich", reward: { gold: 5000, crystals: 20 }, condition: (c) => (c.gold as number) >= 50000 },
  { id: "wealthy", nameKey: "ach.name_wealthy", icon: "\u{1F3E6}", category: "economy", rarity: "epic", descKey: "ach.desc_wealthy", reward: { gold: 20000, crystals: 100, diamonds: 5 }, condition: (c) => (c.gold as number) >= 200000 },
  { id: "millionaire", nameKey: "ach.name_millionaire", icon: "\u{1F48E}", category: "economy", rarity: "legendary", descKey: "ach.desc_millionaire", reward: { crystals: 500, diamonds: 25 }, condition: (c) => (c.gold as number) >= 1000000 },
  { id: "crystal_100", nameKey: "ach.name_crystal_100", icon: "\u{1F52E}", category: "economy", rarity: "common", descKey: "ach.desc_crystal_100", reward: { gold: 2000 }, condition: (c) => (c.crystals as number) >= 100 },
  { id: "crystal_500", nameKey: "ach.name_crystal_500", icon: "\u{1F52E}", category: "economy", rarity: "rare", descKey: "ach.desc_crystal_500", reward: { gold: 5000, crystals: 30 }, condition: (c) => (c.crystals as number) >= 500 },
  { id: "diamond_100", nameKey: "ach.name_diamond_100", icon: "\u{1F48E}", category: "economy", rarity: "rare", descKey: "ach.desc_diamond_100", reward: { gold: 3000, crystals: 20 }, condition: (c) => (c.diamonds as number) >= 100 },
  { id: "diamond_1000", nameKey: "ach.name_diamond_1000", icon: "\u{1F48E}", category: "economy", rarity: "legendary", descKey: "ach.desc_diamond_1000", reward: { crystals: 100, diamonds: 10 }, condition: (c) => (c.diamonds as number) >= 1000 },
  // PROGRESSION
  { id: "first_steps", nameKey: "ach.name_first_steps", icon: "\u{1F463}", category: "progression", rarity: "common", descKey: "ach.desc_first_steps", reward: { gold: 500 }, condition: (c) => (c.level as number) >= 1 },
  { id: "level_10", nameKey: "ach.name_level_10", icon: "\u{1F4C8}", category: "progression", rarity: "common", descKey: "ach.desc_level_10", reward: { gold: 2000, crystals: 15 }, condition: (c) => (c.level as number) >= 10, progress: (c) => Math.min(100, ((c.level as number) || 0) / 10 * 100) },
  { id: "level_25", nameKey: "ach.name_level_25", icon: "\u{1F525}", category: "progression", rarity: "rare", descKey: "ach.desc_level_25", reward: { gold: 8000, crystals: 40 }, condition: (c) => (c.level as number) >= 25, progress: (c) => Math.min(100, ((c.level as number) || 0) / 25 * 100) },
  { id: "level_50", nameKey: "ach.name_level_50", icon: "\u26A1", category: "progression", rarity: "epic", descKey: "ach.desc_level_50", reward: { gold: 20000, crystals: 100, diamonds: 5 }, condition: (c) => (c.level as number) >= 50, progress: (c) => Math.min(100, ((c.level as number) || 0) / 50 * 100) },
  { id: "level_100", nameKey: "ach.name_level_100", icon: "\u{1F451}", category: "progression", rarity: "legendary", descKey: "ach.desc_level_100", reward: { gold: 60000, crystals: 300, diamonds: 25 }, condition: (c) => (c.level as number) >= 100, progress: (c) => Math.min(100, ((c.level as number) || 0) / 100 * 100) },
  { id: "level_150", nameKey: "ach.name_level_150", icon: "\u2B50", category: "progression", rarity: "mythic", descKey: "ach.desc_level_150", reward: { gold: 150000, crystals: 500, diamonds: 50 }, condition: (c) => (c.level as number) >= 150 },
  { id: "skill_first", nameKey: "ach.name_skill_first", icon: "\u{1F331}", category: "progression", rarity: "common", descKey: "ach.desc_skill_first", reward: { gold: 1500 }, condition: (c) => { const s = (c.skills as Record<string, number> | undefined) ?? {}; return Object.values(s).reduce((a, b) => a + (Number(b) || 0), 0) >= 1; } },
  { id: "skill_10", nameKey: "ach.name_skill_10", icon: "\u{1F333}", category: "progression", rarity: "rare", descKey: "ach.desc_skill_10", reward: { gold: 5000, crystals: 25 }, condition: (c) => { const s = (c.skills as Record<string, number> | undefined) ?? {}; return Object.values(s).reduce((a, b) => a + (Number(b) || 0), 0) >= 10; } },
  { id: "skill_50", nameKey: "ach.name_skill_50", icon: "\u{1F332}", category: "progression", rarity: "epic", descKey: "ach.desc_skill_50", reward: { gold: 15000, crystals: 80, diamonds: 5 }, condition: (c) => { const s = (c.skills as Record<string, number> | undefined) ?? {}; return Object.values(s).reduce((a, b) => a + (Number(b) || 0), 0) >= 50; } },
  { id: "prestige_1", nameKey: "ach.name_prestige", icon: "\u{1F31F}", category: "progression", rarity: "epic", descKey: "ach.desc_prestige", reward: { gold: 15000, crystals: 130, diamonds: 3 }, condition: (c) => (c.prestige as number) >= 1 },
  { id: "prestige_5", nameKey: "ach.name_prestige_5", icon: "\u2728", category: "progression", rarity: "legendary", descKey: "ach.desc_prestige_5", reward: { gold: 50000, crystals: 250, diamonds: 20 }, condition: (c) => (c.prestige as number) >= 5 },
  // SPECIAL
  { id: "power_500", nameKey: "ach.name_power500", icon: "\u{1F4AA}", category: "special", rarity: "common", descKey: "ach.desc_power500", reward: { gold: 1000 }, condition: (c) => (c.power as number) >= 500, progress: (c) => Math.min(100, ((c.power as number) || 0) / 500 * 100) },
  { id: "power_1500", nameKey: "ach.name_power1500", icon: "\u{1F4AA}", category: "special", rarity: "rare", descKey: "ach.desc_power1500", reward: { gold: 6000, crystals: 30 }, condition: (c) => (c.power as number) >= 1500, progress: (c) => Math.min(100, ((c.power as number) || 0) / 1500 * 100) },
  { id: "power_5000", nameKey: "ach.name_power5000", icon: "\u{1F525}", category: "special", rarity: "epic", descKey: "ach.desc_power5000", reward: { gold: 20000, crystals: 100, diamonds: 8 }, condition: (c) => (c.power as number) >= 5000 },
  { id: "power_20000", nameKey: "ach.name_power20000", icon: "\u{1F30B}", category: "special", rarity: "legendary", descKey: "ach.desc_power20000", reward: { gold: 80000, crystals: 400, diamonds: 30 }, condition: (c) => (c.power as number) >= 20000 },
  { id: "vip_first", nameKey: "ach.name_vip_first", icon: "\u{1F451}", category: "special", rarity: "rare", descKey: "ach.desc_vip_first", reward: { gold: 3000, crystals: 20 }, condition: (c) => { const until = c.vipUntil as string | undefined; return !!c.vipTier && !!until && new Date(until).getTime() > Date.now(); } },
  { id: "craft_first", nameKey: "ach.name_craft_first", icon: "\u2692\uFE0F", category: "special", rarity: "common", descKey: "ach.desc_craft_first", reward: { gold: 1000 }, condition: (c) => (c.level as number) >= 3 },
  { id: "afk_master", nameKey: "ach.name_afk_master", icon: "\u{1F4A4}", category: "special", rarity: "common", descKey: "ach.desc_afk_master", reward: { gold: 2000 }, condition: (c) => (c.level as number) >= 5 },
];

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export const ACHIEVEMENT_CATEGORIES = [
  { id: "combat", icon: "\u2694\uFE0F", label: "Combate", color: "#e94560" },
  { id: "exploration", icon: "\u{1F5FA}\uFE0F", label: "Exploracao", color: "#4ecdc4" },
  { id: "social", icon: "\u{1F465}", label: "Social", color: "#f59e0b" },
  { id: "collection", icon: "\u{1F392}", label: "Colecao", color: "#a855f7" },
  { id: "economy", icon: "\u{1F4B0}", label: "Economia", color: "#22c55e" },
  { id: "progression", icon: "\u{1F4C8}", label: "Progressao", color: "#3b82f6" },
  { id: "special", icon: "\u2B50", label: "Especial", color: "#fbbf24" },
] as const;
