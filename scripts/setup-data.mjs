/*
 * Setup da persistência JSON — roda na MÁQUINA DO USUÁRIO (npm run db:setup).
 *
 * Garante que o diretório de dados e os arquivos data/*.json existam.
 * Não apaga nada: coleções ausentes viram vazias; o catálogo (itens/missões)
 * é repopulado pelo seed (ação "seed" no jogo / painel admin).
 *
 * Uso:  node scripts/setup-data.mjs
 */
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");

const COLLECTIONS = [
  "users", "characters", "itemTemplates", "inventoryItems", "missionTemplates",
  "activeMissions", "afkRewards", "battles", "guilds", "guildInvites",
  "guildChats", "mailbox", "excludedUsers", "regionAudio", "serverSettings",
  "codes", "marketplace", "adminLogs",
];

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let created = 0;
for (const name of COLLECTIONS) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) {
    writeFileSync(file, "[]\n", "utf8");
    created++;
  }
}

console.log(`✔ Diretório: ${DATA_DIR}`);
console.log(created ? `✔ Criados ${created} arquivos JSON vazios.` : "✔ Coleções JSON já existem.");
console.log("  O catálogo (itens/missões) é semeado pela ação 'seed' no jogo (painel admin também).");