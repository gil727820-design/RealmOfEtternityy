/*
 * Migração one-shot: SQLite (data/game.db) → JSON (data/*.json).
 *
 * Lê as 18 tabelas do SQLite atual e exporta cada uma para o arquivo JSON
 * correspondente (same formato do novo jsonStore: array de documentos inteiros,
 * extraídos da coluna `data`). Preserva TODOS os dados de jogadores.
 *
 * Antes, copia o game.db (e WAL/SHM) para backups/pre-json-<timestamp>/.
 *
 * Uso:  node scripts/migrate-db-to-json.mjs
 * Requer better-sqlite3 apenas nesta execução (pode remover depois).
 */
import "dotenv/config";
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync,
} from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "game.db");

const COLLECTIONS = [
  { file: "users", table: "users" },
  { file: "characters", table: "characters" },
  { file: "itemTemplates", table: "item_templates" },
  { file: "inventoryItems", table: "inventory_items" },
  { file: "missionTemplates", table: "mission_templates" },
  { file: "activeMissions", table: "active_missions" },
  { file: "afkRewards", table: "afk_rewards" },
  { file: "battles", table: "battles" },
  { file: "guilds", table: "guilds" },
  { file: "guildInvites", table: "guild_invites" },
  { file: "guildChats", table: "guild_chats" },
  { file: "mailbox", table: "mailbox" },
  { file: "excludedUsers", table: "excluded_users" },
  { file: "regionAudio", table: "region_audio" },
  { file: "serverSettings", table: "server_settings" },
  { file: "codes", table: "codes" },
  { file: "marketplace", table: "marketplace" },
  { file: "adminLogs", table: "admin_logs" },
];

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

let Database = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  console.error("✖ better-sqlite3 não está instalado. Rode `npm install better-sqlite3` apenas para esta migração.");
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.error("✖ Banco SQLite não encontrado em", DB_PATH);
  console.error("  Se o projeto já está em JSON, esta migração é desnecessária.");
  process.exit(1);
}

// 1. Backup do banco
const backupDir = path.join(process.cwd(), "backups", `pre-json-${stamp()}`);
mkdirSync(backupDir, { recursive: true });
for (const f of readdirSync(DATA_DIR)) {
  if (f.startsWith("game.db")) copyFileSync(path.join(DATA_DIR, f), path.join(backupDir, f));
}
console.log("✔ Backup do SQLite em:", backupDir);

// 2. Exporta cada tabela → JSON
const db = new Database(DB_PATH, { readonly: true });
let total = 0;
for (const { file, table } of COLLECTIONS) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT * FROM "${table}"`).all();
  } catch {
    console.log(`  ⚠ tabela ${table} ausente — arquivo vazio.`);
  }
  const docs = rows
    .map((row) => {
      try {
        if (row && typeof row.data === "string") return JSON.parse(row.data);
      } catch { /* dados inválidos */ }
      // Fallback: sem coluna data (ex.: colunas próprias) → usa o registro.
      return row;
    })
    .filter((r) => r && typeof r === "object");
  writeFileSync(path.join(DATA_DIR, `${file}.json`), JSON.stringify(docs, null, 2), "utf8");
  total += docs.length;
  console.log(`  → ${file}.json : ${docs.length} registros`);
}
db.close();

console.log(`\n✔ Migração concluída: ${total} registros exportados para data/*.json`);
console.log("  O jogo agora lê/escreve JSON puro. O data/game.db* ficou em backups/.");