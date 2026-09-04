/* Diagnóstico da persistência JSON local. Uso: node scripts/test-db.mjs */
import "dotenv/config";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");

const COLLECTIONS = [
  "users", "characters", "itemTemplates", "inventoryItems", "missionTemplates",
  "activeMissions", "afkRewards", "battles", "guilds", "guildInvites",
  "guildChats", "mailbox", "excludedUsers", "regionAudio", "serverSettings",
  "codes", "marketplace", "adminLogs",
];

console.log("Diretório de dados:", DATA_DIR);
console.log("Existe:", fs.existsSync(DATA_DIR));

if (!fs.existsSync(DATA_DIR)) {
  console.error("✖ Diretório de dados não encontrado. Execute `node scripts/setup-data.mjs` primeiro.");
  process.exit(1);
}

const start = Date.now();
try {
  let grandTotal = 0;
  for (const name of COLLECTIONS) {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  ${name}: AUSENTE`);
      continue;
    }
    let count = 0;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      count = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      count = 0;
    }
    grandTotal += count;
    console.log(`  ${name}: ${count} registros`);
  }

  const sizeBytes = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .reduce((n, f) => n + (fs.statSync(path.join(DATA_DIR, f)).size || 0), 0);

  const ms = Date.now() - start;
  console.log(`\n✔ JSON OK em ${ms}ms — ${grandTotal} registros, ~${Math.round(sizeBytes / 1024)} KB`);
} catch (e) {
  const ms = Date.now() - start;
  console.log(`\n✖ FALHOU em ${ms}ms ->`, e.message);
  process.exitCode = 1;
}