/**
 * Formata números grandes com prefixos K / M / B / T (milhar, milhão,
 * bilhão, trilhão):
 *   999 → "999" · 1.500 → "1.5K" · 2.300.000 → "2.3M"
 *   4.500.000.000 → "4.5B" · 7.200.000.000.000 → "7.2T"
 * Valores abaixo de 1.000 aparecem inteiros.
 */
export function fmtNum(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 1e12) return trim((v / 1e12).toFixed(1)) + "T";
  if (v >= 1e9) return trim((v / 1e9).toFixed(1)) + "B";
  if (v >= 1e6) return trim((v / 1e6).toFixed(1)) + "M";
  if (v >= 1e3) return trim((v / 1e3).toFixed(1)) + "K";
  return String(Math.floor(v));
}

function trim(s: string): string {
  return s.replace(/\.0$/, "");
}
