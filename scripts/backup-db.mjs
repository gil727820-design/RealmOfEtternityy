/**
 * Backup automático do banco (Postgres/Supabase).
 *
 * Dump completo de todas as tabelas para um arquivo JSON com timestamp,
 * mantendo apenas os últimos `KEEP` backups (padrão: 14 = 2 semanas).
 *
 * Uso:
 *   node scripts/backup-db.mjs            # backup agora
 *   KEEP=30 node scripts/backup-db.mjs    # mantém 30 backups
 *
 * Para agendar (ex.: todo dia às 04:00 no Windows — agendador de tarefas):
 *   node "C:\caminho\do\projeto\scripts\backup-db.mjs"
 * Ou no Linux/cron:
 *   0 4 * * * cd /caminho/do/projeto && node scripts/backup-db.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada. Verifique o .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const BACKUP_DIR = path.join(process.cwd(), "backups");
const KEEP = Math.max(1, Number(process.env.KEEP) || 14);

/** Data compacta local: 2026-08-15_04-00-00 */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

try {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const tablesRes = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tables = tablesRes.rows.map((r) => r.tablename);

  const dump = {
    exportedAt: new Date().toISOString(),
    tables: {},
  };
  for (const table of tables) {
    const res = await pool.query(`SELECT * FROM ${JSON.stringify(table).replace(/"/g, '"')}`);
    dump.tables[table] = res.rows;
  }

  const fileName = `backup_${stamp()}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), "utf8");

  const sizeKb = Math.round(fs.statSync(filePath).size / 1024);
  console.log(
    `✅ Backup salvo: ${fileName} (${sizeKb} KB) — ${Object.keys(dump.tables).length} tabelas`
  );

  // Remove backups antigos (mantém só os KEEP mais recentes).
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  for (const f of files.slice(KEEP)) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`🗑️  Removido backup antigo: ${f}`);
  }
  console.log(`Backups mantidos: ${Math.min(files.length, KEEP)}/${KEEP}`);
} catch (err) {
  console.error("❌ Falha no backup:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
