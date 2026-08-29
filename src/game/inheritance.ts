/**
 * SISTEMA DE HERANCA — transferir itens entre personagens da mesma conta.
 *
 * Regras:
 *   - So pode transferir itens nao equipados
 *   - Itens lendarios e miticos tem custo extra em diamantes
 *   - Materiais de crafting podem ser transferidos livremente
 *   - Max 10 transferencias por dia
 *   - Itens de quest nao podem ser transferidos
 */

export interface InheritanceCost {
  gold: number;
  diamonds: number;
  label: string;
}

/** Custo de transferencia baseado na raridade do item */
export function inheritanceCost(rarity: string, itemValue: number): InheritanceCost {
  const baseGold = Math.max(500, Math.floor(itemValue * 0.1));

  switch (rarity) {
    case "common":
      return { gold: baseGold, diamonds: 0, label: "Comum" };
    case "uncommon":
      return { gold: baseGold * 2, diamonds: 0, label: "Incomum" };
    case "rare":
      return { gold: baseGold * 3, diamonds: 0, label: "Raro" };
    case "epic":
      return { gold: baseGold * 5, diamonds: 1, label: "Epico" };
    case "legendary":
      return { gold: baseGold * 8, diamonds: 3, label: "Lendario" };
    case "mythic":
      return { gold: baseGold * 15, diamonds: 8, label: "Mitico" };
    case "divine":
      return { gold: baseGold * 25, diamonds: 15, label: "Divino" };
    case "supreme":
      return { gold: baseGold * 40, diamonds: 25, label: "Supremo" };
    default:
      return { gold: baseGold, diamonds: 0, label: rarity };
  }
}

/** Limite diario de transferencias */
export const INHERITANCE_DAILY_LIMIT = 10;

/** Verificar se o item pode ser transferido */
export function canInheritItem(item: any): { ok: boolean; reason?: string } {
  if (item.equipped) {
    return { ok: false, reason: "Item equipado — desequipe primeiro!" };
  }
  if (item.questItem) {
    return { ok: false, reason: "Item de quest — nao pode ser transferido!" };
  }
  return { ok: true };
}
