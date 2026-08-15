/*
 * Janelas diárias recorrentes (horários "HH:MM" + duração), calculadas pela
 * HORA DO SERVIDOR — usado pela Loja Fantasma e pelo Evento Global (Boss Mundial).
 *
 * Uma janela é "aberta" quando `agora` está dentro de [início, início + duração]
 * para um dos horários do dia, inclusive quando a duração atravessa a meia-noite
 * (ex.: abre 23:00 por 2h → ainda aberta às 00:30).
 */

export interface DailyWindowStatus {
  open: boolean;
  /** ISO do início da janela atual (null se fechada). */
  startsAt: string | null;
  /** ISO do fim da janela atual (null se fechada). */
  endsAt: string | null;
  /** ISO da próxima abertura (null se sem agendamento). */
  nextOpening: string | null;
  /** Milissegundos até fechar (null se fechada). */
  closingInMs: number | null;
  /** Horários agendados (normalizados, ordenados). */
  schedule: string[];
}

/** Valida um horário "HH:MM". */
export function isValidScheduleTime(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/** Normaliza um horário válido para "HH:MM" (zero à esquerda). */
export function normalizeScheduleTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Data de hoje (fuso local do servidor) às HH:MM. */
function todayAt(hhmm: string, now: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Calcula a janela diária atual a partir da lista de horários + duração. */
export function dailyWindowStatus(
  schedule: string[],
  durationMinutes: number,
  now = new Date()
): DailyWindowStatus {
  const empty: DailyWindowStatus = {
    open: false,
    startsAt: null,
    endsAt: null,
    nextOpening: null,
    closingInMs: null,
    schedule: [],
  };

  const clean = (schedule || [])
    .filter(isValidScheduleTime)
    .map(normalizeScheduleTime)
    .sort();

  if (clean.length === 0) return { ...empty, schedule: clean };

  const durationMs = Math.max(1, Math.floor(Number(durationMinutes) || 60)) * 60_000;
  const time = now.getTime();

  for (const hhmm of clean) {
    const startMs = todayAt(hhmm, now).getTime();
    const endMs = startMs + durationMs;
    if (time >= startMs && time < endMs) {
      return {
        open: true,
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        nextOpening: null,
        closingInMs: Math.max(0, endMs - time),
        schedule: clean,
      };
    }
    // Janela que começou ontem e ainda está aberta hoje.
    const yStartMs = startMs - 24 * 3600_000;
    const yEndMs = yStartMs + durationMs;
    if (time >= yStartMs && time < yEndMs) {
      return {
        open: true,
        startsAt: new Date(yStartMs).toISOString(),
        endsAt: new Date(yEndMs).toISOString(),
        nextOpening: null,
        closingInMs: Math.max(0, yEndMs - time),
        schedule: clean,
      };
    }
  }

  let next: number | null = null;
  for (const hhmm of clean) {
    let startMs = todayAt(hhmm, now).getTime();
    if (startMs <= time) startMs += 24 * 3600_000;
    if (next === null || startMs < next) next = startMs;
  }

  return {
    open: false,
    startsAt: null,
    endsAt: null,
    nextOpening: next !== null ? new Date(next).toISOString() : null,
    closingInMs: null,
    schedule: clean,
  };
}
