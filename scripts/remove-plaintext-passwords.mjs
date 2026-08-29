/*
 * Limpeza de senhas em texto puro (passwordPlain) — migração de segurança.
 *
 * Rodar UMA vez depois do deploy da mudança que parou de gravar passwordPlain:
 *   node scripts/remove-plaintext-passwords.mjs
 *
 * O que faz:
 *  - Remove o campo `passwordPlain` de TODOS os usuários (a senha de verdade
 *    nunca foi o problema — o hash bcrypt é mantido intacto).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, "game.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("✖ Banco não encontrado. Execute `node scripts/migrate.mjs` primeiro.");
  process.exit(1);
}

const db = new Database(DB_PATH);

function main() {
  const rows = db.prepare("SELECT id, data FROM users").all();
  let cleaned = 0;
  let hadPassword = 0;

  const update = db.prepare("UPDATE users SET data = ? WHERE id = ?");

  const tx = db.transaction(() => {
    for (const row of rows) {
      const data = JSON.parse(row.data);
      let changed = false;

      if (typeof data.passwordPlain === "string" && data.passwordPlain !== "") {
        delete data.passwordPlain;
        changed = true;
        cleaned++;
      }

      if (typeof data.passwordPlain === "string") {
        delete data.passwordPlain;
        changed = true;
      }

      if (changed) {
        update.run(JSON.stringify(data), row.id);
      }

      if (typeof data.password === "string" && data.password.startsWith("$2")) {
        hadPassword++;
      }
    }
  });
  tx();

  console.log(`✔ ${cleaned} usuário(s) tiveram o passwordPlain removido.`);
  console.log(`✔ ${hadPassword} usuário(s) com hash bcrypt mantido (login intacto).`);
  console.log("  Pronto. O painel admin agora só redefine senha via hash.");
  db.close();
}

try {
  main();
} catch (e) {
  console.error("✖ Falha na limpeza:", e.message);
  process.exitCode = 1;
  db.close();
}
