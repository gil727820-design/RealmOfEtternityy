/*
 * Helper de data/hora para eventos agendados (Loja Fantasma / Boss Mundial).
 *
 * O servidor calcula as janelas pela HORA DELE (`serverSettings` + horários
 * "HH:MM"). Para o jogador não depender do relógio do próprio aparelho, o
 * cliente recebe `serverTime` (ISO) e `serverOffsetMinutes` e usa a DIFERENÇA
 * (skew) entre o relógio local e o do servidor — assim a contagem regressiva
 * não "atrasa/adianta" se o relógio do celular estiver errado.
 */

/** Desvio entre o relógio local e o servidor (ms). serverIso = ISO vindo da API. */
export function computeClockSkew(serverIso: string | null | undefined, now = Date.now()): number {
  if (!serverIso) return 0;
  const serverTs = new Date(serverIso).getTime();
  if (Number.isNaN(serverTs)) return 0;
  return now - serverTs;
}

/** Formata um ISO como data/hora LOCAL do jogador (dd/mm às HH:MM). */
export function fmtLocalDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const isPt = locale?.toLowerCase().startsWith("pt");
  const isEn = locale?.toLowerCase().startsWith("en");
  const isEs = locale?.toLowerCase().startsWith("es");
  // Ordem dia/mês difere por idioma: dd/mm (pt/es) ou mm/dd (en).
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hour = pad(d.getHours());
  const min = pad(d.getMinutes());
  const datePart = isEn ? `${month}/${day}` : `${day}/${month}`;
  const weekday = d.toLocaleDateString(
    isPt ? "pt-BR" : isEs ? "es-ES" : "en-US",
    { weekday: "short" }
  );
  return `${weekday}, ${datePart} ${hour}:${min}`;
}

/** Horário "HH:MM" do servidor convertido para o fuso LOCAL do jogador. */
export function fmtServerTimeLocal(hhmm: string, serverOffsetMinutes: number, locale: string): string {
  if (!hhmm) return "—";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  // Offset atual do cliente (em minutos, leste de UTC é positivo).
  const localOffset = -new Date().getTimezoneOffset();
  // Converte o horário "server HH:MM" para o relógio local somando a diferença
  // de fusos (sem mexer em data — aproximação diária, suficiente p/ exibição).
  let localMinutes = h * 60 + min + (localOffset - serverOffsetMinutes);
  localMinutes = ((localMinutes % 1440) + 1440) % 1440;
  const lh = Math.floor(localMinutes / 60);
  const lmin = localMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(lh)}:${pad(lmin)}`;
}
