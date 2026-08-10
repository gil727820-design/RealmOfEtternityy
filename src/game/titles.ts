export interface Title {
  id: string;
  nameKey: string;
  icon: string;
  condition: (char: Record<string, unknown>) => boolean;
  rarity: "common"|"rare"|"epic"|"legendary";
}

export const TITLES: Title[] = [
  // Level titles
  { id: "novice", nameKey: "title.novice", icon: "🌱", rarity: "common", condition: c => (c.level as number) >= 1 },
  { id: "adventurer", nameKey: "title.adventurer", icon: "🗺️", rarity: "common", condition: c => (c.level as number) >= 10 },
  { id: "veteran", nameKey: "title.veteran", icon: "⚔️", rarity: "rare", condition: c => (c.level as number) >= 25 },
  { id: "champion", nameKey: "title.champion", icon: "🏆", rarity: "epic", condition: c => (c.level as number) >= 50 },
  { id: "legend", nameKey: "title.legend", icon: "👑", rarity: "legendary", condition: c => (c.level as number) >= 100 },
  
  // PvP titles
  { id: "brawler", nameKey: "title.brawler", icon: "🥊", rarity: "rare", condition: c => (c.pvpRating as number) >= 300 },
  { id: "gladiator", nameKey: "title.gladiator", icon: "⚔️", rarity: "epic", condition: c => (c.pvpRating as number) >= 1000 },
  { id: "warlord", nameKey: "title.warlord", icon: "💀", rarity: "legendary", condition: c => (c.pvpRating as number) >= 1800 },
  
  // Tower titles
  { id: "climber", nameKey: "title.climber", icon: "🧗", rarity: "rare", condition: c => (c.towerFloor as number) >= 10 },
  { id: "monster", nameKey: "title.monster", icon: "🐉", rarity: "epic", condition: c => (c.towerFloor as number) >= 25 },
  { id: "titan", nameKey: "title.titan", icon: "🏛️", rarity: "legendary", condition: c => (c.towerFloor as number) >= 50 },
  
  // Class specific
  { id: "warrior_elite", nameKey: "title.warrior_elite", icon: "⚔️", rarity: "rare", condition: c => (c.classType as string) === "warrior" && (c.level as number) >= 20 },
  { id: "mage_archon", nameKey: "title.mage_archon", icon: "🔮", rarity: "rare", condition: c => (c.classType as string) === "mage" && (c.level as number) >= 20 },
  { id: "assassin_shadow", nameKey: "title.assassin_shadow", icon: "🌑", rarity: "rare", condition: c => (c.classType as string) === "assassin" && (c.level as number) >= 20 },
  { id: "paladin_holy", nameKey: "title.paladin_holy", icon: "✨", rarity: "rare", condition: c => (c.classType as string) === "paladin" && (c.level as number) >= 20 },
  { id: "archer_eagle", nameKey: "title.archer_eagle", icon: "🦅", rarity: "rare", condition: c => (c.classType as string) === "archer" && (c.level as number) >= 20 },
  
  // Wealth
  { id: "rich", nameKey: "title.rich", icon: "💰", rarity: "rare", condition: c => (c.gold as number) >= 100000 },
  { id: "millionaire", nameKey: "title.millionaire", icon: "💎", rarity: "legendary", condition: c => (c.gold as number) >= 1000000 },
];

export function getUnlockedTitles(character: Record<string, unknown>): Title[] {
  return TITLES.filter(t => t.condition(character));
}

export function getNextTitles(character: Record<string, unknown>): Title[] {
  return TITLES.filter(t => !t.condition(character)).slice(0, 5);
}
