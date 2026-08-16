/**
 * Integração da GUILDA com as atividades do jogo.
 *
 * Toda atividade relevante (missão, torre, PvP, masmorra, boss, AFK) dá XP
 * para a guilda do personagem. Este helper centraliza o fluxo: busca a guilda,
 * aplica o XP (via grantGuildXp) e persiste — as rotas só chamam uma função.
 */

import jsonDb from "@/db/repo";
import { grantGuildXp, guildLevelStatus, guildBuffs } from "./guildLevels";

export type GuildActivityKind = "mission" | "tower" | "pvp" | "dungeon" | "boss" | "afk";

/**
 * Concede XP de guilda ao personagem após uma atividade.
 * Retorna info de level-up (para a UI avisar o líder) ou null se não há guilda.
 */
export async function grantGuildActivityXp(characterId: string, kind: GuildActivityKind) {
  try {
    const guild = await jsonDb.findGuildByMemberId(characterId);
    if (!guild) return null;
    const result = grantGuildXp(guild, kind);
    await jsonDb.updateGuild(String(guild.id), result.patch);
    return {
      guildId: String(guild.id),
      guildName: guild.name,
      gained: result.gain,
      leveledUp: result.leveledUp,
      newLevel: result.patch.level,
    };
  } catch {
    // Nunca deixa uma falha de guilda quebrar a atividade principal.
    return null;
  }
}

/** Status da guilda do personagem (para a UI), ou null se não tem guilda. */
export async function guildStatusFor(characterId: string) {
  const guild = await jsonDb.findGuildByMemberId(characterId);
  if (!guild) return null;
  return guildLevelStatus(guild);
}

/**
 * Sincroniza o snapshot de buffs da guilda no personagem.
 * Chamado ao entrar na guilda e ao melhorar a guilda (para todos os membros).
 */
export async function syncGuildBuffsToCharacter(characterId: string, guild: any) {
  const buffs = guildBuffs(guild);
  await jsonDb.updateCharacter(characterId, { guildBuffs: buffs });
  return buffs;
}

/** Atualiza o snapshot de buffs de TODOS os membros de uma guilda. */
export async function syncGuildBuffsToAllMembers(guild: any) {
  const members = Array.isArray(guild.members) ? guild.members : [];
  const buffs = guildBuffs(guild);
  for (const m of members) {
    if (!m?.id) continue;
    await jsonDb.updateCharacter(String(m.id), { guildBuffs: buffs });
  }
  return buffs;
}
