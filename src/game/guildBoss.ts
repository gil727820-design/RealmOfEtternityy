/**
 * BOSS DE GUILDA 🐲 — raid semanal compartilhado entre os membros.
 *
 * Conteúdo endgame de guilda: a guilda inteira ataca o MESMO boss (HP
 * compartilhado) durante a semana. Cada membro tem 1 ataque grátis por dia
 * (e pode comprar ataques extras com ouro). O dano causado conta pontos de
 * contribuição; ao derrotar o boss, todos recebem recompensas proporcionais
 * ao dano + bônus de guilda (XP e ouro no banco).
 *
 * O estado fica na própria guilda (`guild.guildBoss`):
 *   { weekKey, bossHp, bossMaxHp, hits: { [charId]: { dmg, at } }, defeatedAt, rewardsGiven }
 * Reset semanal automático (novo weekKey).
 */

/** Dias da semana de batalha do boss de guilda. */
export const GUILD_BOSS_RESET_DAYS = 7;
/** Ataques grátis por membro por dia. */
export const GUILD_BOSS_FREE_ATTACKS_PER_DAY = 1;
/** Custo (ouro) de um ataque extra além do grátis diário. */
export const GUILD_BOSS_EXTRA_ATTACK_COST = 25_000;
/** Dano máximo por ataque (% do HP total do boss) — anti-hitkill. */
export const GUILD_BOSS_MAX_HIT_PCT = 0.05;

/** HP do boss de guilda — escala com o nível e número de membros. */
export function guildBossMaxHp(guild: any): number {
  const level = Math.max(1, Math.floor(Number(guild?.level) || 1));
  const members = Math.max(1, Array.isArray(guild?.members) ? guild.members.length : 1);
  return 1_000_000 * level + 100_000 * members;
}

/** Dano de um ataque (baseado no poder do personagem). */
export function guildBossAttackDamage(power: number): number {
  return Math.max(50, Math.round((Number(power) || 0) * 1.2));
}

/** Chave da semana (YYYY-MM-DD da segunda-feira) para reset semanal. */
export function guildBossWeekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Estado do boss de guilda (cria/reseta se a semana mudou). */
export function ensureGuildBoss(guild: any, now: Date = new Date()) {
  const weekKey = guildBossWeekKey(now);
  const cur = guild?.guildBoss;
  if (cur && cur.weekKey === weekKey) return cur;
  const maxHp = guildBossMaxHp(guild);
  return {
    weekKey,
    bossMaxHp: maxHp,
    bossHp: maxHp,
    hits: {} as Record<string, { dmg: number; at: string }>,
    defeatedAt: null as string | null,
    rewardsGiven: false,
  };
}

/** Ataques usados hoje por um membro (grátis + comprados). */
export function guildBossHitsToday(boss: any, characterId: string, now: Date = new Date()) {
  const hits = boss?.hits?.[characterId] ? [boss.hits[characterId]] : [];
  const todayKey = now.toISOString().slice(0, 10);
  return hits.filter((h: any) => (h.at || "").slice(0, 10) === todayKey).length;
}

/** Pode atacar de graça hoje? */
export function guildBossCanFreeAttack(boss: any, characterId: string, now: Date = new Date()): boolean {
  return guildBossHitsToday(boss, characterId, now) < GUILD_BOSS_FREE_ATTACKS_PER_DAY;
}

/**
 * Aplica um ataque ao boss. Retorna o novo estado + dano, ou { error }.
 * `extra` = true se o jogador está comprando um ataque extra.
 */
export function applyGuildBossAttack(
  boss: any,
  characterId: string,
  power: number,
  extra = false,
  now: Date = new Date()
): { boss: any; dmg: number } | { error: string } {
  if (boss.bossHp <= 0) return { error: "O Boss de Guilda já foi derrotado esta semana!" };
  const usedToday = guildBossHitsToday(boss, characterId, now);
  if (!extra && usedToday >= GUILD_BOSS_FREE_ATTACKS_PER_DAY) {
    return { error: "Ataque grátis de hoje já usado! Compre um ataque extra." };
  }
  let dmg = guildBossAttackDamage(power);
  const maxHit = Math.max(1, Math.floor(boss.bossMaxHp * GUILD_BOSS_MAX_HIT_PCT));
  if (dmg > maxHit) dmg = maxHit;
  const prev = boss.hits?.[characterId] || { dmg: 0, at: now.toISOString() };
  const bossHp = Math.max(0, boss.bossHp - dmg);
  const defeated = bossHp <= 0;
  return {
    boss: {
      ...boss,
      bossHp,
      hits: { ...(boss.hits || {}), [characterId]: { dmg: (prev.dmg || 0) + dmg, at: now.toISOString() } },
      defeatedAt: defeated ? (boss.defeatedAt ?? now.toISOString()) : boss.defeatedAt,
    },
    dmg,
  };
}

/** Recompensa individual (proporcional ao dano) + ouro no banco da guilda. */
export function guildBossRewardFor(
  guild: any,
  characterId: string,
  totalDamage: number
): { gold: number; crystals: number; xp: number } {
  const boss = guild?.guildBoss;
  const myDmg = Number(boss?.hits?.[characterId]?.dmg) || 0;
  const total = Math.max(1, totalDamage);
  const share = myDmg / total;
  const level = Math.max(1, Math.floor(Number(guild?.level) || 1));
  return {
    gold: Math.floor(60_000 * level * share),
    crystals: Math.floor(30 * share),
    xp: Math.floor(20_000 * share),
  };
}

/** Total de dano causado ao boss (para os rankings). */
export function guildBossTotalDamage(boss: any): number {
  return Math.max(0, boss.bossMaxHp - boss.bossHp);
}

/** Ranking de contribuição dos membros. */
export function guildBossRanking(boss: any): Array<{ characterId: string; dmg: number }> {
  const hits = boss?.hits || {};
  return Object.entries(hits)
    .map(([characterId, h]: [string, any]) => ({ characterId, dmg: Number(h.dmg) || 0 }))
    .sort((a, b) => b.dmg - a.dmg);
}
