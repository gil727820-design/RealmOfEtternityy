/**
 * GUILDA EVOLUTIVA 🏰 — níveis 1-20 + melhorias que buffam os membros.
 *
 * A guilda ganha XP quando os MEMBROS jogam (missões, torre, PvP, masmorras,
 * bosses, AFK) — cada atividade contribui um pouco para o XP da guilda.
 * Ao subir de nível, a guilda aumenta o limite de membros.
 *
 * O líder pode gastar o OURO DO BANCO da guilda para comprar MELHORIAS:
 *   - Quartel     → +HP máx para os membros
 *   - Ferreiro    → +dano para os membros
 *   - Biblioteca  → +XP ganho pelos membros
 *   - Tesouro     → +ouro ganho pelos membros
 *   - Portal      → +energia máxima dos membros
 *
 * Os buffs são PERMANENTES enquanto a melhoria estiver comprada (não consomem
 * nada por dia). A lógica é pura (src/game/) e usada pelas rotas da API.
 */

export interface GuildUpgradeDef {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  /** Nível máximo da melhoria. */
  maxLevel: number;
  /** Custo base em ouro do banco (escala por nível da melhoria). */
  baseCost: number;
  /** Custo por nível adicional (multiplica). */
  costPerLevel: number;
  /** Buff por nível da melhoria. */
  perLevel: number;
}

export const GUILD_UPGRADES: GuildUpgradeDef[] = [
  { id: "barracks", nameKey: "guild.up.barracks", descKey: "guild.up.barracks.desc", icon: "🛡️", maxLevel: 10, baseCost: 5_000, costPerLevel: 1.6, perLevel: 1 },
  { id: "smithy", nameKey: "guild.up.smithy", descKey: "guild.up.smithy.desc", icon: "⚔️", maxLevel: 10, baseCost: 5_000, costPerLevel: 1.6, perLevel: 1 },
  { id: "library", nameKey: "guild.up.library", descKey: "guild.up.library.desc", icon: "📚", maxLevel: 10, baseCost: 5_000, costPerLevel: 1.6, perLevel: 1 },
  { id: "treasury", nameKey: "guild.up.treasury", descKey: "guild.up.treasury.desc", icon: "💰", maxLevel: 10, baseCost: 5_000, costPerLevel: 1.6, perLevel: 1 },
  { id: "portal", nameKey: "guild.up.portal", descKey: "guild.up.portal.desc", icon: "🌀", maxLevel: 5, baseCost: 8_000, costPerLevel: 2.2, perLevel: 5 },
];

/** Nível máximo da guilda. */
export const GUILD_MAX_LEVEL = 20;

/** Limite de membros por nível da guilda (cresce com o nível). */
export function guildMaxMembers(level: number): number {
  const lv = Math.min(GUILD_MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
  return 10 + Math.floor((lv - 1) / 2) * 2;
}

/** XP necessário para subir do nível atual para o próximo. */
export function guildXpForLevel(level: number): number {
  return Math.floor(200 + Math.pow(level, 1.8) * 60);
}

/** XP ganho pela guilda quando um membro realiza uma atividade. */
export function guildXpGain(kind: "mission" | "tower" | "pvp" | "dungeon" | "boss" | "afk" | "war"): number {
  switch (kind) {
    case "mission": return 8;
    case "tower": return 6;
    case "pvp": return 10;
    case "dungeon": return 14;
    case "boss": return 20;
    case "war": return 40;
    case "afk": return 5;
    default: return 5;
  }
}

export interface GuildUpgrades {
  barracks: number;
  smithy: number;
  library: number;
  treasury: number;
  portal: number;
}

/** Lê as melhorias da guilda (default: todas nível 0). */
export function getGuildUpgrades(guild: any): GuildUpgrades {
  const u = guild?.upgrades;
  return {
    barracks: Math.max(0, Math.floor(Number(u?.barracks) || 0)),
    smithy: Math.max(0, Math.floor(Number(u?.smithy) || 0)),
    library: Math.max(0, Math.floor(Number(u?.library) || 0)),
    treasury: Math.max(0, Math.floor(Number(u?.treasury) || 0)),
    portal: Math.max(0, Math.floor(Number(u?.portal) || 0)),
  };
}

/** Custo (ouro do banco) para comprar o próximo nível de uma melhoria. */
export function upgradeCost(def: GuildUpgradeDef, currentLevel: number): number {
  const lv = Math.max(0, Math.floor(Number(currentLevel) || 0));
  return Math.round(def.baseCost * Math.pow(def.costPerLevel, lv));
}

/**
 * Buffs das melhorias aplicados aos membros:
 *  - barracks: +% HP máx (por nível)
 *  - smithy: +% dano (por nível)
 *  - library: +% XP ganho (por nível)
 *  - treasury: +% ouro ganho (por nível)
 *  - portal: +energia máx (pontos por nível)
 */
export function guildBuffs(guild: any) {
  const u = getGuildUpgrades(guild);
  return {
    maxHpPct: u.barracks * 1, // % por nível
    damagePct: u.smithy * 1,
    xpPct: u.library * 1,
    goldPct: u.treasury * 1,
    energyBonus: u.portal * 5, // pontos de energia por nível
  };
}

/** Aplica XP de guilda (atividade de um membro) → patch para updateGuild. */
export function grantGuildXp(guild: any, kind: "mission" | "tower" | "pvp" | "dungeon" | "boss" | "afk") {
  const gain = guildXpGain(kind);
  const level = Math.min(GUILD_MAX_LEVEL, Math.max(1, Math.floor(Number(guild?.level) || 1)));
  let xp = (Number(guild?.xp) || 0) + gain;
  let newLevel = level;
  // Sobe de nível enquanto tiver XP suficiente (1 nível por ganho, no máximo).
  while (newLevel < GUILD_MAX_LEVEL && xp >= guildXpForLevel(newLevel)) {
    xp -= guildXpForLevel(newLevel);
    newLevel++;
  }
  const leveledUp = newLevel > level;
  return {
    patch: {
      xp,
      level: newLevel,
      maxMembers: guildMaxMembers(newLevel),
    },
    leveledUp,
    gain,
  };
}

/** Status consolidado para a UI. */
export function guildLevelStatus(guild: any) {
  const level = Math.min(GUILD_MAX_LEVEL, Math.max(1, Math.floor(Number(guild?.level) || 1)));
  const xp = Number(guild?.xp) || 0;
  const xpToNext = level >= GUILD_MAX_LEVEL ? 0 : guildXpForLevel(level);
  const upgrades = getGuildUpgrades(guild);
  const buffs = guildBuffs(guild);
  return {
    level,
    xp,
    xpToNext,
    maxLevel: GUILD_MAX_LEVEL,
    maxMembers: guildMaxMembers(level),
    upgrades,
    buffs,
    upgradeDefs: GUILD_UPGRADES.map((def) => ({
      ...def,
      level: upgrades[def.id as keyof GuildUpgrades] || 0,
      cost: upgradeCost(def, upgrades[def.id as keyof GuildUpgrades] || 0),
    })),
  };
}
