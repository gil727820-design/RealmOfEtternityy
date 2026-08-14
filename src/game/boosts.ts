/**
 * Sistema de BOOSTS (2x XP / 2x Energia).
 *
 * Os boosts são ativados por CÓDIGOS (gerados no painel admin) ou por POÇÕES
 * de boost no inventário. Ficam salvos no personagem em `character.boosts`:
 *   boosts: { xpUntil?: ISO, energyUntil?: ISO }
 *
 * Enquanto ativos, as recompensas de XP (missões/AFK) e a recarga de energia
 * são multiplicadas por 2 (XP_MULT / ENERGY_MULT).
 *
 * Os multiplicadores do VIP (ver src/game/vip.ts) são aplicados AQUI, somados
 * aos boosts — assim todo lugar que usa xpMultiplier/energyMultiplier/goldMultiplier
 * respeita o VIP automaticamente.
 */

import { vipXpMult, vipEnergyRate, vipGoldMult } from "./vip";

export interface Boosts {
  xpUntil?: string;
  energyUntil?: string;
}

export const XP_MULT = 2;
export const ENERGY_MULT = 2;

export function getBoosts(char: Record<string, unknown> | null | undefined): Boosts {
  const b = char?.boosts;
  return b && typeof b === "object" ? (b as Boosts) : {};
}

function isActive(until?: string, now: number = Date.now()): boolean {
  if (!until) return false;
  const ts = new Date(until).getTime();
  return Number.isFinite(ts) && ts > now;
}

export function xpActive(char: Record<string, unknown> | null | undefined): boolean {
  return isActive(getBoosts(char).xpUntil);
}

export function energyActive(char: Record<string, unknown> | null | undefined): boolean {
  return isActive(getBoosts(char).energyUntil);
}

/** Multiplicador de XP (boost 2x combinado com o bônus do VIP). */
export function xpMultiplier(char: Record<string, unknown> | null | undefined): number {
  return (xpActive(char) ? XP_MULT : 1) * vipXpMult(char);
}

/** Multiplicador de recarga de energia (boost 2x combinado com o bônus do VIP). */
export function energyMultiplier(char: Record<string, unknown> | null | undefined): number {
  return (energyActive(char) ? ENERGY_MULT : 1) * vipEnergyRate(char);
}

/** Multiplicador de ouro (bônus do VIP). Usado nas recompensas em ouro. */
export function goldMultiplier(char: Record<string, unknown> | null | undefined): number {
  return vipGoldMult(char);
}

/** Gera a lista de boosts atualizada ao aplicar um boost de N horas. */
export function applyBoostPatch(
  char: Record<string, unknown> | null | undefined,
  kind: "xp" | "energy" | "both",
  hours: number,
  now: number = Date.now()
): Boosts {
  const boosts = getBoosts(char);
  const until = new Date(now + hours * 3600 * 1000).toISOString();
  if (kind === "xp" || kind === "both") boosts.xpUntil = until;
  if (kind === "energy" || kind === "both") boosts.energyUntil = until;
  return boosts;
}

/** Ms restantes de um boost (0 se inativo). */
export function boostRemainingMs(boosts: Boosts, kind: "xp" | "energy", now: number = Date.now()): number {
  const until = kind === "xp" ? boosts.xpUntil : boosts.energyUntil;
  return isActive(until, now) ? new Date(until as string).getTime() - now : 0;
}

/** Resumo pronto para a UI. */
export function boostSummary(char: Record<string, unknown> | null | undefined) {
  const boosts = getBoosts(char);
  return {
    xpActive: xpActive(char),
    energyActive: energyActive(char),
    xpRemainingMs: boostRemainingMs(boosts, "xp"),
    energyRemainingMs: boostRemainingMs(boosts, "energy"),
  };
}

/** Formata ms para "Xh Ym". */
export function formatBoostMs(ms: number): string {
  if (ms <= 0) return "—";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}