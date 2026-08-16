/**
 * GUERRA DE GUILDAS ⚔️ — conflito entre duas guildas com fortalezas.
 *
 * Fluxo:
 *  1. O líder/oficial declara guerra contra outra guilda pagando um PRÊMIO
 *     (ouro do banco da guilda). A guerra dura 24h.
 *  2. Durante a guerra, MEMBROS atacam a fortaleza inimiga (cooldown por
 *     membro) causando dano baseado no poder do personagem, e defendem a
 *     própria fortaleza (repara o dano recebido).
 *  3. Ao fim (ou se uma fortaleza chegar a 0), resolve: a guilda com mais
 *     dano líquido vence e leva o prêmio em dobro + XP de guilda + pontos
 *     de guerra (usados nos rankings).
 *
 * O estado da guerra é espelhado nas DUAS guildas (`guild.war`) e mantido
 * sincronizado a cada ação — a resolução usa o lado acessado e limpa os dois.
 */

export const WAR_DURATION_HOURS = 24;
/** Cooldown entre ataques/defesas de um mesmo membro. */
export const WAR_ACTION_COOLDOWN_MS = 20 * 60 * 1000;
/** Nível mínimo da guilda para declarar guerra. */
export const WAR_DECLARE_MIN_GUILD_LEVEL = 3;
/** Cooldown da guilda para declarar outra guerra após o fim de uma. */
export const WAR_DECLARE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** Prêmio (ouro do banco) para declarar guerra — escala com o nível da guilda. */
export function warDeclareCost(guildLevel: number): number {
  return 10_000 + Math.max(0, Math.floor(Number(guildLevel) || 1)) * 3_000;
}

/** HP da fortaleza de uma guilda — escala com o nível. */
export function fortressHp(guildLevel: number): number {
  return 20_000 + Math.max(0, Math.floor(Number(guildLevel) || 1)) * 5_000;
}

/** Dano de um ataque — baseado no poder do personagem. */
export function warAttackDamage(power: number): number {
  return Math.max(60, Math.round((Number(power) || 0) * 0.8));
}

/** Reparo de uma defesa — baseado no poder do personagem. */
export function warDefendHeal(power: number): number {
  return Math.max(50, Math.round((Number(power) || 0) * 0.6));
}

export interface GuildWar {
  enemyId: string;
  enemyName: string;
  startedAt: string;
  endsAt: string;
  declaredBy: string;
  /** Dano causado POR ESTA guilda na fortaleza inimiga. */
  dmgDealt: number;
  /** Dano recebido DA fortaleza inimiga (ataques deles em nós). */
  dmgTaken: number;
  /** Reparos feitos pela própria guilda (reduz o dano recebido). */
  repaired: number;
  participants: { characterId: string; name: string; dmg: number }[];
  cooldowns: Record<string, string>;
  resolved?: boolean;
  resolvedAt?: string;
}

/** A guerra ativa da guilda, ou null se não há (ou já expirou). */
export function activeWar(guild: any): GuildWar | null {
  const w = guild?.war;
  if (!w || !w.enemyId) return null;
  if (w.resolved) return null;
  if (new Date(w.endsAt).getTime() <= Date.now()) return null;
  return w as GuildWar;
}

/** HP atual da fortaleza (HP base − dano recebido + reparos). */
export function fortressHpCurrent(guild: any): number {
  const base = fortressHp(Number(guild?.level) || 1);
  const w = guild?.war as GuildWar | undefined;
  if (!w) return base;
  return Math.max(0, base - (w.dmgTaken || 0) + (w.repaired || 0));
}

/** Tempo restante da guerra (ms), ou 0. */
export function warTimeLeftMs(guild: any): number {
  const w = guild?.war as GuildWar | undefined;
  if (!w) return 0;
  return Math.max(0, new Date(w.endsAt).getTime() - Date.now());
}

/** Verifica se o membro pode agir (fora do cooldown). */
export function warCanAct(guild: any, characterId: string, now: Date = new Date()): boolean {
  const w = guild?.war as GuildWar | undefined;
  if (!w) return false;
  const last = w.cooldowns?.[characterId];
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= WAR_ACTION_COOLDOWN_MS;
}

