/**
 * TEMPORADA da Arena (PvP) — ciclo de 14 dias com recompensas de fim de temporada.
 *
 * A cada temporada o jogador tem um rating "melhor da temporada" (`pvpSeasonBest`),
 * e ao final recebe recompensas conforme a liga máxima alcançada. O reset do
 * rating acontece no INÍCIO da nova temporada (ao lutar), mantendo o histórico.
 *
 * Persistência no personagem:
 *  - `pvpSeasonBest`: { seasonId, rating } — melhor rating da temporada atual.
 *  - `pvpSeasonClaimed`: id da temporada cujas recompensas já foram coletadas.
 */

/** Duração de cada temporada em dias. */
export const PVP_SEASON_DAYS = 14;

/** Época de referência para o cálculo das temporadas (ISO). */
const SEASON_EPOCH = new Date("2026-01-05T00:00:00Z").getTime();

export interface PvpSeasonInfo {
  seasonId: number;
  startsAt: string;
  endsAt: string;
  daysLeft: number;
}

/** Calcula a temporada atual (id, início, fim e dias restantes). */
export function pvpSeasonInfo(now: Date = new Date()): PvpSeasonInfo {
  const t = now.getTime();
  const elapsed = Math.max(0, t - SEASON_EPOCH);
  const seasonId = Math.floor(elapsed / (PVP_SEASON_DAYS * 86400000));
  const startsAt = new Date(SEASON_EPOCH + seasonId * PVP_SEASON_DAYS * 86400000);
  const endsAt = new Date(startsAt.getTime() + PVP_SEASON_DAYS * 86400000);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - t) / 86400000));
  return {
    seasonId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    daysLeft,
  };
}

/** Lê o melhor rating registrado do personagem na temporada atual. */
export function seasonBest(char: any, seasonId: number): number {
  const best = char?.pvpSeasonBest;
  if (best && typeof best === "object" && Number(best.seasonId) === seasonId) {
    return Math.max(0, Number(best.rating) || 0);
  }
  // Sem registro, usa o rating atual como referência inicial.
  return Math.max(0, Number(char?.pvpRating) || 0);
}

/** Atualiza o melhor rating da temporada se o atual for maior. Retorna patch. */
export function trackSeasonBest(char: any, seasonId: number) {
  const current = Math.max(0, Number(char?.pvpRating) || 0);
  const prev = seasonBest(char, seasonId);
  if (current > prev) {
    return { pvpSeasonBest: { seasonId, rating: current } };
  }
  return {};
}

/** Liga alcançada (para recompensas). Reutiliza PVP_LEAGUES do constants. */
import { PVP_LEAGUES } from "./constants";

/** Recompensas por liga máxima da temporada. */
export function seasonRewardsFor(rating: number) {
  let league: (typeof PVP_LEAGUES)[number] = PVP_LEAGUES[0];
  for (const l of PVP_LEAGUES) {
    if (rating >= l.minRating) league = l;
  }
  const tiers: Record<string, { gold: number; pvpCoins: number; crystals: number }> = {
    bronze: { gold: 1500, pvpCoins: 100, crystals: 10 },
    silver: { gold: 3000, pvpCoins: 250, crystals: 25 },
    gold: { gold: 6000, pvpCoins: 500, crystals: 50 },
    platinum: { gold: 12000, pvpCoins: 900, crystals: 90 },
    diamond: { gold: 20000, pvpCoins: 1500, crystals: 140 },
    master: { gold: 35000, pvpCoins: 2400, crystals: 220 },
    legend: { gold: 55000, pvpCoins: 3600, crystals: 320 },
    emperor: { gold: 90000, pvpCoins: 5000, crystals: 450 },
  };
  return { league: league.id, leagueName: `league.${league.id}`, ...(tiers[league.id] ?? tiers.bronze) };
}
