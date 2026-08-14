/**
 * Regras da Forja (compartilhadas entre a API e o cálculo de bônus de equipamento).
 * - Aprimorar (enhance): +1 nível, +5% de atributos por nível (balanceado para
 *   não ficar apelão), custo e risco crescentes.
 * - Encantar (enchant): aplica um encantamento aleatório com bônus fixo.
 *   Itens encantados NÃO podem ser aprimorados (o encanto "sela" a forja).
 */

export interface EnchantDef {
  id: string;
  icon: string;
  labelKey: string;
  stat: "attack" | "defense" | "critical" | "speed" | "maxHp";
  amount: number;
}

export const MAX_ENHANCE = 20;

export const ENCHANT_POOL: EnchantDef[] = [
  { id: "fire",    icon: "🔥", labelKey: "enchant.fire",    stat: "attack",   amount: 6 },
  { id: "ice",     icon: "❄️", labelKey: "enchant.ice",     stat: "defense",  amount: 6 },
  { id: "poison",  icon: "☠️", labelKey: "enchant.poison",  stat: "critical", amount: 4 },
  { id: "light",   icon: "✨", labelKey: "enchant.light",   stat: "maxHp",    amount: 120 },
  { id: "storm",   icon: "⚡", labelKey: "enchant.storm",   stat: "speed",    amount: 4 },
  { id: "holy",    icon: "🛡️", labelKey: "enchant.holy",    stat: "defense",  amount: 9 },
];

export function enchantById(id: string): EnchantDef | undefined {
  return ENCHANT_POOL.find((e) => e.id === id);
}

/** Custo em ouro para aprimorar do nível `level` para `level + 1`. */
export function enhanceCost(level: number): number {
  return Math.floor(800 * Math.pow(1.42, Math.min(level, MAX_ENHANCE)));
}

/** Chance de sucesso (%) ao tentar aprimorar do nível `level`. */
export function enhanceChance(level: number): number {
  if (level >= MAX_ENHANCE) return 0;
  return Math.round(Math.max(15, 100 - level * 4));
}

/** Bônus de atributos de um item de equipamento considerando aprimoramento + encanto. */
export function equipmentBonus(template: Record<string, unknown> | null, item: Record<string, unknown>) {
  const t = template || {};
  // +5% por nível de aprimoramento (antes +10% — ficava apelão no late game).
  const scale = 1 + (Number(item.enhanceLevel) || 0) * 0.05;
  const ench = enchantById(String(item.enchant || ""));
  const bonus: Record<string, number> = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
  bonus.attack = Math.floor(Number(t.attack || 0) * scale);
  bonus.defense = Math.floor(Number(t.defense || 0) * scale);
  bonus.maxHp = Math.floor(Number(t.hp || 0) * scale);
  bonus.speed = Math.floor(Number(t.speed || 0) * scale);
  bonus.critical = Math.floor(Number(t.critical || 0) * scale);
  if (ench) bonus[ench.stat] = (bonus[ench.stat] || 0) + ench.amount;
  return bonus;
}