import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada. Verifique o .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY,
  user_id uuid,
  name text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS item_templates (
  id integer PRIMARY KEY,
  name_key text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY,
  character_id uuid,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_templates (
  id integer PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS active_missions (
  id uuid PRIMARY KEY,
  character_id uuid,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS afk_rewards (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY,
  character_id uuid,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS guilds (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_invites (
  id uuid PRIMARY KEY,
  target_character_id uuid,
  guild_id text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_chats (
  id uuid PRIMARY KEY,
  guild_id text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS mailbox (
  id uuid PRIMARY KEY,
  character_id uuid,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS excluded_users (
  user_id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS region_audio (
  region_id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS server_settings (
  key text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
  id uuid PRIMARY KEY,
  code text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS marketplace (
  id uuid PRIMARY KEY,
  character_id uuid,
  kind text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY,
  kind text,
  data jsonb NOT NULL
);
`;

try {
  await pool.query(SQL);
  console.log("OK: tabelas criadas/verificadas no Supabase.");
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("Tabelas em public:", tables.rows.map((r) => r.tablename).join(", "));
} catch (err) {
  console.error("Falha ao criar tabelas:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}