/**
 * 🧪 Script de teste: cria contas para cada classe do jogo
 * Persistência JSON (data/users.json + data/characters.json)
 * Roda: node scripts/create-test-accounts.mjs
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CHARS_FILE = path.join(DATA_DIR, "characters.json");

const CLASSES = [
  "warrior", "paladin", "berserker", "mage", "necromancer",
  "assassin", "hunter", "monk", "samurai", "knight",
  "summoner", "templar", "archer"
];

const CLASS_BASE_STATS = {
  warrior:     { hp: 130, attack: 11, defense: 12, speed: 4, mana: 30, critical: 3 },
  paladin:     { hp: 150, attack: 9,  defense: 14, speed: 3, mana: 60, critical: 2 },
  berserker:   { hp: 90,  attack: 15, defense: 5,  speed: 6, mana: 20, critical: 7 },
  mage:        { hp: 75,  attack: 14, defense: 5,  speed: 5, mana: 100, critical: 5 },
  necromancer: { hp: 85,  attack: 13, defense: 6,  speed: 4, mana: 90, critical: 4 },
  assassin:    { hp: 70,  attack: 13, defense: 3,  speed: 10, mana: 40, critical: 12 },
  hunter:      { hp: 85,  attack: 13, defense: 6,  speed: 8, mana: 35, critical: 9 },
  monk:        { hp: 100, attack: 11, defense: 9,  speed: 9, mana: 50, critical: 5 },
  samurai:     { hp: 95,  attack: 14, defense: 8,  speed: 7, mana: 35, critical: 10 },
  knight:      { hp: 160, attack: 7,  defense: 18, speed: 2, mana: 25, critical: 2 },
  summoner:    { hp: 80,  attack: 12, defense: 5,  speed: 5, mana: 95, critical: 4 },
  templar:     { hp: 120, attack: 11, defense: 13, speed: 4, mana: 55, critical: 3 },
  archer:      { hp: 80,  attack: 14, defense: 5,  speed: 8, mana: 30, critical: 11 },
};

const read = (file) => {
  if (!existsSync(file)) return [];
  try {
    const arr = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

let users = read(USERS_FILE);
let chars = read(CHARS_FILE);

const takenNames = new Set([...users.map((u) => String(u.username || "")), ...chars.map((c) => String(c.name || ""))]);

let count = 0;
for (const cls of CLASSES) {
  const name = `Test_${cls}`;
  if (takenNames.has(name)) {
    console.log(`↷ ${name} já existe — pulando.`);
    continue;
  }
  const userId = randomUUID();
  const charId = randomUUID();
  const stats = CLASS_BASE_STATS[cls];

  users.push({
    id: userId,
    username: name,
    password: "", // login: usuário Test_<classe> + senha vazia
    role: "player",
    banned: false,
    deleted: false,
    createdAt: new Date().toISOString(),
    lastLogin: null,
  });

  chars.push({
    id: charId,
    userId,
    name,
    classType: cls,
    sex: "male",
    level: 50,
    xp: 0,
    xpToNext: 11700,
    hp: stats.hp,
    maxHp: stats.hp,
    mana: stats.mana,
    maxMana: stats.mana,
    attack: stats.attack + 50,
    defense: stats.defense + 30,
    speed: stats.speed + 10,
    critical: stats.critical + 15,
    dodge: 5,
    precision: 5,
    resistance: 5,
    energy: 100,
    maxEnergy: 100,
    gold: 100000,
    diamonds: 50,
    crystals: 100,
    towerCoins: 500,
    towerFloor: 50,
    pvpCoins: 200,
    pvpRating: 1000,
    pvpLeague: "gold",
    prestige: 0,
    skillPoints: 16,
    unspentStatPoints: 0,
    skills: {},
    talents: {},
    collection: { unlocked: [], claimed: [] },
    bestiary: {},
    achievements: [],
    titles: [],
    activeTitle: null,
    activeRelicId: null,
    activePetId: null,
    pets: {},
    skins: [],
    equippedSkin: null,
    currentRegion: "starter_village",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    lastEnergyAt: new Date().toISOString(),
    afkSince: null,
    miniBossKilledAt: 0,
    regionBossKills: {},
    dungeonStats: { cleared: 0 },
    dungeonActive: null,
    dungeonDifficulty: "normal",
    dailyMissions: {},
    weeklyMissions: {},
    missionBatch: 0,
    pendingEvent: null,
    dailyLogin: { day: 0, lastClaim: null },
    vipLevel: 0,
    vipTier: null,
    vipUntil: null,
    seasonPoints: 0,
    seasonId: null,
    pvpDailyCount: 0,
    pvpDailyDate: null,
    boosts: {},
    pityCounters: {},
    collectionBonus: 0,
    guildId: null,
    guildRank: null,
    guildCoins: 0,
    guildBuffs: {},
    ascension: 0,
    bestiaryCount: 0,
    collectionCount: 0,
    dungeonCleared: 0,
    ascensionCount: 0,
    lastEvent: null,
    avatarId: 1,
    eyeColor: "#2E86AB",
    hairColor: "#8B4513",
    xpToNextOfLevel: 11700,
  });
  count++;
  console.log(`✅ Criado: Test_${cls} (Lv.50, 100K gold, 50 diamantes)`);
}

writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
writeFileSync(CHARS_FILE, JSON.stringify(chars, null, 2), "utf8");

console.log(`\n🧪 ${count} contas de teste criadas!`);
console.log(`📋 Login: usuário Test_<classe> + senha vazia`);