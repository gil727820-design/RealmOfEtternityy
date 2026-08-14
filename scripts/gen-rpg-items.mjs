/* Gerador do catálogo de itens RPG (272 itens em 16 categorias). */
import fs from "fs";

// categoria: { dir (pasta original), slot, key, base name prefix pt/en/es, emoji }
const CATS = [
  { dir: "ESPADA", dst: "espada", slot: "weapon", key: "espada", pt: "Espada", en: "Sword", es: "Espada", emoji: "⚔️", g: "f" },
  { dir: "MACHADO", dst: "machado", slot: "weapon", key: "machado", pt: "Machado", en: "Axe", es: "Hacha", emoji: "🪓", g: "m" },
  { dir: "MARTELO", dst: "martelo", slot: "weapon", key: "martelo", pt: "Martelo", en: "Hammer", es: "Martillo", emoji: "🔨", g: "m" },
  { dir: "LANCA", dst: "lanca", slot: "weapon", key: "lanca", pt: "Lança", en: "Spear", es: "Lanza", emoji: "🔱", g: "f" },
  { dir: "ARCO", dst: "arco", slot: "weapon", key: "arco", pt: "Arco", en: "Bow", es: "Arco", emoji: "🏹", g: "m" },
  { dir: "CROSBOW", dst: "crosbow", slot: "weapon", key: "crosbow", pt: "Besta", en: "Crossbow", es: "Ballesta", emoji: "🎯", g: "f" },
  { dir: "ARMA DUPLA", dst: "arma-dupla", slot: "weapon", key: "armaDupla", pt: "Arma Dupla", en: "Dual Weapon", es: "Arma Doble", emoji: "⚔️", g: "f" },
  { dir: "facas", dst: "facas", slot: "weapon", key: "facas", pt: "Adaga", en: "Dagger", es: "Daga", emoji: "🗡️", g: "f" },
  { dir: "escudo", dst: "escudo", slot: "shield", key: "escudo", pt: "Escudo", en: "Shield", es: "Escudo", emoji: "🛡️", g: "m" },
  { dir: "CAPACETE E TOUCAS", dst: "capacete", slot: "helmet", key: "capacete", pt: "Elmo", en: "Helmet", es: "Casco", emoji: "⛑️", g: "m" },
  { dir: "PEITORAL", dst: "peitoral", slot: "armor", key: "peitoral", pt: "Peitoral", en: "Chestplate", es: "Pectoral", emoji: "🦺", g: "m" },
  { dir: "LUVAS", dst: "luvas", slot: "gloves", key: "luvas", pt: "Luva", en: "Gloves", es: "Guante", emoji: "🧤", g: "f" },
  { dir: "SAPATOS", dst: "sapatos", slot: "boots", key: "sapatos", pt: "Botas", en: "Boots", es: "Botas", emoji: "👢", g: "f" },
  { dir: "ANEL", dst: "anel", slot: "ring", key: "anel", pt: "Anel", en: "Ring", es: "Anillo", emoji: "💍", g: "m" },
  { dir: "COLAR", dst: "colar", slot: "amulet", key: "colar", pt: "Colar", en: "Amulet", es: "Collar", emoji: "📿", g: "m" },
  { dir: "EMBLEMArunas", dst: "emblema", slot: "relic", key: "emblema", pt: "Emblema", en: "Relic", es: "Emblema", emoji: "🔮", g: "m" },
];

// Distribuição de raridades por tamanho da categoria (não algo absurdo em baú
// básico). Proporções fixas: maioria common/uncommon, poucos top-tier.
// Quanto maior a categoria, mais níveis altos entram.
function rarityDistribution(n) {
  const SHARES = [
    { rarity: "supreme", share: 0.02 },
    { rarity: "ancestral", share: 0.03 },
    { rarity: "divine", share: 0.06 },
    { rarity: "mythic", share: 0.09 },
    { rarity: "legendary", share: 0.12 },
    { rarity: "epic", share: 0.15 },
    { rarity: "rare", share: 0.18 },
    { rarity: "uncommon", share: 0.2 },
    { rarity: "common", share: 0.15 },
  ];
  const counts = {};
  let used = 0;
  for (const { rarity, share } of SHARES) {
    const c = Math.floor(n * share);
    counts[rarity] = c;
    used += c;
  }
  // Distribui as sobras para o tier mais comum, garantindo que sempre caiba.
  let leftover = n - used;
  while (leftover > 0) {
    for (const { rarity } of SHARES) {
      if (leftover <= 0) break;
      counts[rarity] = (counts[rarity] || 0) + 1;
      leftover--;
    }
  }
  const out = [];
  for (const { rarity } of SHARES) {
    for (let i = 0; i < counts[rarity]; i++) out.push(rarity);
  }
  return out;
}