/** Aplica um ataque (lado do atacante): retorna o novo estado war + dano. */
export function applyWarAttack(
  guild: any,
  characterId: string,
  name: string,
  power: number,
  now: Date = new Date()
): { war: GuildWar; dmg: number } | { error: string } {
  const w = activeWar(guild);
  if (!w) return { error: "Não há guerra ativa" };
  if (!warCanAct(guild, characterId, now)) {
    return { error: "Aguarde o cooldown para atacar novamente" };
  }
  const dmg = warAttackDamage(power);
  const participants = [...(w.participants || [])];
  const idx = participants.findIndex((p) => p.characterId === characterId);
  if (idx >= 0) participants[idx] = { ...participants[idx], dmg: (participants[idx].dmg || 0) + dmg };
  else participants.push({ characterId, name, dmg });
  const war: GuildWar = {
    ...w,
    dmgDealt: (w.dmgDealt || 0) + dmg,
    participants,
    cooldowns: { ...(w.cooldowns || {}), [characterId]: now.toISOString() },
  };
  return { war, dmg };
}

/** Aplica uma defesa (repara a própria fortaleza). */
export function applyWarDefend(
  guild: any,
  characterId: string,
  name: string,
  power: number,
  now: Date = new Date()
): { war: GuildWar; heal: number } | { error: string } {
  const w = activeWar(guild);
  if (!w) return { error: "Não há guerra ativa" };
  if (!warCanAct(guild, characterId, now)) {
    return { error: "Aguarde o cooldown para defender novamente" };
  }
  const heal = warDefendHeal(power);
  const participants = [...(w.participants || [])];
  const idx = participants.findIndex((p) => p.characterId === characterId);
  if (idx >= 0) participants[idx] = { ...participants[idx], dmg: (participants[idx].dmg || 0) + Math.round(heal * 0.5) };
  else participants.push({ characterId, name, dmg: Math.round(heal * 0.5) });
  const war: GuildWar = {
    ...w,
    repaired: (w.repaired || 0) + heal,
    participants,
    cooldowns: { ...(w.cooldowns || {}), [characterId]: now.toISOString() },
  };
  return { war, heal };
}

/**
 * Resolve a guerra entre duas guildas (chamado quando a guerra expirou ou uma
 * fortaleza caiu). Compara o dano líquido: cada lado usa o próprio `dmgDealt`
 * vs o `dmgDealt` do inimigo (espelho). Retorna o resultado para a UI.
 */
export function resolveGuildWar(attacker: any, defender: any): {
  winnerId: string | null;
  winnerName: string | null;
  aDmg: number;
  bDmg: number;
  aRepaired: number;
  bRepaired: number;
  draw: boolean;
} {
  const aw = (attacker?.war || {}) as Partial<GuildWar>;
  const bw = (defender?.war || {}) as Partial<GuildWar>;
  const aDmg = Number(aw.dmgDealt) || 0;
  const bDmg = Number(bw.dmgDealt) || 0;
  const aRepaired = Number(aw.repaired) || 0;
  const bRepaired = Number(bw.repaired) || 0;
  const aNet = aDmg - bRepaired; // dano que A causou menos os reparos de B
  const bNet = bDmg - aRepaired;
  if (aNet === bNet) {
    return { winnerId: null, winnerName: null, aDmg, bDmg, aRepaired, bRepaired, draw: true };
  }
  const aWins = aNet > bNet;
  return {
    winnerId: aWins ? String(attacker.id) : String(defender.id),
    winnerName: aWins ? String(attacker.name) : String(defender.name),
    aDmg,
    bDmg,
    aRepaired,
    bRepaired,
    draw: false,
  };
}

/** Estado consolidado da guerra para a UI (do ponto de vista de uma guilda). */
export function guildWarStatus(guild: any) {
  const w = (guild?.war || {}) as Partial<GuildWar>;
  const active = activeWar(guild);
  if (!active) {
    return { active: false, war: null };
  }
  return {
    active: true,
    war: {
      enemyId: w.enemyId,
      enemyName: w.enemyName,
      startedAt: w.startedAt,
      endsAt: w.endsAt,
      timeLeftMs: warTimeLeftMs(guild),
      dmgDealt: Number(w.dmgDealt) || 0,
      dmgTaken: Number(w.dmgTaken) || 0,
      repaired: Number(w.repaired) || 0,
      fortressHp: fortressHpCurrent(guild),
      fortressMaxHp: fortressHp(Number(guild?.level) || 1),
      participants: (w.participants || []).slice().sort((a: any, b: any) => b.dmg - a.dmg),
      canAct: false, // preenchido pela rota com o personagem
      memberDmg: 0, // preenchido pela rota com o personagem
    },
  };
}
