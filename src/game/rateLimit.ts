/**
 * Anti-cheat básico: limitador de frequência de ações por personagem (em memória).
 *
 * Bloqueia e LOGA (admin_logs, kind "anticheat") quando um personagem executa
 * ações importantes rápido demais — impossível de forma legítima. Ex.: vencer
 * 20 batalhas da torre em menos de 30s (cada batalha tem rounds e animações).
 *
 * Persistência em memória (Map) — suficiente para o servidor single-instance
 * deste projeto; o log persistido permite o admin revisar no painel.
 */

/** Janela de observação (ms). */
const WINDOW_MS = 30_000;

/** Máximo de vitórias/coletas permitidas dentro da janela. */
const MAX_ACTIONS = 12;

/** Máximo de tentativas bloqueadas consecutivas antes de um cooldown maior. */
const MAX_BLOCKED_BEFORE_COOLDOWN = 3;

interface Bucket {
  /** Timestamps das ações (em ordem). */
  times: number[];
  /** Quantas vezes foi bloqueado em sequência. */
  blockedStreak: number;
  /** Até quando o personagem fica em cooldown (0 = sem cooldown). */
  until: number;
}

const buckets = new Map<string, Bucket>();

/** Executa a ação se dentro do limite; senão retorna false (e loga). */
export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  log: (msg: string) => void = () => {}
): boolean {
  let b = buckets.get(key);
  if (!b) {
    b = { times: [], blockedStreak: 0, until: 0 };
    buckets.set(key, b);
  }

  // Em cooldown (após muitos bloqueios seguidos)?
  if (b.until > now) {
    log(`[anticheat] ${key} em cooldown até ${new Date(b.until).toISOString()} (bloqueios repetidos).`);
    return false;
  }

  // Remove ações fora da janela.
  b.times = b.times.filter((t) => now - t < WINDOW_MS);

  if (b.times.length >= MAX_ACTIONS) {
    b.blockedStreak += 1;
    if (b.blockedStreak >= MAX_BLOCKED_BEFORE_COOLDOWN) {
      b.until = now + 5 * 60_000; // 5 min de cooldown após 3 bloqueios seguidos
      b.blockedStreak = 0;
      log(`[anticheat] ${key} bloqueado por 5min (${MAX_ACTIONS}+ ações em ${WINDOW_MS / 1000}s).`);
    } else {
      log(`[anticheat] ${key} bloqueado (mais de ${MAX_ACTIONS} ações em ${WINDOW_MS / 1000}s).`);
    }
    return false;
  }

  // Ação aceita.
  b.times.push(now);
  b.blockedStreak = Math.max(0, b.blockedStreak - 1);
  return true;
}

/** Usado em testes para limpar o estado do limitador. */
export function resetRateLimits() {
  buckets.clear();
}
