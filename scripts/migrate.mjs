/*
 * Migração para SQLite local — roda na MÁQUINA DO USUÁRIO.
 *
 * O que faz:
 *  1. Cria as 18 tabelas (padrão `id`/colunas de consulta + `data text` JSON).
 *  2. Migra APENAS dados de suporte/template:
 *       - itemTemplates.json  -> item_templates
 *       - missionTemplates.json -> mission_templates
 *       - regionAudio.json    -> region_audio
 *  3. Apaga os arquivos data/*.json (começo limpo para JOGADORES).
 *
 * Dados de JOGADOR (users, characters, inventory, guilds, mailbox etc.) NÃO são
 * migrados de propósito — começa com contas limpas.
 *
 * Uso:  node scripts/migrate.mjs
 */
import "dotenv/config";
import { readFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

// Garante diretório
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

const DDL = `
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

function readJson(name) {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", name), "utf8"));
  } catch {
    return [];
  }
}

function main() {
  console.log("→ Criando tabelas no SQLite...");
  db.exec(DDL);
  console.log("  OK: tabelas criadas/verificadas.");

  // Templates de itens
  const items = readJson("itemTemplates.json");
  if (Array.isArray(items) && items.length) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO item_templates (id, name_key, data) VALUES (?, ?, ?)"
    );
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(row.id ?? 0, row.nameKey ?? null, JSON.stringify(row));
      }
    });
    tx(items);
    console.log(`→ itemTemplates.json migrado: ${items.length} itens.`);
  } else {
    console.log("→ itemTemplates.json vazio/inexistente — nada a migrar (o seed criará).");
  }

  // Templates de missões
  const missions = readJson("missionTemplates.json");
  if (Array.isArray(missions) && missions.length) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO mission_templates (id, data) VALUES (?, ?)"
    );
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(row.id ?? 0, JSON.stringify(row));
      }
    });
    tx(missions);
    console.log(`→ missionTemplates.json migrado: ${missions.length} missões.`);
  } else {
    console.log("→ missionTemplates.json vazio/inexistente — nada a migrar (o seed criará).");
  }

  // Música por ilha
  const audio = readJson("regionAudio.json");
  if (Array.isArray(audio) && audio.length) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO region_audio (region_id, data) VALUES (?, ?)"
    );
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const rid = row.regionId ?? row.region_id ?? "";
        if (!rid) continue;
        insert.run(rid, JSON.stringify(row));
      }
    });
    tx(audio);
    console.log(`→ regionAudio.json migrado: ${audio.length} regiões.`);
  } else {
    console.log("→ regionAudio.json vazio/inexistente — nada a migrar.");
  }

  // Apaga os arquivos JSON (dados de jogador NÃO migrados => começo limpo)
  const dataDir = path.join(process.cwd(), "data");
  try {
    for (const f of readdirSync(dataDir)) {
      if (f.endsWith(".json")) {
        unlinkSync(path.join(dataDir, f));
        console.log("→ removido data/" + f);
      }
    }
  } catch {
    console.log("→ data/ não localizado para limpeza.");
  }

  db.close();
  console.log("\n✔ Migração SQLite concluída. Banco: " + DB_PATH);
  console.log("  Comece o servidor e acione o seed se algum template não estiver presente.");
}

try {
  main();
} catch (e) {
  console.error("✖ Falha na migração:", e.message);
  process.exitCode = 1;
  db.close();
}
