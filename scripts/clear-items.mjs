/*
 * Apaga TODOS os itens do jogo (por enquanto):
 *   1. inventory_items  -> itens no inventário de todas as contas
 *   2. item_templates   -> definições de item (loja/forja/drops ficam vazios)
 *
 * O seed (/api/seed) NÃO recria templates de item: ele só semeia missões.
 * Drops em missões/AFK/masmorra/torre também param (todos esperam templates).
 *
 * Uso:  node scripts/clear-items.mjs
 */
import "dotenv/config";
import pg from "pg";

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

async function main() {
  const inv = await pool.query("SELECT count(*)::int AS c FROM inventory_items");
  const tpl = await pool.query("SELECT count(*)::int AS c FROM item_templates");
  console.log(`Antes: ${inv.rows[0].c} itens no inventário, ${tpl.rows[0].c} templates.`);

  await pool.query("DELETE FROM inventory_items");
  await pool.query("DELETE FROM item_templates");

  const invAfter = await pool.query("SELECT count(*)::int AS c FROM inventory_items");
  const tplAfter = await pool.query("SELECT count(*)::int AS c FROM item_templates");
  console.log(`Depois: ${invAfter.rows[0].c} itens no inventário, ${tplAfter.rows[0].c} templates.`);
  console.log("✔ Todos os itens foram removidos.");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("✖ Falha ao limpar itens:", e.message);
    process.exitCode = 1;
    pool.end();
  });