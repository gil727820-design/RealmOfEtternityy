/**
 * Anúncios de troca entre jogadores + sala de troca com dupla confirmação.
 *
 * Fluxo:
 *  1. O jogador cria um anúncio público: título + item que oferece + o que quer.
 *  2. Outros jogadores conversam no CHAT do anúncio para negociar.
 *  3. Um dos dois abre uma SALA DE TROCA (1x1, fechada).
 *  4. Cada um seleciona os itens que vai dar e CONFIRMA o próprio lado.
 *  5. Quando AMBOS confirmaram, o servidor executa a troca de forma ATÔMICA:
 *     valida tudo de novo, move os itens dos dois lados e finaliza. Ninguém
 *     fica com item a mais ou a menos (sem dupe).
 */

/** Nível mínimo para criar anúncios de troca. */
export const TRADE_AD_MIN_LEVEL = 5;

/** Máximo de anúncios ativos por personagem. */
export const MAX_TRADE_ADS_PER_CHAR = 5;

/** Máximo de anúncios ativos no servidor inteiro. */
export const MAX_TRADE_ADS_GLOBAL = 100;

/** Máximo de itens por lado na sala de troca. */
export const MAX_SESSION_ITEMS_PER_SIDE = 8;

/** Máximo de mensagens guardadas no chat de um anúncio. */
export const MAX_CHAT_MESSAGES = 100;

/** Tempo de vida do anúncio (horas) — expira automaticamente ao ser visto. */
export const TRADE_AD_TTL_HOURS = 72;

/** Quantos itens aparecem na grade da sala de troca (por jogador). */
export const SESSION_INVENTORY_LIMIT = 40;
