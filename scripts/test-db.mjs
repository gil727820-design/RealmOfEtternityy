/* Diagnóstico do banco SQLite local. Uso: node scripts/test-db.mjs */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

console.log("Banco:", DB_PATH);
console.log("Existe:", fs.existsSync(DB_PATH));

if (!fs.existsSync(DB_PATH)) {
  console.error("✖ Arquivo de banco não encontrado. Execute `node scripts/migrate.mjs` primeiro.");
  process.exit(1);
}

const start = Date.now();
try {
  const db = new Database(DB_PATH, { readonly: true });
  const ms = Date.now() - start;
  console.log(`\n✔ CONECTOU em ${ms}ms`);

  // Info do banco
  const pageSize = db.pragma("page_size", { simple: true });
  const pageCount = db.pragma("page_count", { simple: true });
  const journalMode = db.pragma("journal_mode", { simple: true });
  console.log(`  journal_mode: ${journalMode}`);
  console.log(`  tamanho: ~${Math.round((pageSize * pageCount) / 1024)} KB`);

  // Lista tabelas
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  console.log(`  tabelas: ${tables.length}`);
  for (const t of tables) {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    console.log(`    ${t.name}: ${count.c} registros`);
  }

  db.close();
  console.log("\n✔ SQLite OK!");
} catch (e) {
  const ms = Date.now() - start;
  console.log(`\n✖ FALHOU em ${ms}ms ->`, e.message);
  process.exitCode = 1;
}
