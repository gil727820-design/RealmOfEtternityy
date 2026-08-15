/*
 * Limpeza de senhas em texto puro (passwordPlain) — migração de segurança.
 *
 * Rodar UMA vez depois do deploy da mudança que parou de gravar passwordPlain:
 *   node scripts/remove-plaintext-passwords.mjs
 *
 * O que faz:
 *  - Remove o campo `passwordPlain` de TODOS os usuários (a senha de verdade
 *    nunca foi o problema — o hash bcrypt é mantido intacto).
 *  - Também remove `password` do retorno (defensivo), mas NUNCA apaga o hash,
 *    senão ninguém mais consegue logar.
 */
import "dotenv/config";
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
});

async function main() {
  const { rows } = await pool.query("SELECT id, data FROM users");
  let cleaned = 0;
  let hadPassword = 0;
  for (const row of rows) {
    const data = row.data || {};
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
    // Só remove o campo se existir na raiz (defensivo — não toca no hash).
    if (changed) {
      await pool.query("UPDATE users SET data = $2 WHERE id = $1", [row.id, JSON.stringify(data)]);
    }
    if (typeof data.password === "string" && data.password.startsWith("$2")) {
      hadPassword++;
    }
  }
  console.log(`✔ ${cleaned} usuário(s) tiveram o passwordPlain removido.`);
  console.log(`✔ ${hadPassword} usuário(s) com hash bcrypt mantido (login intacto).`);
  console.log("  Pronto. O painel admin agora só redefine senha via hash.");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("✖ Falha na limpeza:", e.message);
    process.exitCode = 1;
    pool.end();
  });
