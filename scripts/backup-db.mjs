/**
 * Backup automático da persistência JSON.
 *
 * Empacota todas as coleções (data/*.json) em um arquivo JSON com timestamp,
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

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const KEEP = Math.max(1, Number(process.env.KEEP) || 14);

const COLLECTIONS = [
  "users", "characters", "itemTemplates", "inventoryItems", "missionTemplates",
  "activeMissions", "afkRewards", "battles", "guilds", "guildInvites",
  "guildChats", "mailbox", "excludedUsers", "regionAudio", "serverSettings",
  "codes", "marketplace", "adminLogs",
];

/** Data compacta local: 2026-08-15_04-00-00 */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p.getMinutes()}-${p.getSeconds()}`;
}

try {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const dump = {
    exportedAt: new Date().toISOString(),
    engine: "json",
    collections: {},
  };

  for (const name of COLLECTIONS) {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(file)) {
      dump.collections[name] = [];
      continue;
    }
    try {
      dump.collections[name] = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      dump.collections[name] = [];
    }
  }

  const fileName = `backup_${stamp()}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), "utf8");

  const sizeKb = Math.round(fs.statSync(filePath).size / 1024);
  const total = Object.values(dump.collections).reduce((n, arr) => n + arr.length, 0);
  console.log(
    `✅ Backup salvo: ${fileName} (${sizeKb} KB) — ${Object.keys(dump.collections).length} coleções / ${total} registros`
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
}