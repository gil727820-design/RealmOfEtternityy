/*
 * Semeia o catálogo de ITENS RPG na persistência JSON (data/itemTemplates.json).
 *
 * Gere o catálogo com `node scripts/gen-rpg-items.mjs` (produz
 * src/game/rpgItems.gen.ts e os dicionários src/i18n/items/*.ts).
 * Idempotente: insere apenas os ids que ainda não existem.
 *
 * Uso:  node scripts/seed-rpg-items.mjs
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genFile = path.join(__dirname, "../src/game/rpgItems.gen.ts");

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const ITEMS_FILE = path.join(DATA_DIR, "itemTemplates.json");

function extractItems(source) {
  const marker = "RPG_ITEMS: RpgItemTemplate[] = [";
  const start = source.indexOf(marker) + marker.length - 1;
  const end = source.lastIndexOf("]");
  const json = source.slice(start, end + 1);
  return JSON.parse(json);
}

function main() {
  const source = readFileSync(genFile, "utf8");
  const items = extractItems(source);
  if (!items.length) throw new Error("Nenhum item extraído do catálogo gerado.");

  const existing = existsSync(ITEMS_FILE)
    ? JSON.parse(readFileSync(ITEMS_FILE, "utf8"))
    : [];
  const known = new Set(existing.map((t) => String(t.id)));

  let inserted = 0;
  for (const it of items) {
    if (known.has(String(it.id))) continue;
    existing.push(it);
    inserted++;
  }

  writeFileSync(ITEMS_FILE, JSON.stringify(existing, null, 2), "utf8");
  console.log(`✔ ${inserted} itens RPG inseridos. Total de templates: ${existing.length}.`);
  console.log("Recarregue o painel admin — a aba 'Enviar' já vai mostrar os cartões.");
}

try {
  main();
} catch (e) {
  console.error("✖ Falha ao semear itens RPG:", e.message);
  process.exitCode = 1;
}