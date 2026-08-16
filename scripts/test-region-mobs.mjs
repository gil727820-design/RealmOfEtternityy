// Teste de validação da estrutura REAL de src/game/regionMobs.ts
import fs from "fs";

const src = fs.readFileSync(new URL("../src/game/regionMobs.ts", import.meta.url), "utf8");
const regions = [
  "starter_village", "forgotten_forest", "ancient_ruins", "deep_mines",
  "dark_swamp", "frozen_mountains", "scorching_desert", "imperial_castle",
  "lost_islands", "dragon_world", "demon_realm", "celestial_temple",
];

for (const r of regions) {
  const blockMatch = src.match(new RegExp(`\\b${r}: \\[([\\s\\S]*?)\\],`));
  if (!blockMatch) throw new Error(`região ${r} não encontrada no arquivo`);
  const block = blockMatch[1];
  const mobs = (block.match(/\{ id:/g) || []).length;
  const elites = (block.match(/elite: true/g) || []).length;
  if (mobs < 4) throw new Error(`${r} precisa de 4 mobs (3 normal + 1 elite), tem ${mobs}`);
  if (elites !== 1) throw new Error(`${r} precisa de exatamente 1 elite, tem ${elites}`);
}
console.log("✅ Estrutura OK: 12 regiões × (3 mobs + 1 elite) = 48 mobs");

// Mini-bosses: conta entradas no bloco (aceita espaços/acentos no nome).
const mbIdx = src.indexOf("REGION_MINI_BOSSES");
const mbEnd = src.indexOf("};", mbIdx);
const mbBlock = src.slice(mbIdx, mbEnd);
const mbEntries = (mbBlock.match(/\{\s*nameKey:/g) || []).length;
if (mbEntries !== 12) throw new Error(`mini-bosses deveriam ser 12, tem ${mbEntries}`);
console.log("✅ 12 mini-bosses (1 por região)");

// Valida que os nameKeys de todos os mobs existem no i18n pt-BR
const names = [...src.matchAll(/nameKey: "([^"]+)"/g)].map((m) => m[1]);
const i18n = fs.readFileSync(new URL("../src/i18n/pt-BR.ts", import.meta.url), "utf8");
const missing = names.filter((n) => !i18n.includes(`"${n}"`));
if (missing.length > 0) throw new Error(`nameKeys faltando no i18n: ${missing.join(", ")}`);
console.log(`✅ ${names.length} nameKeys de mobs/mini-bosses presentes no i18n pt-BR`);

console.log("🎉 Estrutura de Mobs de Região validada!");
