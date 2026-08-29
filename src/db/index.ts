import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

/*
 * Persistência 100% local com SQLite (better-sqlite3).
 * Zero custo, zero servidor externo — arquivo .db na pasta do projeto.
 * Ideal para comunidades de até ~50 jogadores simultâneos.
 */

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

// Garante que o diretório existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const globalForDb = globalThis as typeof globalThis & {
  __sqliteDb?: Database.Database;
};

const sqlite =
  globalForDb.__sqliteDb ??
  new Database(DB_PATH, {
    // WAL mode = leitura concorrente + performance
    verbose: process.env.NODE_ENV !== "production" ? console.log : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sqliteDb = sqlite;
}

// Ativa WAL mode para melhor performance e WALCheckpoint periódico
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("cache_size = -64000"); // 64MB cache
sqlite.pragma("busy_timeout = 5000");

const db = drizzle(sqlite, { schema });

export { sqlite, db };
