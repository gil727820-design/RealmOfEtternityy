/*
 * Cria tabelas no SQLite local (sem dados).
 * Uso:  node scripts/create-tables.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const SQL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS item_templates (id INTEGER PRIMARY KEY, name_key TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, character_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mission_templates (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS active_missions (id TEXT PRIMARY KEY, character_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS afk_rewards (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS battles (id TEXT PRIMARY KEY, character_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS guild_invites (id TEXT PRIMARY KEY, target_character_id TEXT, guild_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS guild_chats (id TEXT PRIMARY KEY, guild_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mailbox (id TEXT PRIMARY KEY, character_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS excluded_users (user_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS region_audio (region_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS server_settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS codes (id TEXT PRIMARY KEY, code TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketplace (id TEXT PRIMARY KEY, character_id TEXT, kind TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_logs (id TEXT PRIMARY KEY, kind TEXT, data TEXT NOT NULL);
`;

try {
  db.exec(SQL);
  console.log("OK: tabelas criadas/verificadas no SQLite.");

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  console.log("Tabelas:", tables.map((r) => r.name).join(", "));
} catch (err) {
  console.error("Falha ao criar tabelas:", err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
