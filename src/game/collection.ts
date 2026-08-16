/**
 * COLEÇÃO / CODEX 📚 — registro de itens já obtidos pelo jogador.
 *
 * Cada item que o personagem já viu/obteve fica registrado em
 * `collection: { unlocked: number[], claimed: string[] }` (ids de template).
 * Ao completar uma CATEGORIA (ex.: todas as espadas, todos os anéis...), o
 * jogador ganha recompensas. O progresso da coleção dá bônus passivos:
 *   - 5% de XP por categoria completa
 *   - 5% de ouro por categoria completa
 *
 * O servidor valida a concessão (anti-cheat): só conta itens realmente
 * concedidos pelo sistema (grantItem registra automaticamente).
 */

import { RARITY_STAT_MULT } from "./forge";

/** Categorias de coleção (por slot). */
export const COLLECTION_CATEGORIES = [
  { id: "weapon", icon: "⚔️", nameKey: "collection.weapon" },
  { id: "armor", icon: "🛡️", nameKey: "collection.armor" },
  { id: "helmet", icon: "⛑️", nameKey: "collection.helmet" },
  { id: "gloves", icon: "🧤", nameKey: "collection.gloves" },
  { id: "boots", icon: "👢", nameKey: "collection.boots" },
  { id: "pants", icon: "👖", nameKey: "collection.pants" },
  { id: "ring", icon: "💍", nameKey: "collection.ring" },
  { id: "amulet", icon: "📿", nameKey: "collection.amulet" },
  { id: "shield", icon: "🛡️", nameKey: "collection.shield" },
  { id: "relic", icon: "🗿", nameKey: "collection.relic" },
] as const;

/** Lê o estado da coleção do personagem. */
export function collectionState(char: any): { unlocked: number[]; claimed: string[] } {
  const c = char?.collection;
  if (c && typeof c === "object") {
    return {
      unlocked: Array.isArray(c.unlocked) ? c.unlocked.map((n: unknown) => Number(n)) : [],
      claimed: Array.isArray(c.claimed) ? c.claimed : [],
    };
  }
  return { unlocked: [], claimed: [] };
}

/** Registra itens obtidos (ids de template) na coleção. Devolve o patch. */
export function registerCollection(char: any, templateIds: number[]): { collection: { unlocked: number[]; claimed: string[] } } {
  const st = collectionState(char);
  for (const id of templateIds) {
    const n = Math.floor(Number(id));
    if (Number.isFinite(n) && n > 0 && !st.unlocked.includes(n)) st.unlocked.push(n);
  }
  return { collection: st };
}

/** Agrupa os templates por categoria (slot). */
export function templatesByCategory(templates: any[]): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const t of templates) {
    if (t.type === "consumable" || t.stackable === true) continue;
    if (!t.slot) continue;
    if (!out[t.slot]) out[t.slot] = [];
    out[t.slot].push(t);
  }
  return out;
}

/** Progresso da coleção: total de itens únicos e por categoria. */
export function collectionProgress(char: any, templates: any[]) {
  const st = collectionState(char);
  const byCat = templatesByCategory(templates);
  const total = templates.filter((t) => t.slot && t.type !== "consumable" && t.stackable !== true).length;
  const unlocked = templates.filter((t) => t.slot && st.unlocked.includes(Number(t.id))).length;

  const categories = Object.keys(byCat).map((slot) => {
    const def = COLLECTION_CATEGORIES.find((c) => c.id === slot);
    const entries = byCat[slot];
    const unlockedCount = entries.filter((t) => st.unlocked.includes(Number(t.id))).length;
    return {
      category: slot,
      icon: def?.icon ?? "🎒",
      nameKey: def?.nameKey ?? `slot.${slot}`,
      total: entries.length,
      unlocked: unlockedCount,
      complete: unlockedCount === entries.length,
      claimed: st.claimed.includes(slot),
    };
  });

  return { total, unlocked, pct: total > 0 ? Math.round((unlocked / total) * 100) : 0, categories };
}

/** Bônus passivo da coleção: +5% XP e +5% ouro por categoria completa. */
export function collectionBonus(char: any, templates: any[]): { xpPct: number; goldPct: number; completed: number } {
  const st = collectionState(char);
  const byCat = templatesByCategory(templates);
  let completed = 0;
  for (const slot of Object.keys(byCat)) {
    if (byCat[slot].every((t) => st.unlocked.includes(Number(t.id)))) completed++;
  }
  return { xpPct: completed * 5, goldPct: completed * 5, completed };
}

/** Recompensa de completar uma categoria (escala com o número de itens). */
export function collectionCategoryReward(level: number, itemCount: number) {
  const lv = Math.max(1, Number(level) || 1);
  return {
    gold: 500 + lv * 30 + itemCount * 50,
    diamonds: 1 + Math.floor(itemCount / 10),
    crystals: 3 + Math.floor(lv / 25) + Math.floor(itemCount / 8),
  };
}

/** Coleta a recompensa de categoria completa. */
export function claimCollectionReward(
  char: any,
  templates: any[],
  category: string
): { patch: any; reward: { gold: number; diamonds: number; crystals: number } } | { error: string } {
  const byCat = templatesByCategory(templates);
  const entries = byCat[category];
  if (!entries || entries.length === 0) return { error: "Categoria não encontrada" };
  const st = collectionState(char);
  if (!entries.every((t) => st.unlocked.includes(Number(t.id)))) {
    return { error: "Obtenha todos os itens desta categoria primeiro" };
  }
  if (st.claimed.includes(category)) return { error: "Recompensa já coletada" };

  st.claimed.push(category);
  const reward = collectionCategoryReward(Number(char.level) || 1, entries.length);
  const patch: any = { collection: st };
  patch.gold = (Number(char.gold) || 0) + reward.gold;
  patch.diamonds = (Number(char.diamonds) || 0) + reward.diamonds;
  patch.crystals = (Number(char.crystals) || 0) + reward.crystals;
  return { patch, reward };
}
