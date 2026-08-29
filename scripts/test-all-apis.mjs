/**
 * 🧪 TESTE COMPLETO DE TODAS AS APIs DO JOGO
 * Rotas corretas baseadas no filesystem real
 */

const BASE = "http://localhost:3000";
const results = [];
let pass = 0;
let fail = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    if (result === true || result === undefined) {
      console.log(`  ✅ ${name}`);
      results.push({ name, status: "PASS" });
      pass++;
    } else {
      console.log(`  ❌ ${name}: ${result}`);
      results.push({ name, status: "FAIL", error: result });
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    results.push({ name, status: "ERROR", error: e.message });
    fail++;
  }
}

import Database from "better-sqlite3";
import jwt from "jsonwebtoken";

const db = new Database("data/game.db");
const chars = db.prepare("SELECT id, data FROM characters WHERE data LIKE '%Test_%' LIMIT 1").all();
db.close();

if (!chars.length) { console.log("❌ Rode create-test-accounts.mjs primeiro"); process.exit(1); }

const char = JSON.parse(chars[0].data);
const CID = char.id;

// Gerar token JWT válido
const secret = process.env.SESSION_SECRET || process.env.ADMIN_KEY || "";
let AUTH_COOKIE = "";
if (secret) {
  const token = jwt.sign({ sub: char.userId, role: "player" }, secret, { expiresIn: 86400 });
  AUTH_COOKIE = `roe_session=${token}`;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (AUTH_COOKIE) headers["Cookie"] = AUTH_COOKIE;
  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, isJson: !!data };
}

console.log(`\n🧪 TESTANDO COM: ${char.name} (${char.classType}) ID: ${CID}`);
console.log(`🔑 Auth: ${AUTH_COOKIE ? "OK" : "SEM TOKEN"}\n`);

// ━━━━━━━ 1. AUTH ━━━━━━━
console.log("━━━ 1. AUTH ━━━");
await test("POST /api/auth/login", async () => {
  const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ userId: char.userId }) });
  return r.status === 200 || r.status === 401 || r.status === 400;
});
await test("GET /api/auth/me", async () => {
  const r = await api("/api/auth/me");
  return r.status === 200 || r.status === 401;
});
await test("POST /api/auth/register", async () => {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ username: "test_bug_" + Date.now(), password: "123" }) });
  return r.status === 200 || r.status === 400;
});

