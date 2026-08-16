/**
 * Sistema de DROPS — recompensas extras além de XP/ouro.
 *
 * Hoje usado nas MISSÕES: ao concluir uma missão, além do XP/ouro, há chance
 * de dropar equipamento ou poção. A lógica fica aqui em src/game/ (regras
 * puras) e é chamada pela rota da API — a UI só exibe o resultado.
 *
 * Quando o sistema de MATERIAIS for criado, os drops de material entram no
 * mesmo fluxo (basta adicionar o pool no `rollMissionDrops`).
 */

export interface RolledDrop {
  templateId: number;
  nameKey: string;
  icon: string;
  image: string;
  rarity: string;
  quantity: number;
  kind: "equipment" | "consumable" | "material";
}

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"];

/** Raridade sorteada com peso decrescente (topo tem mais peso). */
export function weightedRarity(maxRarityIdx: number, rng: () => number = Math.random): string {
  const maxIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, maxRarityIdx));
  const r = rng();
  // Chance maior nas raridades altas do pool, menor nas baixas.
  const idx = Math.min(maxIdx, Math.floor(r * r * (maxIdx + 1)));
  return RARITY_ORDER[idx];
}

/**
 * Rola drops de MISSÃO. Pools:
 *  - equipamento: chance pequena (5%) — raridade ponderada até o teto do nível;
 *  - consumível:  chance média (12%) — poção de vida/mana do template.
 * Retorna array vazio se nada dropar.
 */
export function rollMissionDrops(
  allTemplates: any[],
  level: number,
  rng: () => number = Math.random
): RolledDrop[] {
  const lvl = Math.max(1, Number(level) || 1);
  const drops: RolledDrop[] = [];

  // Pool de equipamentos usáveis (nível acessível, não consumível).
  const equipment = allTemplates.filter((it: any) => {
    if (it.type === "consumable" || it.stackable === true) return false;
    if (!it.slot) return false;
    return (Number(it.minLevel) || 1) <= lvl + 5;
  });

  // Pool de consumíveis (poções).
  const consumables = allTemplates.filter((it: any) => {
    if (it.type !== "consumable" && it.stackable !== true) return false;
    return (Number(it.minLevel) || 1) <= lvl + 5;
  });

  // 5% — equipamento
  if (equipment.length > 0 && rng() < 0.05) {
    // Teto de raridade: comum/uncomum/raro nas fases iniciais, melhora com o nível.
    const maxRarityIdx = Math.min(
      RARITY_ORDER.length - 1,
      lvl < 10 ? 0 : lvl < 25 ? 1 : lvl < 45 ? 2 : lvl < 70 ? 3 : 4
    );
    const rarity = weightedRarity(maxRarityIdx, rng);
    const pool = equipment.filter((it: any) => String(it.rarity) === rarity);
    const pick = (pool.length > 0 ? pool : equipment)[Math.floor(rng() * (pool.length > 0 ? pool.length : equipment.length))];
    if (pick) {
      drops.push({
        templateId: Number(pick.id),
        nameKey: pick.nameKey,
        icon: pick.icon,
        image: pick.image,
        rarity: String(pick.rarity || "common"),
        quantity: 1,
        kind: "equipment",
      });
    }
  }

  // 12% — consumível (poção)
  if (consumables.length > 0 && rng() < 0.12) {
    const pick = consumables[Math.floor(rng() * consumables.length)];
    if (pick) {
      drops.push({
        templateId: Number(pick.id),
        nameKey: pick.nameKey,
        icon: pick.icon,
        image: pick.image,
        rarity: String(pick.rarity || "common"),
        quantity: 1,
        kind: "consumable",
      });
    }
  }

  return drops;
}
