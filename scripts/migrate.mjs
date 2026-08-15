/*
 * Migração para o Supabase (Postgres) — roda na MÁQUINA DO USUÁRIO (com internet).
 *
 * O que faz:
 *  1. Cria as 14 tabelas (padrão `id`/colunas de consulta + `data jsonb`).
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
import { readFileSync, readdirSync, unlinkSync } from "fs";
import path from "path";
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

const DDL = `
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, username text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS characters (id uuid PRIMARY KEY, user_id uuid, name text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS item_templates (id integer PRIMARY KEY, name_key text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_items (id uuid PRIMARY KEY, character_id uuid, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS mission_templates (id integer PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS active_missions (id uuid PRIMARY KEY, character_id uuid, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS afk_rewards (id uuid PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS battles (id uuid PRIMARY KEY, character_id uuid, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS guilds (id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS guild_invites (id uuid PRIMARY KEY, target_character_id uuid, guild_id text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS guild_chats (id uuid PRIMARY KEY, guild_id text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS mailbox (id uuid PRIMARY KEY, character_id uuid, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS excluded_users (user_id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS region_audio (region_id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS server_settings (key text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS codes (id uuid PRIMARY KEY, code text, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS marketplace (id uuid PRIMARY KEY, character_id uuid, kind text, data jsonb NOT NULL);
`;

function readJson(name) {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", name), "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  console.log("→ Testando conexão com o Supabase...");
  try {
    const probe = await pool.connect();
    probe.release();
    console.log("  ✓ Conexão OK. Agora criando tabelas...");
  } catch (err) {
    console.error("\n✖ NÃO foi possível conectar ao Supabase.");
    console.error("  Detalhe técnico:", err.message);
    console.error("");
    console.error("  Possíveis causas e soluções:");
    console.error("  1) CONEXÃO DIRETA bloqueada (porta 5432): use o POOLER Session do painel.");
    console.error("     String do Pooler (Session):");
    console.error("     postgresql://postgres.kumjawdkufzwpsaeevmj:SENHA@aws-0-<REGIAO>.pooler.supabase.com:5432/postgres");
    console.error("     -> cole essa string (substituindo SENHA e <REGIAO>) no .env");
    console.error("  2) IPv6: rode com a variável  PG_FORCE_IPV4=1  (já suportada pelo script).");
    console.error("  3) Senha incorreta ou com caractere especial: verifique o .env.");
    console.error("  4) Firewall que bloqueia saida TCP para a porta 5432.");
    console.error("");
    process.exitCode = 1;
    return;
  }

  console.log("→ Criando tabelas...");
  await pool.query(DDL);
  console.log("  OK: tabelas criadas/verificadas.");

  // Templates de itens (preserva os ids originais)
  const items = readJson("itemTemplates.json");
  if (Array.isArray(items) && items.length) {
    for (const row of items) {
      await pool.query(
        "INSERT INTO item_templates (id, name_key, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING",
        [row.id ?? 0, row.nameKey ?? null, JSON.stringify(row)]
      );
    }
    console.log(`→ itemTemplates.json migrado: ${items.length} itens.`);
  } else {
    console.log("→ itemTemplates.json vazio/inexistente — nada a migrar (o seed criará).");
  }

  // Templates de missões
  const missions = readJson("missionTemplates.json");
  if (Array.isArray(missions) && missions.length) {
    for (const row of missions) {
      await pool.query(
        "INSERT INTO mission_templates (id, data) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING",
        [row.id ?? 0, JSON.stringify(row)]
      );
    }
    console.log(`→ missionTemplates.json migrado: ${missions.length} missões.`);
  } else {
    console.log("→ missionTemplates.json vazio/inexistente — nada a migrar (o seed criará).");
  }

  // Música por ilha
  const audio = readJson("regionAudio.json");
  if (Array.isArray(audio) && audio.length) {
    for (const row of audio) {
      const rid = row.regionId ?? row.region_id ?? "";
      if (!rid) continue;
      await pool.query(
        "INSERT INTO region_audio (region_id, data) VALUES ($1,$2) ON CONFLICT (region_id) DO NOTHING",
        [rid, JSON.stringify(row)]
      );
    }
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
  } catch (e) {
    console.log("→ data/ não localizado para limpeza.");
  }

  console.log("\n✔ Migração concluída. Comece também o servidor e acione o seed (loja") ;
  console.log("  / painel admin) se algum template não estiver presente.");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("✖ Falha na migração:", e.message);
    process.exitCode = 1;
    pool.end();
  });