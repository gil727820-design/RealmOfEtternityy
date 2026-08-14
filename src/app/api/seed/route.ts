import { NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { missingRegionMissions } from "@/game/generatedMissions";

// ─── Catálogo de Espadas ────────────────────────────────────────────────────
// Ícones de arma (32×32) copiados de "32 Free Weapon Icons" para
// /public/images/items/swords/. `image` é usado no inventário/forja/admin;
// `sheet` aponta para o sprite do guerreiro (layers) para o personagem
// exibir a espada correta ao equipar.
const SWORD_SPRITES = {
  rusty: "/sprites/guerreiro/base/espada_v1_ferro.png",
  mid: "/sprites/guerreiro/novos/01_espada.PNG",
  flame: "/sprites/guerreiro/novos/espada_v2_chama.png",
  shadow: "/sprites/guerreiro/novos/espada_v3_sombra.png",
} as const;

const SWORDS = [
  { id: 30, nameKey: "item.sw_rusty", slot: "weapon", rarity: "common", minLevel: 1, attack: 6, defense: 0, hp: 0, speed: 1, critical: 1, icon: "🗡️", image: "/images/items/swords/Iicon_32_01.png", sheet: SWORD_SPRITES.rusty, sellPrice: 12 },
  { id: 31, nameKey: "item.sw_iron", slot: "weapon", rarity: "common", minLevel: 3, attack: 9, defense: 0, hp: 0, speed: 1, critical: 2, icon: "🗡️", image: "/images/items/swords/Iicon_32_03.png", sheet: SWORD_SPRITES.rusty, sellPrice: 22 },
  { id: 32, nameKey: "item.sw_bronze", slot: "weapon", rarity: "common", minLevel: 5, attack: 12, defense: 0, hp: 5, speed: 1, critical: 2, icon: "🗡️", image: "/images/items/swords/Iicon_32_19.png", sheet: SWORD_SPRITES.rusty, sellPrice: 35 },
  { id: 33, nameKey: "item.sw_steel", slot: "weapon", rarity: "uncommon", minLevel: 8, attack: 16, defense: 0, hp: 0, speed: 2, critical: 3, icon: "⚔️", image: "/images/items/swords/Iicon_32_04.png", sheet: SWORD_SPRITES.mid, sellPrice: 60 },
  { id: 34, nameKey: "item.sw_wind", slot: "weapon", rarity: "uncommon", minLevel: 10, attack: 19, defense: 0, hp: 0, speed: 3, critical: 3, icon: "⚔️", image: "/images/items/swords/Iicon_32_06.png", sheet: SWORD_SPRITES.mid, sellPrice: 85 },
  { id: 35, nameKey: "item.sw_silver", slot: "weapon", rarity: "uncommon", minLevel: 12, attack: 22, defense: 0, hp: 5, speed: 2, critical: 4, icon: "⚔️", image: "/images/items/swords/Iicon_32_25.png", sheet: SWORD_SPRITES.mid, sellPrice: 115 },
  { id: 36, nameKey: "item.sw_hunter", slot: "weapon", rarity: "rare", minLevel: 15, attack: 27, defense: 0, hp: 0, speed: 3, critical: 5, icon: "⚔️", image: "/images/items/swords/Iicon_32_05.png", sheet: SWORD_SPRITES.mid, sellPrice: 160 },
  { id: 37, nameKey: "item.sw_runic", slot: "weapon", rarity: "rare", minLevel: 18, attack: 32, defense: 0, hp: 8, speed: 3, critical: 5, icon: "🔮", image: "/images/items/swords/Iicon_32_07.png", sheet: SWORD_SPRITES.mid, sellPrice: 220 },
  { id: 38, nameKey: "item.sw_twilight", slot: "weapon", rarity: "rare", minLevel: 20, attack: 36, defense: 0, hp: 0, speed: 4, critical: 6, icon: "🌗", image: "/images/items/swords/Iicon_32_28.png", sheet: SWORD_SPRITES.mid, sellPrice: 290 },
  { id: 39, nameKey: "item.sw_royal", slot: "weapon", rarity: "epic", minLevel: 24, attack: 42, defense: 2, hp: 10, speed: 3, critical: 7, icon: "🏰", image: "/images/items/swords/Iicon_32_15.png", sheet: SWORD_SPRITES.mid, sellPrice: 380 },
  { id: 40, nameKey: "item.sw_knight", slot: "weapon", rarity: "epic", minLevel: 28, attack: 48, defense: 3, hp: 12, speed: 3, critical: 7, icon: "🛡️", image: "/images/items/swords/Iicon_32_16.png", sheet: SWORD_SPRITES.mid, sellPrice: 480 },
  { id: 41, nameKey: "item.sw_crystal", slot: "weapon", rarity: "epic", minLevel: 32, attack: 55, defense: 0, hp: 10, speed: 5, critical: 8, icon: "💎", image: "/images/items/swords/Iicon_32_08.png", sheet: SWORD_SPRITES.flame, sellPrice: 600 },
  { id: 42, nameKey: "item.sw_dawn", slot: "weapon", rarity: "legendary", minLevel: 36, attack: 63, defense: 2, hp: 15, speed: 5, critical: 9, icon: "🌅", image: "/images/items/swords/Iicon_32_18.png", sheet: SWORD_SPRITES.flame, sellPrice: 780 },
  { id: 43, nameKey: "item.sw_dragon", slot: "weapon", rarity: "legendary", minLevel: 40, attack: 72, defense: 3, hp: 18, speed: 5, critical: 10, icon: "🐉", image: "/images/items/swords/Iicon_32_24.png", sheet: SWORD_SPRITES.flame, sellPrice: 980 },
  { id: 44, nameKey: "item.sw_emperor", slot: "weapon", rarity: "legendary", minLevel: 45, attack: 82, defense: 5, hp: 20, speed: 6, critical: 10, icon: "👑", image: "/images/items/swords/Iicon_32_17.png", sheet: SWORD_SPRITES.flame, sellPrice: 1250 },
  { id: 45, nameKey: "item.sw_shadow", slot: "weapon", rarity: "mythic", minLevel: 50, attack: 95, defense: 0, hp: 20, speed: 8, critical: 13, icon: "🌑", image: "/images/items/swords/Iicon_32_21.png", sheet: SWORD_SPRITES.shadow, sellPrice: 1600 },
  { id: 46, nameKey: "item.sw_chaos", slot: "weapon", rarity: "mythic", minLevel: 55, attack: 108, defense: 3, hp: 25, speed: 7, critical: 14, icon: "🔯", image: "/images/items/swords/Iicon_32_22.png", sheet: SWORD_SPRITES.shadow, sellPrice: 2000 },
  { id: 47, nameKey: "item.sw_celestial", slot: "weapon", rarity: "divine", minLevel: 60, attack: 125, defense: 5, hp: 30, speed: 8, critical: 15, icon: "🌟", image: "/images/items/swords/Iicon_32_23.png", sheet: SWORD_SPRITES.shadow, sellPrice: 2600 },
  { id: 48, nameKey: "item.sw_ancestral", slot: "weapon", rarity: "ancestral", minLevel: 70, attack: 150, defense: 8, hp: 40, speed: 9, critical: 17, icon: "🕯️", image: "/images/items/swords/Iicon_32_29.png", sheet: SWORD_SPRITES.shadow, sellPrice: 3400 },
  { id: 49, nameKey: "item.sw_supreme", slot: "weapon", rarity: "supreme", minLevel: 80, attack: 185, defense: 10, hp: 50, speed: 10, critical: 20, icon: "⚡", image: "/images/items/swords/Iicon_32_34.png", sheet: SWORD_SPRITES.shadow, sellPrice: 4500 },
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
    // Itens (espadas) foram reativados: o seed insere o catálogo de armas
    // que vieram dos ícones "32 Free Weapon Icons" (em /images/items/swords/).
    // Outros tipos de item (poções, baús, armaduras...) seguem fora do jogo.
    const existingItems = await jsonDb.getAllItemTemplates();
    let itemsInserted = 0;
    if (existingItems.length === 0) {
      await jsonDb.insertItemTemplates(SWORDS as any[]);
      itemsInserted = SWORDS.length;
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
      missions: missionsInserted,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
