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
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!existsSync(USERS_FILE)) {
  console.error("✖ users.json não encontrado. Execute `node scripts/setup-data.mjs` primeiro.");
  process.exit(1);
}

function main() {
  const users = JSON.parse(readFileSync(USERS_FILE, "utf8") || "[]");

  let cleaned = 0;
  for (const u of users) {
    if ("passwordPlain" in u) {
      delete u.passwordPlain;
      cleaned++;
    }
  }

  const bcryptHashed = users.filter(
    (u) => typeof u.password === "string" && u.password.startsWith("$2")
  ).length;

  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");

  console.log(`✔ ${cleaned} usuário(s) tiveram o passwordPlain removido.`);
  console.log(`✔ ${bcryptHashed} usuário(s) com hash bcrypt mantido (login intacto).`);
  console.log("  Pronto. O painel admin agora só redefine senha via hash.");
}

try {
  main();
} catch (e) {
  console.error("✖ Falha na limpeza:", e.message);
  process.exitCode = 1;
}