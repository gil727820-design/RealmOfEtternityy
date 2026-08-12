import { NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { missingRegionMissions } from "@/game/generatedMissions";

const ITEMS = [
  { nameKey: "item.wooden_sword", slot: "weapon" as const, rarity: "common" as const, minLevel: 1, attack: 5, defense: 0, hp: 0, speed: 0, critical: 1, icon: "⚔️", sellPrice: 10 },
  { nameKey: "item.iron_sword", slot: "weapon" as const, rarity: "uncommon" as const, minLevel: 5, attack: 12, defense: 0, hp: 0, speed: 1, critical: 2, icon: "🗡️", sellPrice: 50 },
  { nameKey: "item.steel_blade", slot: "weapon" as const, rarity: "rare" as const, minLevel: 10, attack: 22, defense: 0, hp: 0, speed: 2, critical: 4, icon: "⚔️", sellPrice: 150 },
  { nameKey: "item.flame_sword", slot: "weapon" as const, rarity: "epic" as const, minLevel: 20, attack: 40, defense: 5, hp: 10, speed: 3, critical: 6, icon: "🔥", sellPrice: 500 },
  { nameKey: "item.frost_staff", slot: "weapon" as const, rarity: "epic" as const, minLevel: 20, attack: 35, defense: 0, hp: 0, speed: 2, critical: 5, icon: "❄️", sellPrice: 480 },
  { nameKey: "item.shadow_dagger", slot: "weapon" as const, rarity: "legendary" as const, minLevel: 30, attack: 55, defense: 0, hp: 0, speed: 8, critical: 15, icon: "🌑", sellPrice: 1200 },
  { nameKey: "item.leather_armor", slot: "armor" as const, rarity: "common" as const, minLevel: 1, attack: 0, defense: 8, hp: 15, speed: 0, critical: 0, icon: "🦺", sellPrice: 15 },
  { nameKey: "item.iron_armor", slot: "armor" as const, rarity: "uncommon" as const, minLevel: 5, attack: 0, defense: 18, hp: 30, speed: -1, critical: 0, icon: "🛡️", sellPrice: 60 },
  { nameKey: "item.dragon_armor", slot: "armor" as const, rarity: "legendary" as const, minLevel: 30, attack: 10, defense: 50, hp: 100, speed: 2, critical: 3, icon: "🐉", sellPrice: 1500 },
  { nameKey: "item.wooden_shield", slot: "shield" as const, rarity: "common" as const, minLevel: 1, attack: 0, defense: 6, hp: 10, speed: 0, critical: 0, icon: "🪵", sellPrice: 8 },
  { nameKey: "item.holy_shield", slot: "shield" as const, rarity: "epic" as const, minLevel: 20, attack: 0, defense: 35, hp: 50, speed: 0, critical: 0, icon: "✨", sellPrice: 600 },
  { nameKey: "item.iron_helmet", slot: "helmet" as const, rarity: "common" as const, minLevel: 1, attack: 0, defense: 5, hp: 8, speed: 0, critical: 0, icon: "⛑️", sellPrice: 12 },
  { nameKey: "item.titan_helmet", slot: "helmet" as const, rarity: "legendary" as const, minLevel: 30, attack: 5, defense: 40, hp: 80, speed: 0, critical: 2, icon: "👑", sellPrice: 1300 },
  { nameKey: "item.leather_boots", slot: "boots" as const, rarity: "common" as const, minLevel: 1, attack: 0, defense: 3, hp: 0, speed: 3, critical: 0, icon: "👢", sellPrice: 8 },
  { nameKey: "item.cloth_pants", slot: "pants" as const, rarity: "common" as const, minLevel: 1, attack: 0, defense: 4, hp: 5, speed: 1, critical: 0, icon: "👖", sellPrice: 7 },
  { nameKey: "item.copper_ring", slot: "ring" as const, rarity: "uncommon" as const, minLevel: 3, attack: 3, defense: 2, hp: 5, speed: 1, critical: 1, icon: "💍", sellPrice: 25 },
  { nameKey: "item.mystic_ring", slot: "ring" as const, rarity: "legendary" as const, minLevel: 25, attack: 15, defense: 10, hp: 30, speed: 5, critical: 8, icon: "💎", sellPrice: 1100 },
  { nameKey: "item.bone_amulet", slot: "amulet" as const, rarity: "uncommon" as const, minLevel: 5, attack: 5, defense: 3, hp: 10, speed: 0, critical: 2, icon: "📿", sellPrice: 35 },
  { nameKey: "item.phoenix_amulet", slot: "amulet" as const, rarity: "mythic" as const, minLevel: 40, attack: 20, defense: 15, hp: 60, speed: 5, critical: 10, icon: "🔥", sellPrice: 2000 },
  { nameKey: "item.leather_gloves", slot: "gloves" as const, rarity: "common" as const, minLevel: 1, attack: 2, defense: 2, hp: 0, speed: 1, critical: 1, icon: "🧤", sellPrice: 8 },
];

// Consumíveis (empilháveis) — obtidos em baús, drops e no inventário inicial.
const CONSUMABLES = [
  { nameKey: "item.hp_potion", descKey: "item.hp_potion.desc", type: "consumable", stackable: true, rarity: "common" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "🧪", sellPrice: 15, effect: { hp: 150 } },
  { nameKey: "item.mana_potion", descKey: "item.mana_potion.desc", type: "consumable", stackable: true, rarity: "common" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "🔷", sellPrice: 15, effect: { mana: 150 } },
  { nameKey: "item.energy_potion", descKey: "item.energy_potion.desc", type: "consumable", stackable: true, rarity: "uncommon" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "⚡", sellPrice: 25, effect: { energy: 40 } },
  { nameKey: "item.elixir_xp", descKey: "item.elixir_xp.desc", type: "consumable", stackable: true, rarity: "uncommon" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "✨", sellPrice: 40, effect: { xp: 30 } },
  // Poções de BOOST (2x) — duração em horas, aplicadas via character.boosts
  { nameKey: "item.boost_xp", descKey: "item.boost_xp.desc", type: "consumable", stackable: true, rarity: "rare" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "🚀", sellPrice: 150, effect: { boostXpHours: 2 } },
  { nameKey: "item.boost_energy", descKey: "item.boost_energy.desc", type: "consumable", stackable: true, rarity: "rare" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "🔋", sellPrice: 150, effect: { boostEnergyHours: 2 } },
  { nameKey: "item.boost_both", descKey: "item.boost_both.desc", type: "consumable", stackable: true, rarity: "epic" as const, minLevel: 1, attack: 0, defense: 0, hp: 0, speed: 0, critical: 0, icon: "💠", sellPrice: 250, effect: { boostXpHours: 2, boostEnergyHours: 2 } },
];

const MISSIONS = [
  { nameKey: "mission.patrol_village", region: "starter_village", minLevel: 1, durationSec: 30, xpReward: 30, goldReward: 20, energyCost: 5, difficulty: 1, icon: "🏘️" },
  { nameKey: "mission.kill_slimes", region: "starter_village", minLevel: 1, durationSec: 45, xpReward: 50, goldReward: 35, energyCost: 8, difficulty: 1, icon: "🟢" },
  { nameKey: "mission.gather_herbs", region: "starter_village", minLevel: 2, durationSec: 60, xpReward: 60, goldReward: 40, energyCost: 8, difficulty: 1, icon: "🌿" },
  { nameKey: "mission.escort_merchant", region: "starter_village", minLevel: 3, durationSec: 90, xpReward: 100, goldReward: 70, energyCost: 12, difficulty: 2, icon: "🧑‍🤝‍🧑" },
  { nameKey: "mission.deliver_letter", region: "starter_village", minLevel: 1, durationSec: 20, xpReward: 20, goldReward: 15, energyCost: 3, difficulty: 1, icon: "📨" },
  { nameKey: "mission.hunt_wolves", region: "forgotten_forest", minLevel: 5, durationSec: 60, xpReward: 80, goldReward: 55, energyCost: 10, difficulty: 2, icon: "🐺" },
  { nameKey: "mission.scout_forest", region: "forgotten_forest", minLevel: 5, durationSec: 45, xpReward: 65, goldReward: 45, energyCost: 8, difficulty: 2, icon: "🌲" },
  { nameKey: "mission.explore_ruins", region: "ancient_ruins", minLevel: 10, durationSec: 120, xpReward: 150, goldReward: 100, energyCost: 15, difficulty: 3, icon: "🏛️" },
  { nameKey: "mission.seek_artifact", region: "ancient_ruins", minLevel: 12, durationSec: 180, xpReward: 250, goldReward: 180, energyCost: 20, difficulty: 4, icon: "🏺" },
  { nameKey: "mission.mine_ore", region: "deep_mines", minLevel: 15, durationSec: 90, xpReward: 120, goldReward: 90, energyCost: 12, difficulty: 3, icon: "⛏️" },
  { nameKey: "mission.clear_cave", region: "deep_mines", minLevel: 16, durationSec: 150, xpReward: 200, goldReward: 150, energyCost: 18, difficulty: 4, icon: "🕳️" },
  { nameKey: "mission.fight_undead", region: "dark_swamp", minLevel: 20, durationSec: 120, xpReward: 180, goldReward: 130, energyCost: 15, difficulty: 4, icon: "💀" },
  { nameKey: "mission.tame_beast", region: "dark_swamp", minLevel: 22, durationSec: 200, xpReward: 300, goldReward: 220, energyCost: 22, difficulty: 5, icon: "🐊" },
  { nameKey: "mission.defeat_bandit", region: "forgotten_forest", minLevel: 7, durationSec: 80, xpReward: 100, goldReward: 80, energyCost: 12, difficulty: 3, icon: "🗡️" },
  { nameKey: "mission.defend_wall", region: "frozen_mountains", minLevel: 30, durationSec: 240, xpReward: 400, goldReward: 300, energyCost: 25, difficulty: 6, icon: "🏔️" },
  { nameKey: "mission.fish_river", region: "starter_village", minLevel: 1, durationSec: 35, xpReward: 30, goldReward: 22, energyCost: 5, difficulty: 1, icon: "🎣" },
  { nameKey: "mission.help_farmer", region: "starter_village", minLevel: 1, durationSec: 40, xpReward: 35, goldReward: 25, energyCost: 6, difficulty: 1, icon: "🌾" },
  { nameKey: "mission.collect_fruits", region: "starter_village", minLevel: 1, durationSec: 30, xpReward: 25, goldReward: 18, energyCost: 4, difficulty: 1, icon: "🍎" },
  { nameKey: "mission.light_torches", region: "starter_village", minLevel: 1, durationSec: 25, xpReward: 25, goldReward: 16, energyCost: 4, difficulty: 1, icon: "🕯️" },
  { nameKey: "mission.collect_wood", region: "starter_village", minLevel: 1, durationSec: 50, xpReward: 45, goldReward: 32, energyCost: 7, difficulty: 1, icon: "🪵" },
  { nameKey: "mission.catch_chickens", region: "starter_village", minLevel: 1, durationSec: 55, xpReward: 45, goldReward: 34, energyCost: 7, difficulty: 1, icon: "🐔" },
  { nameKey: "mission.clean_well", region: "starter_village", minLevel: 2, durationSec: 70, xpReward: 65, goldReward: 45, energyCost: 9, difficulty: 2, icon: "🪣" },
  { nameKey: "mission.fix_bridge", region: "starter_village", minLevel: 2, durationSec: 85, xpReward: 85, goldReward: 60, energyCost: 11, difficulty: 2, icon: "🌉" },
  { nameKey: "mission.guard_fountain", region: "starter_village", minLevel: 3, durationSec: 95, xpReward: 110, goldReward: 75, energyCost: 12, difficulty: 2, icon: "⛲" },
  { nameKey: "mission.help_blacksmith", region: "starter_village", minLevel: 3, durationSec: 110, xpReward: 120, goldReward: 85, energyCost: 14, difficulty: 3, icon: "⚒️" },
  { nameKey: "mission.clean_camp", region: "forgotten_forest", minLevel: 5, durationSec: 70, xpReward: 90, goldReward: 60, energyCost: 10, difficulty: 2, icon: "🏕️" },
  { nameKey: "mission.gather_mushrooms", region: "forgotten_forest", minLevel: 5, durationSec: 50, xpReward: 75, goldReward: 50, energyCost: 8, difficulty: 2, icon: "🍄" },
];

export async function POST() {
  try {
    // Check if items already seeded
    const existingItems = await jsonDb.getAllItemTemplates();
    
    let itemsInserted = 0;
    if (existingItems.length === 0) {
      await jsonDb.insertItemTemplates(ITEMS as any[]);
      itemsInserted = ITEMS.length;
    }

    // Consumíveis: inseridos separadamente p/ manter o seed idempotente mesmo
    // quando os equipamentos já existirem (bancos antigos). Poções de boost
    // entram mesmo num banco que já tenha os consumíveis básicos.
    const hasStdConsumables = existingItems.some((it: any) => it.type === "consumable" && !(it.effect && (it.effect.boostXpHours || it.effect.boostEnergyHours)));
    const hasBoostConsumables = existingItems.some((it: any) => it.effect && (it.effect.boostXpHours || it.effect.boostEnergyHours));
    const toInsertConsumables = [
      ...(hasStdConsumables ? [] : CONSUMABLES.filter((c: any) => !(c.effect && (c.effect.boostXpHours || c.effect.boostEnergyHours)))),
      ...(hasBoostConsumables ? [] : CONSUMABLES.filter((c: any) => c.effect && (c.effect.boostXpHours || c.effect.boostEnergyHours))),
    ];
    if (toInsertConsumables.length > 0) {
      await jsonDb.insertItemTemplates(toInsertConsumables as any[]);
      itemsInserted += toInsertConsumables.length;
    }

    // Check if missions already seeded
    const existingMissions = await jsonDb.getMissionTemplates();
    let missionsInserted = 0;
    if (existingMissions.length === 0) {
      await jsonDb.insertMissionTemplates(MISSIONS as any[]);
      missionsInserted = MISSIONS.length;
    }
    // Ilhas que ainda não têm nenhuma missão manual (ex.: Ruínas Antigas, Minas
    // Profundas...) recebem missões geradas automaticamente, persistidas com IDs
    // negativos estáveis e idempotentes (ON CONFLICT DO NOTHING).
    const generated = missingRegionMissions(await jsonDb.getMissionTemplates());
    if (generated.length) {
      await jsonDb.upsertMissionTemplates(generated);
      missionsInserted += generated.length;
    }

    return NextResponse.json({ 
      message: itemsInserted === 0 && missionsInserted === 0 ? "Already seeded" : "Seeded successfully", 
      items: itemsInserted, 
      missions: missionsInserted 
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
