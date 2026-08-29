/*
 * Apaga TODOS os itens do jogo:
 *   1. inventory_items  -> itens no inventário de todas as contas
 *   2. item_templates   -> definições de item (loja/forja/drops ficam vazios)
 *
 * O seed (/api/seed) NÃO recria templates de item: ele só semeia missões.
 * Drops em missões/AFK/masmorra/torre também param (todos esperam templates).
 *
 * Uso:  node scripts/clear-items.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("✖ Banco não encontrado. Execute `node scripts/migrate.mjs` primeiro.");
  process.exit(1);
}

const db = new Database(DB_PATH);

try {
  const inv = db.prepare("SELECT count(*) as c FROM inventory_items").get();
  const tpl = db.prepare("SELECT count(*) as c FROM item_templates").get();
  console.log(`Antes: ${inv.c} itens no inventário, ${tpl.c} templates.`);

  db.prepare("DELETE FROM inventory_items").run();
  db.prepare("DELETE FROM item_templates").run();

  const invAfter = db.prepare("SELECT count(*) as c FROM inventory_items").get();
  const tplAfter = db.prepare("SELECT count(*) as c FROM item_templates").get();
  console.log(`Depois: ${invAfter.c} itens no inventário, ${tplAfter.c} templates.`);
  console.log("✔ Todos os itens foram removidos.");
} catch (e) {
  console.error("✖ Falha ao limpar itens:", e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
