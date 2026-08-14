// Cálculo centralizado de recompensas AFK.
// Usado tanto para a estimativa exibida na UI (rota character/[id])
// quanto para o valor realmente concedido ao resgatar (rota afk/claim),
// garantindo que os dois nunca divergem.

export const AFK_MAX_DURATION_SEC = 43200; // 12h

// Taxas por minuto (REBALANCEADAS: AFK era a maior fonte de up fácil e quebrava
// a economia — antes ~3 min já valiam ouro/XP demais). Agora o ganho de ~3 min
// demora ~1h (≈20x menos). Ainda escala com nível/poder e o máximo acumulado é
// 12h, então deixar 1 semana de AFK rende no máximo 12h.
export function afkRatesPerMinute(char: any) {
  const level = Number(char.level) || 1;
  const power = Number(char.power) || 0;
  return {
    goldPerMin: Math.floor(level * 0.25 + power * 0.008),
    xpPerMin: Math.floor(level * 0.55 + power * 0.015),
  };
}

// Retorna as recompensas brutas (sem aplicar o multiplicador de boost de XP,
// que é aplicado pelos chamadores via xpMultiplier). `sinceIso` = char.afkSince.
// Sem afkSince (null — sessão encerrada após coletar) retorna zeros, para não
// vazar recompensas fantasma de um `new Date(null)` (= 1970).
export function computeAfkRewards(char: any, sinceIso: string, now: Date) {
  if (!sinceIso) {
    return { gold: 0, xp: 0, goldPerMin: 0, xpPerMin: 0, diffSec: 0, minutes: 0 };
  }
  const diffMs = now.getTime() - new Date(sinceIso).getTime();
  const diffSec = Math.min(Math.floor(diffMs / 1000), AFK_MAX_DURATION_SEC);
  if (diffSec < 60) {
    return { gold: 0, xp: 0, goldPerMin: 0, xpPerMin: 0, diffSec, minutes: 0 };
  }
  const minutes = Math.floor(diffSec / 60);
  const { goldPerMin, xpPerMin } = afkRatesPerMinute(char);
  return {
    gold: goldPerMin * minutes,
    xp: xpPerMin * minutes,
    goldPerMin,
    xpPerMin,
    diffSec,
    minutes,
  };
}