/**
 * LOGIN DIÁRIO 📅 — recompensa por login consecutivo.
 *
 * O personagem tem `dailyLogin: { lastClaim: ISO, streak: number }`.
 * - Se o último resgate foi HOJE → já resgatou hoje (streak mantido).
 * - Se foi ONTEM → streak continua (+1).
 * - Se foi antes de ontem → streak reinicia em 1.
 *
 * As recompensas seguem um ciclo de 7 dias (dia 7 = bônus grande). No dia 7
 * o ciclo reinicia. Tudo é calculado por data local do servidor (dia do mês),
 * sem depender de timers — o servidor valida a data ao resgatar (anti-cheat).
 */

export interface DailyLoginState {
  lastClaim?: string;
  streak?: number;
}

export interface DailyReward {
  day: number; // 1..7
  icon: string;
  gold?: number;
  diamonds?: number;
  crystals?: number;
  energy?: number;
  itemTemplateId?: number;
  itemNameKey?: string;
  itemIcon?: string;
}

/** Ciclo de 7 dias de recompensas (dia 7 = bônus grande). Generoso! */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, icon: "🪙", gold: 800 },
  { day: 2, icon: "⚡", energy: 40 },
  { day: 3, icon: "🪙", gold: 1500 },
  { day: 4, icon: "🔮", crystals: 8 },
  { day: 5, icon: "🪙", gold: 3000 },
  { day: 6, icon: "💎", diamonds: 8 },
  { day: 7, icon: "🎁", gold: 8000, diamonds: 15, crystals: 15, energy: 60 },
];

/** Chave de "dia" local (YYYY-MM-DD) — o resgate só vale 1x por dia. */
export function dayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dia de ontem (YYYY-MM-DD). */
export function yesterdayKey(now: Date = new Date()): string {
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return dayKey(y);
}

/** Estado atual do login diário do personagem. */
export function dailyLoginState(char: any): DailyLoginState {
  const s = char?.dailyLogin;
  return s && typeof s === "object" ? (s as DailyLoginState) : {};
}

/**
 * Status para a UI: pode resgatar hoje? qual dia do ciclo? streak?
 * `rng`/`now` injetáveis para testes.
 */
export function dailyLoginStatus(
  char: any,
  now: Date = new Date()
): {
  canClaim: boolean;
  streak: number;
  nextDay: number;
  todayKey: string;
  rewards: DailyReward[];
} {
  const s = dailyLoginState(char);
  const last = s.lastClaim ? dayKey(new Date(s.lastClaim)) : "";
  const today = dayKey(now);
  const yesterday = yesterdayKey(now);

  let streak = Math.max(0, Math.floor(Number(s.streak) || 0));
  // Streak quebrou se o último resgate não foi ontem nem hoje.
  if (last && last !== today && last !== yesterday) streak = 0;

  const canClaim = last !== today;
  const nextDay = ((streak % 7) + 1);
  return { canClaim, streak, nextDay, todayKey: today, rewards: DAILY_REWARDS };
}

/** Próxima recompensa (dia do ciclo) a partir do streak atual. */
export function nextDailyReward(char: any, now: Date = new Date()): DailyReward {
  const status = dailyLoginStatus(char, now);
  const day = status.streak === 0 && !status.canClaim ? 1 : status.nextDay;
  return DAILY_REWARDS[(day - 1 + 7) % 7];
}

/**
 * Aplica o resgate do dia: devolve o patch para o personagem + recompensa
 * concedida. O servidor chama após validar canClaim (anti-cheat).
 */
export function applyDailyClaim(
  char: any,
  now: Date = new Date()
): { patch: any; reward: DailyReward; newStreak: number } {
  const status = dailyLoginStatus(char, now);
  if (!status.canClaim) {
    throw new Error("Recompensa já resgatada hoje");
  }
  const reward = DAILY_REWARDS[status.nextDay - 1] ?? DAILY_REWARDS[0];
  const newStreak = status.streak + 1;
  const patch: any = {
    dailyLogin: {
      lastClaim: now.toISOString(),
      streak: newStreak,
    },
  };
  if (reward.gold) patch.gold = (Number(char.gold) || 0) + reward.gold;
  if (reward.diamonds) patch.diamonds = (Number(char.diamonds) || 0) + reward.diamonds;
  if (reward.crystals) patch.crystals = (Number(char.crystals) || 0) + reward.crystals;
  if (reward.energy) {
    const maxE = Math.max(0, Number(char.maxEnergy) || 100);
    patch.energy = Math.min(maxE, (Number(char.energy) || 0) + reward.energy);
  }
  return { patch, reward, newStreak };
}
