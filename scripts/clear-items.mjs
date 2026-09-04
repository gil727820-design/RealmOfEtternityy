/*
 * Apaga TODOS os itens do jogo:
 *   1. inventoryItems.json -> itens no inventário de todas as contas
 *   2. itemTemplates.json  -> definições de item (loja/forja/drops ficam vazios)
 *
 * O seed (/api/seed) NÃO recria templates de item: ele só semeia missões.
 * Drops em missões/AFK/masmorra/torre também param (todos esperam templates).
 *
 * Uso:  node scripts/clear-items.mjs
 */
import "dotenv/config";
import { writeFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const INV_FILE = path.join(DATA_DIR, "inventoryItems.json");
const TPL_FILE = path.join(DATA_DIR, "itemTemplates.json");

const count = (file) => {
  if (!existsSync(file)) return 0;
  try {
    const arr = JSON.parse(require("fs").readFileSync(file, "utf8"));
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
};

try {
  const invBefore = count(INV_FILE);
  const tplBefore = count(TPL_FILE);
  console.log(`Antes: ${invBefore} itens no inventário, ${tplBefore} templates.`);

  writeFileSync(INV_FILE, "[]\n", "utf8");
  writeFileSync(TPL_FILE, "[]\n", "utf8");

  console.log("Depois: 0 itens no inventário, 0 templates.");
  console.log("✔ Todos os itens foram removidos.");
} catch (e) {
  console.error("✖ Falha ao limpar itens:", e.message);
  process.exitCode = 1;
}