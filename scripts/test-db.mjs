/* Diagnóstico de conexão com o Supabase. Uso: node scripts/test-db.mjs */
import "dotenv/config";
import pg from "pg";
import { lookup } from "dns/promises";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada no .env");
  process.exit(1);
}

// 1) Mostra o host da string e resolve o DNS a partir da SUA máquina
try {
  let host = url.split("@")[1].split("/")[0];
  if (host.includes(":")) host = host.split(":")[0];
  console.log("Host da string:", host);
  const recs = await lookup(host, { all: true, verbatim: true });
  console.log("DNS resolveu para:", recs.map((r) => `${r.address} (${r.family})`).join(", "));
} catch (e) {
  console.log("Falha no DNS:", e.message);
}

async function tryConnect(label, cfg) {
  const pool = new pg.Pool({ ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000, ...cfg });
  const start = Date.now();
  try {
    const c = await pool.connect();
    const { rows } = await c.query("select version()");
    const ms = Date.now() - start;
    console.log(`\n✔ [${label}] CONECTOU em ${ms}ms`);
    console.log("   ", rows[0].version.split(" ")[0], "Postgres OK");
    c.release();
    await pool.end();
    return true;
  } catch (e) {
    const ms = Date.now() - start;
    console.log(`\n✖ [${label}] FALHOU em ${ms}ms ->`, e.message);
    console.log("   cause:", e.cause?.message ?? "n/d");
    await pool.end().catch(() => {});
    return false;
  }
}

const base = { connectionString: url };
const okDef = await tryConnect("como está no .env", base);

if (!okDef && process.platform === "win32" && !process.env.PG_FORCE_IPV4) {
  console.log("\n--- Tentando forçar IPv4 (pode resolver problema de rota IPv6) ---");
  await tryConnect("IPv4 forçado", { ...base, family: 4 });
}

console.log("\nSe falhou em TODOS: use o POOLER Session do Supabase em vez da conexão");
console.log("direta (porta 5432 costuma ser bloqueada em redes domésticas/ISPs).");