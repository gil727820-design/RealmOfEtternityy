/**
 * Missões DIÁRIAS + SEMANAIS (reset automático).
 *
 * Diferente das missões de região (batelada que embaralha ao concluir), estas
 * têm objetivos fixos do dia/semana e resetam sozinhas pela data. O progresso
 * é guardado no personagem (`dailyMissions` / `weeklyMissions`), onde cada
 * missão tem `progress`/`target` e recompensa em ouro/cristais/moedas da torre.
 *
 * Contagem de progresso: as rotas que realizam a ação chamam
 * `jsonDb.updateCharacter(charId, trackDailyProgress(char, "type"))`.
 */

/** Recompensa base de uma missão diária (escala com o nível). */
export function dailyReward(level: number) {
  const lv = Math.max(1, Number(level) || 1);
  return {
    gold: 250 + lv * 15,
    crystals: 3 + Math.floor(lv / 10),
    towerCoins: 20 + lv * 2,
  };
}

/** Recompensa base de uma missão semanal (escala com o nível). */
export function weeklyReward(level: number) {
  const lv = Math.max(1, Number(level) || 1);
  return {
    gold: 1500 + lv * 80,
    crystals: 15 + Math.floor(lv / 8),
    towerCoins: 100 + lv * 10,
  };
}

export interface DailyMissionDef {
  id: string;
  target: number;
  /** Chave i18n do nome. */
  nameKey: string;
  /** Chave i18n da descrição. */
  descKey: string;
  icon: string;
}

/** Objetivos DIÁRIOS (resetam todo dia à meia-noite). */
export const DAILY_MISSION_DEFS: DailyMissionDef[] = [
  { id: "missions", target: 2, nameKey: "daily.missions", descKey: "daily.missions.desc", icon: "📜" },
  { id: "tower", target: 5, nameKey: "daily.tower", descKey: "daily.tower.desc", icon: "🗼" },
  { id: "pvp", target: 3, nameKey: "daily.pvp", descKey: "daily.pvp.desc", icon: "⚔️" },
  { id: "dungeon", target: 1, nameKey: "daily.dungeon", descKey: "daily.dungeon.desc", icon: "🕳️" },
  { id: "afk", target: 1, nameKey: "daily.afk", descKey: "daily.afk.desc", icon: "💤" },
  { id: "boss", target: 1, nameKey: "daily.boss", descKey: "daily.boss.desc", icon: "👹" },
];

/** Objetivos SEMANAIS (resetam na segunda-feira). */
export const WEEKLY_MISSION_DEFS: DailyMissionDef[] = [
  { id: "tower", target: 25, nameKey: "weekly.tower", descKey: "weekly.tower.desc", icon: "🗼" },
  { id: "pvp", target: 10, nameKey: "weekly.pvp", descKey: "weekly.pvp.desc", icon: "⚔️" },
  { id: "missions", target: 8, nameKey: "weekly.missions", descKey: "weekly.missions.desc", icon: "📜" },
  { id: "dungeon", target: 3, nameKey: "weekly.dungeon", descKey: "weekly.dungeon.desc", icon: "🕳️" },
  { id: "boss", target: 3, nameKey: "weekly.boss", descKey: "weekly.boss.desc", icon: "👹" },
];

/** Chave de data local YYYY-MM-DD. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Chave da semana (segunda-feira da semana atual) YYYY-MM-DD. */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return dateKey(d);
}

/** Tipo de missão usada no progresso (same ids nas duas listas). */
export type MissionKind = "missions" | "tower" | "pvp" | "dungeon" | "afk" | "boss";

/** Estrutura de progresso persistida no personagem. */
interface ProgressState {
  date: string;
  progress: Record<string, number>;
  claimed: string[];
  /** Bônus semanal já coletado nesta semana. */
  bonusClaimed?: boolean;
}

/** Gera o estado inicial vazio com a data de hoje. */
export function freshProgress(date: string): ProgressState {
  return { date, progress: {}, claimed: [] };
}

/** Lê o estado; se a data mudou, reseta. */
export function readProgress(char: any, field: "dailyMissions" | "weeklyMissions", key: string, now: Date = new Date()) {
  const raw = char?.[field];
  const st: ProgressState =
    raw && typeof raw === "object" && (raw as ProgressState).date === key
      ? (raw as ProgressState)
      : freshProgress(key);
  return st;
}