// ━━━━━━━ 2. CHARACTER ━━━━━━━
console.log("\n━━━ 2. CHARACTER ━━━");
await test("GET /api/character/:id", async () => {
  const r = await api(`/api/character/${CID}`);
  return r.status === 200 || r.status === 401;
});
await test("POST /api/character/create", async () => {
  const r = await api("/api/character/create", { method: "POST", body: JSON.stringify({ userId: char.userId, name: "TestTemp_" + Date.now(), classType: "warrior", sex: "male" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/character/skill", async () => {
  const r = await api("/api/character/skill", { method: "POST", body: JSON.stringify({ characterId: CID, skillId: "test" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/character/allocate", async () => {
  const r = await api("/api/character/allocate", { method: "POST", body: JSON.stringify({ characterId: CID, stat: "attack", qty: 1 }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 3. TOWER ━━━━━━━
console.log("\n━━━ 3. TOWER ━━━");
await test("POST /api/tower/fight (start)", async () => {
  const r = await api("/api/tower/fight", { method: "POST", body: JSON.stringify({ characterId: CID, action: "start" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 4. REGION FARM ━━━━━━━
console.log("\n━━━ 4. REGION FARM ━━━");
await test("GET /api/region/farm", async () => {
  const r = await api(`/api/region/farm?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/region/farm", async () => {
  const r = await api("/api/region/farm", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 5. MINI BOSS ━━━━━━━
console.log("\n━━━ 5. MINI BOSS ━━━");
await test("GET /api/region/mini-boss", async () => {
  const r = await api(`/api/region/mini-boss?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/region/mini-boss (start)", async () => {
  const r = await api("/api/region/mini-boss", { method: "POST", body: JSON.stringify({ characterId: CID, action: "start" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 6. REGION BOSS ━━━━━━━
console.log("\n━━━ 6. REGION BOSS ━━━");
await test("POST /api/region-boss/fight", async () => {
  const r = await api("/api/region-boss/fight", { method: "POST", body: JSON.stringify({ characterId: CID, action: "start" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 7. DUNGEON ━━━━━━━
console.log("\n━━━ 7. DUNGEON ━━━");
await test("POST /api/dungeon/start", async () => {
  const r = await api("/api/dungeon/start", { method: "POST", body: JSON.stringify({ characterId: CID, difficulty: "normal" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/dungeon/collect", async () => {
  const r = await api("/api/dungeon/collect", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("GET /api/dungeon/ranking", async () => {
  const r = await api("/api/dungeon/ranking");
  return r.status === 200;
});

// ━━━━━━━ 8. PVP ━━━━━━━
console.log("\n━━━ 8. PVP ━━━");
await test("POST /api/pvp/battle", async () => {
  const r = await api("/api/pvp/battle", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("GET /api/pvp/ranking", async () => {
  const r = await api(`/api/pvp/ranking?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});
await test("GET /api/pvp/history", async () => {
  const r = await api(`/api/pvp/history?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 9. MISSIONS ━━━━━━━
console.log("\n━━━ 9. MISSIONS ━━━");
await test("GET /api/missions/daily", async () => {
  const r = await api(`/api/missions/daily?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});
await test("POST /api/missions/claim (missao invalida)", async () => {
  const r = await api("/api/missions/claim", { method: "POST", body: JSON.stringify({ characterId: CID, missionId: "test_invalid" }) });
  return r.status === 200 || r.status === 400 || r.status === 401 || r.status === 404;
});

// ━━━━━━━ 10. AFK ━━━━━━━
console.log("\n━━━ 10. AFK ━━━");
await test("POST /api/afk/claim", async () => {
  const r = await api("/api/afk/claim", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/afk/start", async () => {
  const r = await api("/api/afk/start", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 11. GUILD ━━━━━━━
console.log("\n━━━ 11. GUILD ━━━");
await test("GET /api/guild", async () => {
  const r = await api(`/api/guild?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("GET /api/guild/shop", async () => {
  const r = await api(`/api/guild/shop?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("GET /api/guild/skills", async () => {
  const r = await api(`/api/guild/skills?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 12. INVENTORY ━━━━━━━
console.log("\n━━━ 12. INVENTORY ━━━");
await test("POST /api/inventory/equip", async () => {
  const r = await api("/api/inventory/equip", { method: "POST", body: JSON.stringify({ characterId: CID, itemId: "test" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});
await test("POST /api/inventory/sell", async () => {
  const r = await api("/api/inventory/sell", { method: "POST", body: JSON.stringify({ characterId: CID, itemId: "test" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 13. PETS ━━━━━━━
console.log("\n━━━ 13. PETS ━━━");
await test("GET /api/pets", async () => {
  const r = await api(`/api/pets?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 14. RELICS ━━━━━━━
console.log("\n━━━ 14. RELICS ━━━");
await test("GET /api/relics", async () => {
  const r = await api(`/api/relics?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 15. SKIN SHOP ━━━━━━━
console.log("\n━━━ 15. SKIN SHOP ━━━");
await test("GET /api/skin-shop", async () => {
  const r = await api(`/api/skin-shop?characterId=${CID}`);
  return r.status === 200;
});

// ━━━━━━━ 16. GHOST SHOP ━━━━━━━
console.log("\n━━━ 16. GHOST SHOP ━━━");
await test("GET /api/ghost-shop", async () => {
  const r = await api("/api/ghost-shop");
  return r.status === 200;
});

// ━━━━━━━ 17. RANKINGS ━━━━━━━
console.log("\n━━━ 17. RANKINGS ━━━");
await test("GET /api/rankings", async () => {
  const r = await api("/api/rankings");
  return r.status === 200;
});
await test("GET /api/rankings?category=level", async () => {
  const r = await api("/api/rankings?category=level");
  return r.status === 200;
});
await test("GET /api/rankings?category=tower", async () => {
  const r = await api("/api/rankings?category=tower");
  return r.status === 200;
});

// ━━━━━━━ 18. ACHIEVEMENTS ━━━━━━━
console.log("\n━━━ 18. ACHIEVEMENTS ━━━");
await test("GET /api/achievements", async () => {
  const r = await api(`/api/achievements?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 19. DAILY EVENTS ━━━━━━━
console.log("\n━━━ 19. DAILY EVENTS ━━━");
await test("GET /api/daily-events", async () => {
  const r = await api(`/api/daily-events?characterId=${CID}`);
  return r.status === 200;
});

// ━━━━━━━ 20. QUESTLINES ━━━━━━━
console.log("\n━━━ 20. QUESTLINES ━━━");
await test("GET /api/questlines", async () => {
  const r = await api(`/api/questlines?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 21. ENCHANTMENTS ━━━━━━━
console.log("\n━━━ 21. ENCHANTMENTS ━━━");
await test("GET /api/enchantments", async () => {
  const r = await api(`/api/enchantments?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 22. FORGE ━━━━━━━
console.log("\n━━━ 22. FORGE ━━━");
await test("POST /api/forge", async () => {
  const r = await api("/api/forge", { method: "POST", body: JSON.stringify({ characterId: CID, itemId: "test", action: "enchant" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 23. MARKET ━━━━━━━
console.log("\n━━━ 23. MARKET ━━━");
await test("GET /api/market", async () => {
  const r = await api(`/api/market?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 24. MAILBOX ━━━━━━━
console.log("\n━━━ 24. MAILBOX ━━━");
await test("GET /api/mailbox", async () => {
  const r = await api(`/api/mailbox?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 25. WORLD BOSS ━━━━━━━
console.log("\n━━━ 25. WORLD BOSS ━━━");
await test("GET /api/world-boss", async () => {
  const r = await api("/api/world-boss");
  return r.status === 200;
});

// ━━━━━━━ 26. SEASON ━━━━━━━
console.log("\n━━━ 26. SEASON ━━━");
await test("GET /api/season", async () => {
  const r = await api("/api/season");
  return r.status === 200;
});

// ━━━━━━━ 27. BESTIARY ━━━━━━━
console.log("\n━━━ 27. BESTIARY ━━━");
await test("GET /api/bestiary", async () => {
  const r = await api(`/api/bestiary?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 28. COLLECTION ━━━━━━━
console.log("\n━━━ 28. COLLECTION ━━━");
await test("GET /api/collection", async () => {
  const r = await api(`/api/collection?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 29. ASCENSION ━━━━━━━
console.log("\n━━━ 29. ASCENSION ━━━");
await test("GET /api/ascension", async () => {
  const r = await api(`/api/ascension?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 30. SPECIALIZATION ━━━━━━━
console.log("\n━━━ 30. SPECIALIZATION ━━━");
await test("GET /api/specialization", async () => {
  const r = await api(`/api/specialization?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 31. CODES ━━━━━━━
console.log("\n━━━ 31. CODES ━━━");
await test("POST /api/codes/redeem", async () => {
  const r = await api("/api/codes/redeem", { method: "POST", body: JSON.stringify({ characterId: CID, code: "INVALID" }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 32. DAILY LOGIN ━━━━━━━
console.log("\n━━━ 32. DAILY LOGIN ━━━");
await test("POST /api/daily-login", async () => {
  const r = await api("/api/daily-login", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 33. ADVANCED CLASS ━━━━━━━
console.log("\n━━━ 33. ADVANCED CLASS ━━━");
await test("GET /api/advanced-class", async () => {
  const r = await api(`/api/advanced-class?characterId=${CID}`);
  return r.status === 200 || r.status === 401;
});

// ━━━━━━━ 34. INHERITANCE ━━━━━━━
console.log("\n━━━ 34. INHERITANCE ━━━");
await test("GET /api/inheritance", async () => {
  const r = await api(`/api/inheritance?characterId=${CID}`);
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 35. WORLD EXPLORATION ━━━━━━━
console.log("\n━━━ 35. WORLD EXPLORATION ━━━");
await test("POST /api/world-exploration", async () => {
  const r = await api("/api/world-exploration", { method: "POST", body: JSON.stringify({ characterId: CID }) });
  return r.status === 200 || r.status === 400 || r.status === 401;
});

// ━━━━━━━ 36. HEALTH ━━━━━━━
console.log("\n━━━ 36. HEALTH ━━━");
await test("GET /api/health", async () => {
  const r = await api("/api/health");
  return r.status === 200;
});

// ══════════════════════════════════════════════════════════════
// RELATÓRIO
// ══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`\n📊 RELATÓRIO FINAL:`);
console.log(`  ✅ Passou: ${pass}`);
console.log(`  ❌ Falhou: ${fail}`);
console.log(`  📋 Total: ${pass + fail}`);
console.log(`  🎯 Taxa: ${Math.round((pass / (pass + fail)) * 100)}%`);

if (fail > 0) {
  console.log(`\n❌ FALHAS (${fail}):`);
  results.filter(r => r.status !== "PASS").forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
}
console.log(`\n${"═".repeat(50)}\n`);
