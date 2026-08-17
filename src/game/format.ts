/**
 * Formata números grandes com prefixos K / M / B / T / QA / QD (milhar,
 * milhão, bilhão, trilhão, quadrilhão, quintilhão):
 *   999 → "999" · 1.500 → "1.5K" · 2.300.000 → "2.3M"
 *   4.500.000.000 → "4.5B" · 7.200.000.000.000 → "7.2T"
 *   9.000.000.000.000.000 → "9QA" · 2.500.000.000.000.000.000 → "2.5QD"
 * Valores abaixo de 1.000 aparecem inteiros.
 */
export function fmtNum(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 1e18) return trim((v / 1e18).toFixed(1)) + "QD";
  if (v >= 1e15) return trim((v / 1e15).toFixed(1)) + "QA";
  if (v >= 1e12) return trim((v / 1e12).toFixed(1)) + "T";
  if (v >= 1e9) return trim((v / 1e9).toFixed(1)) + "B";
  if (v >= 1e6) return trim((v / 1e6).toFixed(1)) + "M";
  if (v >= 1e3) return trim((v / 1e3).toFixed(1)) + "K";
  return String(Math.floor(v));
}

function trim(s: string): string {
  return s.replace(/\.0$/, "");
}

/** Sufixos aceitos na entrada (aceita maiúsculas/minúsculas: 1k, 1K, 2.5m, 1QA...). */
const ABBREV_SUFFIXES: Array<{ suffix: string; value: number }> = [
  { suffix: "qd", value: 1e18 },
  { suffix: "qa", value: 1e15 },
  { suffix: "t", value: 1e12 },
  { suffix: "b", value: 1e9 },
  { suffix: "m", value: 1e6 },
  { suffix: "k", value: 1e3 },
];

/**
 * Converte um valor digitado (número ou texto com sufixo) em número inteiro.
 *   "500" → 500 · "1K" → 1.000 · "2.5M" → 2.500.000 · "1B" → 1.000.000.000
 *   "2T" → 2e12 · "2QA" → 2e15 · "2QD" → 2e18
 * Retorna null se a entrada for inválida.
 */
export function parseAbbrev(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.floor(input) : null;
  }
  const raw = String(input).trim().replace(/\s+/g, "").toLowerCase();
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:[.,]\d+)?)([a-z]+)?$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  const suffix = m[2] || "";
  if (!suffix) return Math.floor(num);
  const ab = ABBREV_SUFFIXES.find((a) => a.suffix === suffix);
  if (!ab) return null;
  return Math.floor(num * ab.value);
}