/**
 * Incrementa o progresso de um tipo de missão (diária + semanal ao mesmo tempo,
 * pois os dois têm os mesmos ids). Retorna o patch para updateCharacter.
 */
export function trackProgress(char: any, kind: MissionKind, amount = 1, now: Date = new Date()) {
  const dk = dateKey(now);
  const wk = weekKey(now);

  const daily = readProgress(char, "dailyMissions", dk, now);
  daily.progress[kind] = Math.min(999, (daily.progress[kind] || 0) + amount);
  const weekly = readProgress(char, "weeklyMissions", wk, now);
  weekly.progress[kind] = Math.min(999, (weekly.progress[kind] || 0) + amount);

  return {
    dailyMissions: daily,
    weeklyMissions: weekly,
  };
}

/** Estado consolidado para a UI (com definição + recompensa + concluída). */
export function missionStatus(def: DailyMissionDef, progress: number, claimed: boolean, reward: { gold: number; crystals: number; towerCoins: number }) {
  const done = progress >= def.target;
  return {
    ...def,
    progress: Math.min(progress, def.target),
    target: def.target,
    done,
    claimed,
    reward,
  };
}

/** Monta a lista de missões diárias com estado. */
export function dailyList(char: any, now: Date = new Date()) {
  const st = readProgress(char, "dailyMissions", dateKey(now), now);
  const lv = Number(char?.level) || 1;
  return DAILY_MISSION_DEFS.map((d) =>
    missionStatus(d, st.progress[d.id] || 0, st.claimed.includes(d.id), dailyReward(lv))
  );
}

/** Monta a lista de missões semanais com estado. */
export function weeklyList(char: any, now: Date = new Date()) {
  const st = readProgress(char, "weeklyMissions", weekKey(now), now);
  const lv = Number(char?.level) || 1;
  return WEEKLY_MISSION_DEFS.map((d) =>
    missionStatus(d, st.progress[d.id] || 0, st.claimed.includes(d.id), weeklyReward(lv))
  );
}

/**
 * BÔNUS SEMANAL 🏆 — completa as 5 semanais da semana para liberar.
 * Recompensa especial (diamantes + moedas da torre) + marca `weeklyBonusClaimed`
 * no estado da semana (para não coletar 2x).
 */
export function weeklyBonusReward(level: number) {
  const lv = Math.max(1, Number(level) || 1);
  return {
    diamonds: 20 + Math.floor(lv / 5),
    towerCoins: 200 + lv * 20,
    gold: 3000 + lv * 150,
  };
}

/** True se todas as missões semanais da semana foram concluídas E coletadas. */
export function weeklyAllDone(char: any, now: Date = new Date()) {
  const st = readProgress(char, "weeklyMissions", weekKey(now), now);
  return WEEKLY_MISSION_DEFS.every((d) => (st.progress[d.id] || 0) >= d.target && st.claimed.includes(d.id));
}

/** Coleta o bônus semanal (1x por semana). Devolve patch + recompensa ou erro. */
export function claimWeeklyBonus(char: any, now: Date = new Date()) {
  const wk = weekKey(now);
  const st = readProgress(char, "weeklyMissions", wk, now);
  if (!weeklyAllDone(char, now)) {
    return { error: "Conclua e colete todas as missões semanais primeiro" };
  }
  if (st.bonusClaimed) return { error: "Bônus da semana já coletado" };
  st.bonusClaimed = true;
  const reward = weeklyBonusReward(Number(char?.level) || 1);
  return { patch: { weeklyMissions: st }, reward };
}

/** Coleta a recompensa de uma missão: marca como coletada e devolve o patch + valor. */
export function claimMission(char: any, kind: MissionKind, list: "daily" | "weekly", now: Date = new Date()) {
  const field = list === "daily" ? "dailyMissions" : "weeklyMissions";
  const key = list === "daily" ? dateKey(now) : weekKey(now);
  const st = readProgress(char, field, key, now);
  const def = (list === "daily" ? DAILY_MISSION_DEFS : WEEKLY_MISSION_DEFS).find((d) => d.id === kind);
  if (!def) return { error: "Missão não encontrada" };
  if (st.claimed.includes(kind)) return { error: "Recompensa já coletada" };
  if ((st.progress[kind] || 0) < def.target) return { error: "Missão ainda não concluída" };

  st.claimed.push(kind);
  const reward = list === "daily" ? dailyReward(Number(char?.level) || 1) : weeklyReward(Number(char?.level) || 1);
  return { patch: { [field]: st }, reward };
}
