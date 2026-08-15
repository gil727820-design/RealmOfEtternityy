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
    /*
     * Pool enxuto: o pooler do Supabase em modo session limita a ~15 clientes
     * (EMAXCONNSESSION). Usar max baixo + idle curto evita saturar o pooler
     * com o polling do jogo (boss mundial, presença, mercado...).
     * Idealmente use o TRANSACTION pooler (porta 6543) na DATABASE_URL — ele
     * aceita centenas de clientes concorrentes sem esse teto.
     */
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

const db = drizzle(pool);

export { pool, db };
