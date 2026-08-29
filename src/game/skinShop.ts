/**
 * Loja de Skins — preços e regras de compra.
 *
 * Cada skin tem um custo base em ouro ou diamantes, dependendo da raridade:
 *   - epic: 10.000 ouro
 *   - legendary: 25.000 ouro ou 10 diamantes
 *   - mythic: 50.000 ouro ou 25 diamantes
 *
 * Desconto de 20% para skins da classe do jogador.
 */

import { SKIN_CATALOG, type SkinTemplate } from "./skins";
import type { ClassName } from "./constants";

export interface SkinShopItem {
  skin: SkinTemplate;
  goldPrice: number;
  diamondPrice: number;
  classDiscount: boolean;
}

const BASE_PRICES: Record<string, { gold: number; diamonds: number }> = {
  epic:      { gold: 10000, diamonds: 5 },
  legendary: { gold: 25000, diamonds: 10 },
  mythic:    { gold: 50000, diamonds: 25 },
};

/** Retorna todas as skins da loja com preços calculados. */
export function getSkinShopItems(playerClass?: ClassName): SkinShopItem[] {
  return SKIN_CATALOG.map((skin) => {
    const base = BASE_PRICES[skin.rarity] ?? BASE_PRICES.epic;
    const classDiscount = playerClass === skin.className;
    const discount = classDiscount ? 0.8 : 1;
    return {
      skin,
      goldPrice: Math.floor(base.gold * discount),
      diamondPrice: Math.floor(base.diamonds * discount),
      classDiscount,
    };
  });
}

/** Verifica se o jogador pode comprar a skin. */
export function canBuySkin(
  item: SkinShopItem,
  gold: number,
  diamonds: number,
  ownedSkins: string[],
  paymentType: "gold" | "diamonds"
): { ok: boolean; error?: string } {
  if (ownedSkins.includes(item.skin.id)) {
    return { ok: false, error: "Voce ja possui esta skin!" };
  }
  if (paymentType === "gold" && gold < item.goldPrice) {
    return { ok: false, error: `Ouro insuficiente! Necessario: ${item.goldPrice.toLocaleString()} 💰` };
  }
  if (paymentType === "diamonds" && diamonds < item.diamondPrice) {
    return { ok: false, error: `Diamantes insuficientes! Necessario: ${item.diamondPrice} 💎` };
  }
  return { ok: true };
}
