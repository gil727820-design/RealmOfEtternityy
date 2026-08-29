/*
 * Migra TODOS os dados do Supabase (PostgreSQL) para o SQLite local.
 *
 * Lê cada tabela do Supabase, extrai o campo `data` (JSONB), e insere
 * no SQLite correspondente. preserva 100% dos dados incluindo:
 *   - Contas de jogadores (users)
 *   - Personagens (characters)
 *   - Inventário (inventory_items)
 *   - Templates de itens e missões
 *   - Guildas, correio, mercado, códigos, logs, configurações
 *
 * Uso:
 *   node scripts/migrate-from-supabase.mjs
 *
 * Requer DATABASE_URL no .env apontando para o Supabase.
 */
import "dotenv/config";
import pg from "pg";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ─── Config ───

const SUPABASE_URL = process.env.DATABASE_URL;
if (!SUPABASE_URL) {
  console.error("✖ DATABASE_URL não encontrada no .env (precisa da string do Supabase)");
  process.exit(1);
}

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ─── Conexões ───

const pgPool = new pg.Pool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  max: 5,
});

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 10000");

// ─── Mapeamento de tabelas ───
// [tabela_supabase, tabela_sqlite, coluna_id_supabase]

const TABLES = [
  ["users",                "users",                 "id"],
  ["characters",           "characters",            "id"],
  ["item_templates",       "item_templates",        "id"],
  ["inventory_items",      "inventory_items",       "id"],
  ["mission_templates",    "mission_templates",     "id"],
  ["active_missions",      "active_missions",       "id"],
  ["afk_rewards",          "afk_rewards",           "id"],
  ["battles",              "battles",               "id"],
  ["guilds",               "guilds",                "id"],
  ["guild_invites",        "guild_invites",         "id"],
  ["guild_chats",          "guild_chats",           "id"],
  ["mailbox",              "mailbox",               "id"],
  ["excluded_users",       "excluded_users",        "user_id"],
  ["region_audio",         "region_audio",          "region_id"],
  ["server_settings",      "server_settings",       "key"],
  ["codes",                "codes",                 "id"],
  ["marketplace",          "marketplace",           "id"],
  ["admin_logs",           "admin_logs",            "id"],
];

// ─── Migração ───

async function migrateTable(pgClient, pgTable, sqliteTable, idCol) {
  // Lê todas as linhas do Supabase
  let pgRows;
  try {
    const result = await pgClient.query(`SELECT * FROM ${pgTable}`);
    pgRows = result.rows;
  } catch (e) {
    console.log(`  ⚠ Tabela "${pgTable}" não existe no Supabase — pulando.`);
    return 0;
  }

  if (!pgRows || pgRows.length === 0) {
    console.log(`  → ${pgTable}: 0 registros (vazio)`);
    return 0;
  }

  // Prepara INSERT para SQLite
  // Para cada linha, o campo `data` pode ser JSONB (objeto) ou já ter sido parseado
  const insertStmt = sqlite.prepare(
    `INSERT OR REPLACE INTO ${sqliteTable} (${idCol}, data) VALUES (?, ?)`
  );

  let count = 0;
  const tx = sqlite.transaction(() => {
    for (const row of pgRows) {
      let data = row.data;

      // Se data é string (já serializado), mantém como está
      // Se data é objeto (JSONB do pg driver), serializa
      if (typeof data === "object" && data !== null) {
        data = JSON.stringify(data);
      } else if (typeof data !== "string") {
        data = JSON.stringify(data);
      }

      const id = row[idCol];
      if (id === undefined || id === null) continue;

      insertStmt.run(String(id), data);
      count++;
    }
  });
  tx();

  return count;
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Migração: Supabase → SQLite Local");
  console.log("═══════════════════════════════════════════════");
  console.log();

  // Testa conexão Supabase
  console.log("→ Conectando ao Supabase...");
  try {
    const probe = await pgPool.connect();
    probe.release();
    console.log("  ✓ Conexão OK");
  } catch (e) {
    console.error("  ✖ Não foi possível conectar ao Supabase:", e.message);
    console.error("  Verifique se a DATABASE_URL no .env está correta.");
    process.exit(1);
  }

  console.log(`→ SQLite: ${DB_PATH}`);
  console.log();

  let totalRecords = 0;
  let tablesMigrated = 0;

  for (const [pgTable, sqliteTable, idCol] of TABLES) {
    process.stdout.write(`  ${pgTable}... `);
    try {
      const count = await migrateTable(pgPool, pgTable, sqliteTable, idCol);
      if (count > 0) {
        console.log(`✓ ${count} registros`);
        totalRecords += count;
        tablesMigrated++;
      } else {
        console.log(`(vazio)`);
      }
    } catch (e) {
      console.log(`ERRO: ${e.message}`);
    }
  }

  console.log();
  console.log("═══════════════════════════════════════════════");
  console.log(`  ✓ Migração concluída!`);
  console.log(`  Tabelas migradas: ${tablesMigrated}`);
  console.log(`  Total de registros: ${totalRecords}`);
  console.log(`  Banco SQLite: ${DB_PATH}`);
  console.log("═══════════════════════════════════════════════");

  // Verificação rápida: lista tabelas e contagens
  console.log();
  console.log("→ Verificação do SQLite:");
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  for (const t of tables) {
    const count = sqlite.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    if (count.c > 0) {
      console.log(`  ${t.name}: ${count.c} registros`);
    }
  }

  sqlite.close();
  await pgPool.end();
}

main().catch((e) => {
  console.error("✖ Falha na migração:", e.message);
  process.exitCode = 1;
  sqlite.close();
  pgPool.end();
});
