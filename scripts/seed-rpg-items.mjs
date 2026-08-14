/*
 * Semeia o catálogo de ITENS RPG (272 itens em 16 categorias: espadas,
 * machados, escudos, elmos, peitorais, luvas, botas, anéis, colares,
 * emblemas, arcos, bestas, lanças, adagas, armas duplas, martelos).
 *
 * Gere o catálogo com `node scripts/gen-rpg-items.mjs` (produz
 * src/game/rpgItems.gen.ts e os dicionários src/i18n/items/*.ts).
 *
 * Este script insere os itens no banco imediatamente para o painel admin
 * (aba "Enviar") e a loja (baús) já exibirem os cartões.
 * Idempotente: usa ON CONFLICT (id) DO NOTHING.
 *
 * Uso:  node scripts/seed-rpg-items.mjs
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genFile = path.join(__dirname, "../src/game/rpgItems.gen.ts");

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada. Verifique o .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  ...(process.env.PG_FORCE_IPV4 === "1" ? { family: 4 } : {}),
});

// Extrai o array RPG_ITEMS do TS gerado (corta a parte dos exports).
function extractItems(source) {
  const marker = "RPG_ITEMS: RpgItemTemplate[] = [";
  const start = source.indexOf(marker) + marker.length - 1; // aponta p/ o '['
  const end = source.lastIndexOf("]");
  const json = source.slice(start, end + 1);
  return JSON.parse(json);
}

async function main() {
  const source = readFileSync(genFile, "utf8");
  const items = extractItems(source);
  if (!items.length) throw new Error("Nenhum item extraído do catálogo gerado.");

  const existing = await pool.query("SELECT id FROM item_templates WHERE id BETWEEN $1 AND $2", [
    items[0].id,
    items[items.length - 1].id,
  ]);
  const known = new Set(existing.rows.map((r) => r.id));
  let inserted = 0;
  for (const it of items) {
    if (known.has(it.id)) continue;
    await pool.query(
      "INSERT INTO item_templates (id, name_key, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [it.id, it.nameKey, JSON.stringify(it)]
    );
    inserted++;
  }
  const total = await pool.query("SELECT count(*)::int AS c FROM item_templates");
  console.log(`✔ ${inserted} itens RPG inseridos. Total de templates de item: ${total.rows[0].c}.`);
  console.log("Recarregue o painel admin — a aba 'Enviar' já vai mostrar os cartões dos novos itens.");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("✖ Falha ao semear itens RPG:", e.message);
    process.exitCode = 1;
    pool.end();
  });
