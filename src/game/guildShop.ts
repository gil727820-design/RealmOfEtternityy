/**
 * LOJA DA GUILDA 🏪 — itens exclusivos compráveis com moedas da guilda.
 *
 * Itens da loja são concedidos ao personagem que compra (não à guilda).
 * O custo é deduzido das moedas da guilda (guildCoins).
 */

export interface GuildShopItem {
  id: string;
  nameKey: string;
  icon: string;
  description: string;
  /** Tipo de recompensa. */
  rewardType: "gold" | "diamonds" | "crystals" | "towerCoins" | "xpBoost" | "goldBoost" | "energyRefill" | "statReset" | "skinTicket";
  rewardAmount: number;
  /** Custo em guildCoins. */
  cost: number;
  /** Nível mínimo da guilda para comprar. */
  minGuildLevel: number;
  /** Limite de compras por personagem (0 = ilimitado). */
  purchaseLimit: number;
}

export const GUILD_SHOP_ITEMS: GuildShopItem[] = [
  // Recursos básicos
  {
    id: "guild_gold_pack",
    nameKey: "guild.shop.goldPack",
    icon: "💰",
    description: "Pacote de 10.000 ouro",
    rewardType: "gold",
    rewardAmount: 10_000,
    cost: 2_000,
    minGuildLevel: 1,
    purchaseLimit: 10,
  },
  {
    id: "guild_crystal_pack",
    nameKey: "guild.shop.crystalPack",
    icon: "🔮",
    description: "Pacote de 15 cristais",
    rewardType: "crystals",
    rewardAmount: 15,
    cost: 3_000,
    minGuildLevel: 2,
    purchaseLimit: 5,
  },
  {
    id: "guild_tower_pack",
    nameKey: "guild.shop.towerPack",
    icon: "🗼",
    description: "200 moedas da torre",
    rewardType: "towerCoins",
    rewardAmount: 200,
    cost: 2_500,
    minGuildLevel: 2,
    purchaseLimit: 8,
  },
  // Boosts temporários
  {
    id: "guild_xp_boost",
    nameKey: "guild.shop.xpBoost",
    icon: "✨",
    description: "Boost de XP 2x por 2 horas",
    rewardType: "xpBoost",
    rewardAmount: 7200000, // 2h em ms
    cost: 5_000,
    minGuildLevel: 3,
    purchaseLimit: 3,
  },
  {
    id: "guild_gold_boost",
    nameKey: "guild.shop.goldBoost",
    icon: "💰",
    description: "Boost de Ouro 2x por 2 horas",
    rewardType: "goldBoost",
    rewardAmount: 7200000,
    cost: 5_000,
    minGuildLevel: 3,
    purchaseLimit: 3,
  },
  // Utilitários
  {
    id: "guild_energy_refill",
    nameKey: "guild.shop.energyRefill",
    icon: "⚡",
    description: "Recarrega toda a energia instantaneamente",
    rewardType: "energyRefill",
    rewardAmount: 1,
    cost: 4_000,
    minGuildLevel: 2,
    purchaseLimit: 5,
  },
  {
    id: "guild_stat_reset",
    nameKey: "guild.shop.statReset",
    icon: "🔄",
    description: "Resetar atributos gratuitamente",
    rewardType: "statReset",
    rewardAmount: 1,
    cost: 8_000,
    minGuildLevel: 4,
    purchaseLimit: 2,
  },
  // Premium
  {
    id: "guild_diamond_pack",
    nameKey: "guild.shop.diamondPack",
    icon: "💎",
    description: "5 diamantes premium",
    rewardType: "diamonds",
    rewardAmount: 5,
    cost: 15_000,
    minGuildLevel: 5,
    purchaseLimit: 2,
  },
  {
    id: "guild_skin_ticket",
    nameKey: "guild.shop.skinTicket",
    icon: "🎨",
    description: "Cupom para desbloquear 1 skin aleatória da sua classe",
    rewardType: "skinTicket",
    rewardAmount: 1,
    cost: 20_000,
    minGuildLevel: 6,
    purchaseLimit: 1,
  },
  {
    id: "guild_gold_pack_big",
    nameKey: "guild.shop.goldPackBig",
    icon: "💰",
    description: "Pacote grande de 50.000 ouro",
    rewardType: "gold",
    rewardAmount: 50_000,
    cost: 8_000,
    minGuildLevel: 4,
    purchaseLimit: 3,
  },
];

/** Itens disponíveis para o nível da guilda. */
export function guildShopForLevel(guildLevel: number): GuildShopItem[] {
  return GUILD_SHOP_ITEMS.filter((item) => guildLevel >= item.minGuildLevel);
}
