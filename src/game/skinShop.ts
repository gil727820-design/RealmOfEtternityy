/**
 * Loja de Skins — preços e regras de compra.
 *
 * Skins são pagas apenas com DIAMANTES:
 *   - epic: 5 diamantes
 *   - legendary: 10 diamantes
 *   - mythic: 25 diamantes
 *
 * Desconto de 20% para skins da classe do jogador.
 */

import { SKIN_CATALOG, type SkinTemplate } from "./skins";
import type { ClassName } from "./constants";

export interface SkinShopItem {
  skin: SkinTemplate;
  diamondPrice: number;
  classDiscount: boolean;
}

const BASE_PRICES: Record<string, number> = {
  epic:      5,
  legendary: 10,
  mythic:    25,
};

/** Retorna todas as skins da loja com preços calculados. */
export function getSkinShopItems(playerClass?: ClassName): SkinShopItem[] {
  return SKIN_CATALOG.map((skin) => {
    const base = BASE_PRICES[skin.rarity] ?? BASE_PRICES.epic;
    const classDiscount = playerClass === skin.className;
    const discount = classDiscount ? 0.8 : 1;
    return {
      skin,
      diamondPrice: Math.floor(base * discount),
      classDiscount,
    };
  });
}

/** Verifica se o jogador pode comprar a skin. */
export function canBuySkin(
  item: SkinShopItem,
  diamonds: number,
  ownedSkins: string[]
): { ok: boolean; error?: string } {
  if (ownedSkins.includes(item.skin.id)) {
    return { ok: false, error: "Voce ja possui esta skin!" };
  }
  if (diamonds < item.diamondPrice) {
    return { ok: false, error: `Diamantes insuficientes! Necessario: ${item.diamondPrice} 💎` };
  }
  return { ok: true };
}