// Prefixos por raridade (nomes temáticos) — variantes masculino/feminino.
const RARITY_PREFIX = {
  common: { m: ["de Ferro", "de Madeira", "Simples", "de Treino"], f: ["de Ferro", "de Madeira", "Simples", "de Treino"] },
  uncommon: { m: ["de Aço", "de Bronze", "do Soldado", "da Guarda"], f: ["de Aço", "de Bronze", "do Soldado", "da Guarda"] },
  rare: { m: ["Rúnico", "do Vento", "de Prata", "do Caçador"], f: ["Rúnica", "do Vento", "de Prata", "do Caçador"] },
  epic: { m: ["Real", "do Trovão", "Abissal", "do Dragão"], f: ["Real", "do Trovão", "Abissal", "do Dragão"] },
  legendary: { m: ["Lendário", "do Fogo Antigo", "da Tempestade", "do Titã"], f: ["Lendária", "do Fogo Antigo", "da Tempestade", "do Titã"] },
  mythic: { m: ["Mítico", "das Sombras", "do Vazio", "do Cosmos"], f: ["Mítica", "das Sombras", "do Vazio", "do Cosmos"] },
  divine: { m: ["Divino", "da Aurora", "Celestial", "do Juízo"], f: ["Divina", "da Aurora", "Celestial", "do Juízo"] },
  ancestral: { m: ["Ancestral", "Primordial", "do Mundo Antigo", "da Criação"], f: ["Ancestral", "Primordial", "do Mundo Antigo", "da Criação"] },
  supreme: { m: ["Supremo", "do Além", "Absoluto", "da Eternidade"], f: ["Suprema", "do Além", "Absoluta", "da Eternidade"] },
};

const RARITY_ATK = { common: 6, uncommon: 10, rare: 16, epic: 24, legendary: 36, mythic: 52, divine: 72, ancestral: 95, supreme: 125 };

function buildStats(slot, rarity, jitter) {
  const atk = RARITY_ATK[rarity];
  const ri = Object.keys(RARITY_ATK).indexOf(rarity); // 0..8
  const j = jitter; // variação sutil entre itens do mesmo tier
  switch (slot) {
    case "weapon": {
      const attack = Math.round(atk + j * 2);
      const critical = Math.min(40, Math.round(2 + ri * 2.2 + j * 1.5));
      const speed = Math.round(ri * 0.7 + (j % 2));
      const hp = Math.round(8 + ri * 3 + j * 2);
      return { attack, defense: 0, hp, speed, critical: Math.max(0, critical) };
    }
    case "shield": {
      const defense = Math.round(atk * 0.8 + j * 2);
      const hp = Math.round(30 + ri * 8 + j * 4);
      return { attack: 0, defense, hp, speed: 0, critical: 0 };
    }
    case "helmet": {
      const defense = Math.round(atk * 0.55 + j * 2);
      const hp = Math.round(24 + ri * 6 + j * 3);
      const speed = Math.round(ri * 0.4);
      const critical = Math.round(1 + ri * 0.8 + j * 0.5);
      return { attack: 0, defense, hp, speed, critical };
    }
    case "armor": {
      const defense = Math.round(atk * 0.9 + j * 2);
      const hp = Math.round(35 + ri * 10 + j * 5);
      return { attack: 0, defense, hp, speed: Math.round(ri * 0.3), critical: 0 };
    }
    case "gloves": {
      const defense = Math.round(atk * 0.45 + j * 2);
      const attack = Math.round(atk * 0.35 + j);
      const hp = Math.round(15 + ri * 4 + j * 2);
      const speed = Math.round(1 + ri * 0.6 + (j % 2));
      const critical = Math.round(1 + ri * 1.2 + j * 0.8);
      return { attack, defense, hp, speed, critical };
    }
    case "boots": {
      const defense = Math.round(atk * 0.35 + j * 2);
      const hp = Math.round(18 + ri * 5 + j * 3);
      const speed = Math.round(2 + ri * 1.2 + j);
      const attack = Math.round(atk * 0.15);
      return { attack, defense, hp, speed, critical: 0 };
    }
    case "ring": {
      const attack = Math.round(atk * 0.3 + j);
      const defense = Math.round(atk * 0.2);
      const hp = Math.round(20 + ri * 5 + j * 2);
      const speed = Math.round(1 + ri * 0.5);
      const critical = Math.round(1 + ri * 1.1 + j * 0.6);
      return { attack, defense, hp, speed, critical };
    }
    case "amulet": {
      const attack = Math.round(atk * 0.28 + j);
      const defense = Math.round(atk * 0.22);
      const hp = Math.round(26 + ri * 6 + j * 3);
      const speed = Math.round(ri * 0.4);
      const critical = Math.round(1 + ri * 0.9 + j * 0.5);
      return { attack, defense, hp, speed, critical };
    }
    case "relic": {
      const attack = Math.round(atk * 0.4 + j);
      const defense = Math.round(atk * 0.25);
      const hp = Math.round(16 + ri * 5 + j * 2);
      const speed = Math.round(1 + ri * 0.7);
      const critical = Math.round(1 + ri * 1.3 + j * 0.8);
      return { attack, defense, hp, speed, critical };
    }
  }
}

