/*
 * Semeia o catálogo de ESPADAS na persistência JSON (data/itemTemplates.json).
 *
 * Idempotente: insere apenas os ids 30–49 que ainda não existem.
 *
 * Uso:  node scripts/seed-swords.mjs
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const ITEMS_FILE = path.join(DATA_DIR, "itemTemplates.json");

const SWORD_SPRITES = {
  rusty: "/sprites/guerreiro/base/espada_v1_ferro.png",
  mid: "/sprites/guerreiro/novos/01_espada.PNG",
  flame: "/sprites/guerreiro/novos/espada_v2_chama.png",
  shadow: "/sprites/guerreiro/novos/espada_v3_sombra.png",
};

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

function main() {
  const existing = existsSync(ITEMS_FILE)
    ? JSON.parse(readFileSync(ITEMS_FILE, "utf8"))
    : [];
  const known = new Set(existing.map((t) => String(t.id)));

  let inserted = 0;
  for (const s of SWORDS) {
    if (known.has(String(s.id))) continue;
    existing.push(s);
    inserted++;
  }

  writeFileSync(ITEMS_FILE, JSON.stringify(existing, null, 2), "utf8");
  console.log(`✔ ${inserted} espadas inseridas. Total de templates: ${existing.length}.`);
}

try {
  main();
} catch (e) {
  console.error("✖ Falha ao semear espadas:", e.message);
  process.exitCode = 1;
}