/**
 * Sistema de VIP por TIER (Bronze → Imperador).
 *
 * Cada tier dá bônus funcionais (XP, ouro e recarga de energia) e é comprado
 * com diamantes na loja. O personagem guarda `vipTier` (id) e `vipUntil` (ISO);
 * enquantro o VIP estiver ativo, os multiplicadores abaixo se aplicam em todo
 * o jogo (missões, AFK, torre, PvP, masmorras, energia).
 *
 * As imagens usam os mesmos ícones de liga do PvP (liga_*.png).
 */

export type VipTierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "legend" | "emperor";

export interface VipTierDef {
  id: VipTierId;
  nameKey: string;
  descKey: string;
  image: string;
  /** Custo em diamantes (30 dias). */
  price: number;
  /** Dias de duração. */
  days: number;
  xpMult: number;
  goldMult: number;
  energyRate: number;
}

export const VIP_TIERS: VipTierDef[] = [
  { id: "bronze",    nameKey: "vip.bronze",    descKey: "vip.bronze.desc",    image: "/images/icons/liga_bronze.png",    price: 100, days: 30, xpMult: 1.15, goldMult: 1.1,  energyRate: 1.05 },
  { id: "silver",    nameKey: "vip.silver",    descKey: "vip.silver.desc",    image: "/images/icons/liga_prata.png",     price: 250, days: 30, xpMult: 1.3,  goldMult: 1.2,  energyRate: 1.1 },
  { id: "gold",      nameKey: "vip.gold",      descKey: "vip.gold.desc",      image: "/images/icons/liga_ouro.png",      price: 500, days: 30, xpMult: 1.5,  goldMult: 1.35, energyRate: 1.15 },
  { id: "platinum",  nameKey: "vip.platinum",  descKey: "vip.platinum.desc",  image: "/images/icons/liga_platina.png",   price: 900, days: 30, xpMult: 1.7,  goldMult: 1.5,  energyRate: 1.2 },
  { id: "diamond",   nameKey: "vip.diamond",   descKey: "vip.diamond.desc",   image: "/images/icons/liga_diamante.png",  price: 1500, days: 30, xpMult: 2.0, goldMult: 1.75, energyRate: 1.25 },
  { id: "master",    nameKey: "vip.master",    descKey: "vip.master.desc",    image: "/images/icons/liga_mestre.png",    price: 2500, days: 30, xpMult: 2.3, goldMult: 2.0,  energyRate: 1.3 },
  { id: "legend",    nameKey: "vip.legend",    descKey: "vip.legend.desc",    image: "/images/icons/liga_lenda.png",     price: 4000, days: 30, xpMult: 2.6, goldMult: 2.25, energyRate: 1.35 },
  { id: "emperor",   nameKey: "vip.emperor",   descKey: "vip.emperor.desc",   image: "/images/icons/liga_imperador.png", price: 7000, days: 30, xpMult: 3.0, goldMult: 2.5,  energyRate: 1.4 },
];

export function vipTierById(id: string): VipTierDef | null {
  return VIP_TIERS.find((t) => t.id === id) ?? null;
}

/** Tier atualmente ativo do personagem (null se não tem / expirado). */
export function currentVipTier(char: Record<string, unknown> | null | undefined): VipTierDef | null {
  if (!char) return null;
  const id = char.vipTier as string | undefined;
  const until = char.vipUntil as string | undefined;
  if (!id || !until) return null;
  const ts = new Date(until).getTime();
  if (!Number.isFinite(ts) || ts <= Date.now()) return null;
  return vipTierById(id);
}

export function vipXpMult(char: Record<string, unknown> | null | undefined): number {
  return currentVipTier(char)?.xpMult ?? 1;
}

export function vipGoldMult(char: Record<string, unknown> | null | undefined): number {
  return currentVipTier(char)?.goldMult ?? 1;
}

export function vipEnergyRate(char: Record<string, unknown> | null | undefined): number {
  return currentVipTier(char)?.energyRate ?? 1;
}

/** Ms restantes do VIP atual (0 se inativo). */
export function vipRemainingMs(char: Record<string, unknown> | null | undefined): number {
  const tier = currentVipTier(char);
  if (!tier || !char) return 0;
  const ts = new Date(char.vipUntil as string).getTime();
  return Math.max(0, ts - Date.now());
}