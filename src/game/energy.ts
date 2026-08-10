/**
 * Sistema de recarga passiva de energia.
 *
 * Energia regenera 1 ponto a cada ENERGY_REGEN_MINUTES minutos, e é consumida
 * ao iniciar missões (cada missão tem um energyCost). A recarga é calculada
 * por tempo real decorrido desde o último registro (lastEnergyAt), então funciona
 * mesmo com o jogador desconectado — basta qualquer chamada que leia/atualize
 * o personagem para "carimbar" a nova energia.
 */

/** Minutos para gerar 1 ponto de energia. */
export const ENERGY_REGEN_MINUTES = 3;
/** Milissegundos para gerar 1 ponto de energia. */
export const ENERGY_REGEN_MS = ENERGY_REGEN_MINUTES * 60 * 1000;

export interface EnergyRegenResult {
  /** Energia atual após a recarga computada. */
  energy: number;
  /** Timestamp a persistir como lastEnergyAt. */
  lastEnergyAt: string;
  /** Pontos de energia ganhos nesta chamada. */
  gained: number;
  /** Ms restantes até a próxima energia (0 se cheio). */
  msToNext: number;
  /** True se a energia alcançou o máximo. */
  full: boolean;
}

export function computeEnergyRegen(
  char: {
    energy?: number;
    maxEnergy?: number;
    lastEnergyAt?: string;
    lastActivity?: string;
    afkSince?: string;
  },
  now: Date = new Date(),
  multiplier: number = 1
): EnergyRegenResult {
  const rate = Math.max(1, multiplier | 0) || 1;
  const maxEnergy = Number(char.maxEnergy) || 100;
  let energy = Number(char.energy);
  if (Number.isNaN(energy)) energy = maxEnergy;

  // Já cheio: nada a regenerar (o timer só importa quando gastar).
  if (energy >= maxEnergy) {
    return { energy: maxEnergy, lastEnergyAt: now.toISOString(), gained: 0, msToNext: 0, full: true };
  }

  const baseRaw = char.lastEnergyAt ?? char.lastActivity ?? char.afkSince;
  const baseTs = baseRaw ? new Date(baseRaw).getTime() : now.getTime();
  const startTs = Number.isNaN(baseTs) ? now.getTime() : baseTs;

  const elapsed = Math.max(0, now.getTime() - startTs);
  const intervals = Math.floor(elapsed / ENERGY_REGEN_MS);
  const points = intervals * rate;

  if (points <= 0) {
    const msToNext = Math.max(0, startTs + ENERGY_REGEN_MS - now.getTime());
    return {
      energy,
      lastEnergyAt: new Date(startTs).toISOString(),
      gained: 0,
      msToNext,
      full: false,
    };
  }

  const gained = Math.min(points, maxEnergy - energy);
  energy += gained;
  // Posição do relógio real equivalente aos pontos ganhos (divide pela taxa
  // porque cada intervalo real vale `rate` pontos quando o boost está ativo).
  const consumedIntervals = Math.ceil(gained / rate);
  const lastGainTs = startTs + consumedIntervals * ENERGY_REGEN_MS;

  // Se, pelo relógio real, a energia já estaria no máximo, trava como cheio.
  const fullByTime = startTs + intervals * ENERGY_REGEN_MS <= now.getTime() && points >= maxEnergy - (energy - gained);
  if (energy >= maxEnergy || fullByTime) {
    return { energy: maxEnergy, lastEnergyAt: now.toISOString(), gained, msToNext: 0, full: true };
  }

  const msToNext = Math.max(0, lastGainTs + ENERGY_REGEN_MS - now.getTime());
  return {
    energy,
    lastEnergyAt: new Date(lastGainTs).toISOString(),
    gained,
    msToNext,
    full: false,
  };
}