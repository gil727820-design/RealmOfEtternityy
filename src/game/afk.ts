// Cálculo centralizado de recompensas AFK.
// Usado tanto para a estimativa exibida na UI (rota character/[id])
// quanto para o valor realmente concedido ao resgatar (rota afk/claim),
// garantindo que os dois nunca divergem.

export const AFK_MAX_DURATION_SEC = 43200; // 12h

// Buff de recompensas por minuto (vs. fórmula antiga: gold Lv*2+pwr*0.1 / xp Lv*3+pwr*0.05)
export function afkRatesPerMinute(char: any) {
  const level = Number(char.level) || 1;
  const power = Number(char.power) || 0;
  return {
    goldPerMin: Math.floor(level * 9 + power * 0.25),
    xpPerMin: Math.floor(level * 12 + power * 0.12),
  };
}

// Retorna as recompensas brutas (sem aplicar o multiplicador de boost de XP,
// que é aplicado pelos chamadores via xpMultiplier). `sinceIso` = char.afkSince.
export function computeAfkRewards(char: any, sinceIso: string, now: Date) {
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