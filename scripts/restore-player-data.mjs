/*
 * Recuperação one-shot: DADOS DE JOGADORES perdidos na migração JSON.
 *
 * O game.db antigo usava journal WAL; os dados reais dos jogadores viviam no
 * arquivo `game.db-wal` (apagado antes da migração). Este script relê o banco
 * COMPLETO (db + WAL) e reexporta SOMENTE as coleções de jogadores de volta
 * para data/*.json, preservando catálogo (itens/missões), músicas e settings.
 *
 * Pré-requisito: better-sqlite3 temporário + o banco recuperado (game.db e o
 * seu game.db-wal no MESMO diretório).
 *
 * Uso:
 *   DB_PATH=C:/.../recover/game.db node scripts/restore-player-data.mjs
 */
import { existsSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "game.db");

const PLAYER_COLLECTIONS = [
  { file: "users", table: "users" },
  { file: "characters", table: "characters" },
  { file: "inventoryItems", table: "inventory_items" },
  { file: "activeMissions", table: "active_missions" },
  { file: "afkRewards", table: "afk_rewards" },
  { file: "battles", table: "battles" },
  { file: "guilds", table: "guilds" },
  { file: "guildInvites", table: "guild_invites" },
  { file: "guildChats", table: "guild_chats" },
  { file: "mailbox", table: "mailbox" },
  { file: "excludedUsers", table: "excluded_users" },
  { file: "codes", table: "codes" },
  { file: "marketplace", table: "marketplace" },
];

let Database = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  console.error("✖ better-sqlite3 não está instalado (necessário apenas para esta recuperação).");
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.error("✖ Banco não encontrado em", DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
let total = 0;
for (const { file, table } of PLAYER_COLLECTIONS) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT * FROM "${table}"`).all();
  } catch (e) {
    console.log(`  ⚠ tabela ${table} ausente: ${e.message}`);
  }
  const docs = rows
    .map((row) => {
      try {
        if (row && typeof row.data === "string") return JSON.parse(row.data);
      } catch { /* dados inválidos */ }
      return row;
    })
    .filter((r) => r && typeof r === "object");
  writeFileSync(path.join(DATA_DIR, `${file}.json`), JSON.stringify(docs, null, 2), "utf8");
  total += docs.length;
  console.log(`  → ${file}.json : ${docs.length} registros`);
}
db.close();

console.log(`\n✔ Recuperação concluída: ${total} registros de jogadores restaurados em data/*.json`);