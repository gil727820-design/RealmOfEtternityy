/**
 * Mercado entre jogadores — regras compartilhadas entre as rotas da API e a UI.
 *
 * Anúncios (venda por ouro/diamantes):
 *  - nível mínimo 5 para usar o mercado;
 *  - max. 8 anúncios ativos por personagem e 300 no servidor;
 *  - taxa de anúncio: 5% do preço em ouro (mín 10, máx 1.000) ou 2 diamantes;
 *  - itens equipados / já listados não podem ser anunciados;
 *  - preço máximo por item: 500k de ouro ou 5.000 diamantes.
 *
 * Trocas (player-to-player):
 *  - max. 3 propostas pendentes por personagem;
 *  - max. 8 itens e 1 milhão de ouro / 10k diamantes por lado;
 *  - itens oferecidos ficam RESERVADOS até aceitar/cancelar/recusar.
 */

/** Nível mínimo para anunciar/comprar/trocar. */
export const MARKET_MIN_LEVEL = 5;

/** Máximo de anúncios ativos por personagem. */
export const MAX_LISTINGS_PER_CHAR = 8;

/** Máximo de anúncios ativos no servidor inteiro. */
export const MAX_LISTINGS_GLOBAL = 300;

/** Taxa de anúncio em ouro: 5% (mín 10, máx 1.000). */
export const LISTING_FEE_GOLD_PCT = 0.05;
export const LISTING_FEE_GOLD_MIN = 10;
export const LISTING_FEE_GOLD_MAX = 1_000;

/** Taxa de anúncio em diamantes (plano, para quem vende por diamante). */
export const LISTING_FEE_DIAMONDS = 2;

/** Preço máximo por unidade. */
export const MAX_PRICE_GOLD = 500_000;
export const MAX_PRICE_DIAMONDS = 5_000;

/** Descrição curta da taxa de anúncio (para a UI). */
export function listingFeeDesc(price: number, currency: "gold" | "diamonds"): string {
  if (currency === "diamonds") return `💎 ${LISTING_FEE_DIAMONDS}`;
  const fee = Math.min(LISTING_FEE_GOLD_MAX, Math.max(LISTING_FEE_GOLD_MIN, Math.floor(price * LISTING_FEE_GOLD_PCT)));
  return `🪙 ${fee}`;
}

/** Valor da taxa de anúncio (para a API). */
export function listingFee(price: number, currency: "gold" | "diamonds"): number {
  if (currency === "diamonds") return LISTING_FEE_DIAMONDS;
  return Math.min(LISTING_FEE_GOLD_MAX, Math.max(LISTING_FEE_GOLD_MIN, Math.floor(price * LISTING_FEE_GOLD_PCT)));
}

/**
 * Requisitos para VENDER no mercado (anunciar itens).
 * Além do nível mínimo, exige um "feito" do jogador — subir na torre — para
 * liberar o leilão. Comprar continua valendo apenas o nível mínimo.
 */
export function sellUnlock(char: any) {
  const level = Number(char?.level) || 0;
  const towerFloor = Number(char?.towerFloor) || 0;
  const minTowerFloor = 10;
  const unlocked = level >= MARKET_MIN_LEVEL && towerFloor >= minTowerFloor;
  return {
    unlocked,
    minLevel: MARKET_MIN_LEVEL,
    minTowerFloor,
    level,
    towerFloor,
    missing:
      level < MARKET_MIN_LEVEL
        ? `Nível mínimo: ${MARKET_MIN_LEVEL}`
        : towerFloor < minTowerFloor
          ? `Suba até o andar ${minTowerFloor} da torre para liberar o leilão`
          : null,
  };
}

/** Preço médio por unidade de um template (usado pela UI para referência). */
export function avgPrice(listings: any[], templateId: number, currency: "gold" | "diamonds") {
  const matches = listings.filter(
    (l: any) =>
      Number(l.templateId) === Number(templateId) &&
      l.currency === currency &&
      l.status === "active" &&
      Number(l.price) > 0
  );
  if (matches.length === 0) return null;
  const perUnit = matches.map((l: any) =>
    Math.round(Number(l.price) / Math.max(1, Number(l.quantity) || 1))
  );
  return Math.round(perUnit.reduce((a, b) => a + b, 0) / perUnit.length);
}
