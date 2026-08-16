/**
 * TEMPORADA GLOBAL 🏆 — ciclo de 30 dias com pontos de temporada.
 *
 * Diferente da temporada do PvP (só rating da arena), esta é uma temporada
 * GLOBAL: TODAS as atividades do jogo dão pontos de temporada:
 *   - missão concluída: +10
 *   - andar da torre: +5
 *   - vitória no PvP: +12
 *   - masmorra coletada: +15
 *   - boss regional derrotado: +20
 *   - ataque ao Boss Mundial: +8
 *   - guerra de guilda (ataque/defesa): +10
 *   - login diário: +5
 *
 * Os pontos ficam no personagem (`seasonPoints` + `seasonId`). O ranking
 * sazonal lista os jogadores pelos pontos da temporada ATUAL e, ao final,
 * os melhores recebem recompensas (ouro/cristais/título).
 *
 * A lógica é pura (src/game/) — as rotas da API só aplicam os patches.
 */

/** Duração de cada temporada em dias. */
export const SEASON_DAYS = 30;
/** Época de referência para o cálculo das temporadas (ISO). */
const SEASON_EPOCH = new Date("2026-08-01T00:00:00Z").getTime();

export interface SeasonInfo {
  seasonId: number;
  startsAt: string;
  endsAt: string;
  daysLeft: number;
}

/** Calcula a temporada atual (id, início, fim e dias restantes). */
export function seasonInfo(now: Date = new Date()): SeasonInfo {
  const t = now.getTime();
  const elapsed = Math.max(0, t - SEASON_EPOCH);
  const seasonId = Math.floor(elapsed / (SEASON_DAYS * 86400000));
  const startsAt = new Date(SEASON_EPOCH + seasonId * SEASON_DAYS * 86400000);
  const endsAt = new Date(startsAt.getTime() + SEASON_DAYS * 86400000);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - t) / 86400000));
  return {
    seasonId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    daysLeft,
  };
}

/** Pontos ganhos por tipo de atividade. */
export function seasonPointsFor(kind: "mission" | "tower" | "pvp" | "dungeon" | "boss" | "worldboss" | "war" | "daily"): number {
  switch (kind) {
    case "mission": return 10;
    case "tower": return 5;
    case "pvp": return 12;
    case "dungeon": return 15;
    case "boss": return 20;
    case "worldboss": return 8;
    case "war": return 10;
    case "daily": return 5;
    default: return 5;
  }
}

/** Pontos de temporada do personagem (só conta se for da temporada atual). */
export function seasonPoints(char: any, seasonId: number): number {
  if (Number(char?.seasonId) !== seasonId) return 0;
  return Math.max(0, Math.floor(Number(char?.seasonPoints) || 0));
}

/** Concede pontos de temporada (reseta se a temporada mudou). Retorna patch. */
export function grantSeasonPoints(
  char: any,
  seasonId: number,
  kind: "mission" | "tower" | "pvp" | "dungeon" | "boss" | "worldboss" | "war" | "daily"
): { seasonId: number; seasonPoints: number } {
  const gain = seasonPointsFor(kind);
  if (Number(char?.seasonId) !== seasonId) {
    // Nova temporada: começa do zero.
    return { seasonId, seasonPoints: gain };
  }
  return { seasonId, seasonPoints: (Number(char?.seasonPoints) || 0) + gain };
}

/** Marcos de recompensa da temporada (pontos acumulados → recompensa). */
export const SEASON_MILESTONES = [
  { points: 100, gold: 10_000, crystals: 25 },
  { points: 250, gold: 25_000, crystals: 60 },
  { points: 500, gold: 50_000, crystals: 120 },
  { points: 900, gold: 90_000, crystals: 220 },
  { points: 1400, gold: 150_000, crystals: 400 },
] as const;

/** Recompensa do próximo marco ainda não alcançado (ou null se todos feitos). */
export function nextSeasonMilestone(char: any, seasonId: number) {
  const pts = seasonPoints(char, seasonId);
  for (const m of SEASON_MILESTONES) {
    if (pts < m.points) return m;
  }
  return null;
}

/** Recompensas de fim de temporada por posição no ranking. */
export function seasonRankReward(position: number): { gold: number; crystals: number; titleKey: string | null } {
  if (position === 1) return { gold: 500_000, crystals: 1_000, titleKey: "season.title1" };
  if (position === 2) return { gold: 300_000, crystals: 600, titleKey: "season.title2" };
  if (position === 3) return { gold: 200_000, crystals: 400, titleKey: "season.title3" };
  if (position <= 10) return { gold: 100_000, crystals: 250, titleKey: null };
  if (position <= 50) return { gold: 40_000, crystals: 100, titleKey: null };
  return { gold: 10_000, crystals: 30, titleKey: null };
}

/** Rótulo da temporada: "Temporada 3". */
export function seasonLabel(seasonId: number): string {
  return String(Math.max(1, Math.floor(Number(seasonId) || 0) + 1));
}

/**
 * Patch pronto para espalhar no updateCharacter de qualquer rota de atividade:
 * concede pontos da temporada ATUAL (reseta se a temporada mudou).
 */
export function seasonPatch(
  char: any,
  kind: "mission" | "tower" | "pvp" | "dungeon" | "boss" | "worldboss" | "war" | "daily",
  now: Date = new Date()
): { seasonId: number; seasonPoints: number } {
  return grantSeasonPoints(char, seasonInfo(now).seasonId, kind);
}
