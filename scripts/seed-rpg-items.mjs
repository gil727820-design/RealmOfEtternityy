/*
 * Semeia o catálogo de ITENS RPG no SQLite local.
 *
 * Gere o catálogo com `node scripts/gen-rpg-items.mjs` (produz
 * src/game/rpgItems.gen.ts e os dicionários src/i18n/items/*.ts).
 *
 * Este script insere os itens no banco imediatamente para o painel admin
 * (aba "Enviar") e a loja (baús) já exibirem os cartões.
 * Idempotente: usa INSERT OR IGNORE.
 *
 * Uso:  node scripts/seed-rpg-items.mjs
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genFile = path.join(__dirname, "../src/game/rpgItems.gen.ts");

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

const db = new Database(DB_PATH);

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

  const existing = db.prepare(
    "SELECT id FROM item_templates WHERE id BETWEEN ? AND ?"
  ).all(items[0].id, items[items.length - 1].id);
  const known = new Set(existing.map((r) => r.id));

  const insert = db.prepare(
    "INSERT OR IGNORE INTO item_templates (id, name_key, data) VALUES (?, ?, ?)"
  );

  let inserted = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      if (known.has(it.id)) continue;
      insert.run(it.id, it.nameKey, JSON.stringify(it));
      inserted++;
    }
  });
  tx();

  const total = db.prepare("SELECT count(*) as c FROM item_templates").get();
  console.log(`✔ ${inserted} itens RPG inseridos. Total de templates: ${total.c}.`);
  console.log("Recarregue o painel admin — a aba 'Enviar' já vai mostrar os cartões.");
  db.close();
}

try {
  main();
} catch (e) {
  console.error("✖ Falha ao semear itens RPG:", e.message);
  process.exitCode = 1;
  db.close();
}
