import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/*
 * Persistência 100% no Supabase (Postgres).
 * NÃO existe mais fallback para JSON/local storage: se a DATABASE_URL não
 * estiver configurada, o servidor falha rápido com uma mensagem clara em vez
 * de rodar silenciosamente com um banco vazio (`db = {}`).
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "FALTA DATABASE_URL no .env. Todo os dados agora são persistidos no Supabase (Postgres). " +
      "Cole a connection string (preferencialmente o Pooler Session do painel) no .env " +
      "e rode `node scripts/migrate.mjs` para criar as tabelas."
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

const db = drizzle(pool);

export { pool, db };