let id = 1000;
const items = [];
const catalog = [];

const RARITY_MINLEVEL = {
  common: 1, uncommon: 5, rare: 12, epic: 22, legendary: 35,
  mythic: 50, divine: 65, ancestral: 78, supreme: 90,
};

for (const cat of CATS) {
  const files = fs.readdirSync(`C:/Users/Pereira/Downloads/RPG Icons/${cat.dir}`)
    .filter((f) => f.endsWith(".png"))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);
      return na - nb;
    });
  const rarities = rarityDistribution(files.length);
  const counter = {};
  files.forEach((file, i) => {
    const rarity = rarities[i];
    counter[rarity] = (counter[rarity] || 0) + 1;
    const prefixes = RARITY_PREFIX[rarity][cat.g];
    const idx = Math.min(counter[rarity] - 1, prefixes.length - 1);
    const prefix = prefixes[idx];
    const nameKey = `item.rpg.${cat.key}_${rarity}${counter[rarity] > 0 ? "_" + counter[rarity] : ""}`;
    const stats = buildStats(cat.slot, rarity, counter[rarity] - 1);
    const minLevel = RARITY_MINLEVEL[rarity];
    const sellPrice = Math.max(5, Math.round(minLevel * 10));
    const item = {
      id: id + i,
      nameKey,
      slot: cat.slot,
      rarity,
      minLevel,
      ...stats,
      icon: cat.emoji,
      image: `/images/items/rpg/${cat.dst}/${file}`,
      sellPrice,
    };
    items.push(item);
    catalog.push({
      cat: cat.key,
      file,
      rarity,
      nameKey,
      pt: `${cat.pt} ${prefix}`,
      en: `${cat.en} ${prefix}`,
      es: `${cat.es} ${prefix}`,
    });
  });
  id += files.length;
}

const ts = `// GERADO AUTOMATICAMENTE — não edite à mão.
// Regenerar: node scripts/gen-rpg-items.mjs > src/game/rpgItems.gen.ts
export type Rarity = "common"|"uncommon"|"rare"|"epic"|"legendary"|"mythic"|"divine"|"ancestral"|"supreme";

export interface RpgItemTemplate {
  id: number;
  nameKey: string;
  slot: string;
  rarity: Rarity;
  minLevel: number;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  critical: number;
  icon: string;
  image: string;
  sellPrice: number;
}

export const RPG_ITEMS: RpgItemTemplate[] = ${JSON.stringify(items, null, 2)};
`;

fs.writeFileSync("C:/Users/Pereira/Downloads/MMORPG/Game/src/game/rpgItems.gen.ts", ts);

// i18n
function i18nBlock(locale, field) {
  const lines = catalog.map((c) => `  "${c.nameKey}": ${JSON.stringify(String(c[field]))},`);
  return lines.join("\n");
}
const pt = `export default {\n${i18nBlock("pt", "pt")}\n};\n`;
const en = `export default {\n${i18nBlock("en", "en")}\n};\n`;
const es = `export default {\n${i18nBlock("es", "es")}\n};\n`;
fs.mkdirSync("C:/Users/Pereira/Downloads/MMORPG/Game/src/i18n/items", { recursive: true });
fs.writeFileSync("C:/Users/Pereira/Downloads/MMORPG/Game/src/i18n/items/pt.ts", pt);
fs.writeFileSync("C:/Users/Pereira/Downloads/MMORPG/Game/src/i18n/items/en.ts", en);
fs.writeFileSync("C:/Users/Pereira/Downloads/MMORPG/Game/src/i18n/items/es.ts", es);

console.log(`OK: ${items.length} itens. ids ${items[0].id}..${items[items.length - 1].id}`);
