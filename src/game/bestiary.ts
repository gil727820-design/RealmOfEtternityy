/**
 * BESTIÁRIO 📖 — enciclopédia de criaturas derrotadas.
 *
 * Cada mob/elite/mini-boss/boss derrotado fica registrado no personagem em
 * `bestiary: { defeated: Record<string, number>, claimed: string[] }` — o id
 * da criatura + quantas vezes foi derrotada.
 *
 * Ao completar uma CATEGORIA (ex.: todos os mobs da vila), o jogador ganha uma
 * recompensa (ouro/cristais/moedas da torre + bônus permanente de dano contra
 * aquela categoria). O servidor valida tudo (anti-cheat).
 */

/** Criatura do bestiário (referência estável para todas as fontes do jogo). */
export interface BestiaryEntry {
  id: string;
  nameKey: string;
  icon: string;
  image: string;
  /** Categoria (região ou "boss" para chefes). */
  category: string;
  /** 1 = mob comum, 2 = elite, 3 = mini-boss, 4 = boss. */
  tier: 1 | 2 | 3 | 4;
  /** Região de onde vem (para a UI agrupar). */
  regionId: string;
}

/** Criaturas conhecidas do bestiário (espelha REGION_MOBS + mini-bosses + bosses). */
export const BESTIARY_ENTRIES: BestiaryEntry[] = [
  // Vila Inicial
  { id: "slime", nameKey: "regionmob.slime", icon: "🟢", image: "/images/mobs/slime.png", category: "starter_village", tier: 1, regionId: "starter_village" },
  { id: "rato", nameKey: "regionmob.rato", icon: "🐀", image: "/images/mobs/rato.png", category: "starter_village", tier: 1, regionId: "starter_village" },
  { id: "lobo_vila", nameKey: "regionmob.lobo_vila", icon: "🐺", image: "/images/mobs/lobo.png", category: "starter_village", tier: 1, regionId: "starter_village" },
  { id: "slime_alfa", nameKey: "regionmob.slime_alfa", icon: "🟢", image: "/images/mobs/slime_alfa.png", category: "starter_village", tier: 2, regionId: "starter_village" },
  { id: "miniboss_starter_village", nameKey: "regionminiboss.guardiao_floresta", icon: "🌳", image: "/images/mobs/guardiao_floresta.png", category: "starter_village", tier: 3, regionId: "starter_village" },
  // Floresta Esquecida
  { id: "slime_verde", nameKey: "regionmob.slime_verde", icon: "🟢", image: "/images/mobs/slime.png", category: "forgotten_forest", tier: 1, regionId: "forgotten_forest" },
  { id: "lobo", nameKey: "regionmob.lobo", icon: "🐺", image: "/images/mobs/lobo.png", category: "forgotten_forest", tier: 1, regionId: "forgotten_forest" },
  { id: "aranha", nameKey: "regionmob.aranha", icon: "🕷️", image: "/images/mobs/aranha.png", category: "forgotten_forest", tier: 1, regionId: "forgotten_forest" },
  { id: "lobo_alfa", nameKey: "regionmob.lobo_alfa", icon: "🐺", image: "/images/mobs/lobo_alfa.png", category: "forgotten_forest", tier: 2, regionId: "forgotten_forest" },
  { id: "miniboss_forgotten_forest", nameKey: "regionminiboss.rei_ent", icon: "🌳", image: "/images/mobs/rei_ent.png", category: "forgotten_forest", tier: 3, regionId: "forgotten_forest" },
  // Ruínas Antigas
  { id: "esqueleto", nameKey: "regionmob.esqueleto", icon: "💀", image: "/images/mobs/esqueleto.png", category: "ancient_ruins", tier: 1, regionId: "ancient_ruins" },
  { id: "golem_ruina", nameKey: "regionmob.golem_ruina", icon: "🗿", image: "/images/mobs/golem.png", category: "ancient_ruins", tier: 1, regionId: "ancient_ruins" },
  { id: "espectro", nameKey: "regionmob.espectro", icon: "👻", image: "/images/mobs/espectro.png", category: "ancient_ruins", tier: 1, regionId: "ancient_ruins" },
  { id: "golem_antigo", nameKey: "regionmob.golem_antigo", icon: "🗿", image: "/images/mobs/golem_alfa.png", category: "ancient_ruins", tier: 2, regionId: "ancient_ruins" },
  { id: "miniboss_ancient_ruins", nameKey: "regionminiboss.governante_ruinas", icon: "🏛️", image: "/images/mobs/governante_ruinas.png", category: "ancient_ruins", tier: 3, regionId: "ancient_ruins" },
  // Minas Profundas
  { id: "morcego", nameKey: "regionmob.morcego", icon: "🦇", image: "/images/mobs/morcego.png", category: "deep_mines", tier: 1, regionId: "deep_mines" },
  { id: "goblin", nameKey: "regionmob.goblin", icon: "👺", image: "/images/mobs/goblin.png", category: "deep_mines", tier: 1, regionId: "deep_mines" },
  { id: "cristal_vivo", nameKey: "regionmob.cristal_vivo", icon: "💎", image: "/images/mobs/cristal_vivo.png", category: "deep_mines", tier: 1, regionId: "deep_mines" },
  { id: "goblin_chefe", nameKey: "regionmob.goblin_chefe", icon: "👺", image: "/images/mobs/goblin_chefe.png", category: "deep_mines", tier: 2, regionId: "deep_mines" },
  { id: "miniboss_deep_mines", nameKey: "regionminiboss.rei_mina", icon: "⛏️", image: "/images/mobs/rei_mina.png", category: "deep_mines", tier: 3, regionId: "deep_mines" },
  // Pântano Sombrio
  { id: "sapo", nameKey: "regionmob.sapo", icon: "🐸", image: "/images/mobs/sapo.png", category: "dark_swamp", tier: 1, regionId: "dark_swamp" },
  { id: "crocodilo", nameKey: "regionmob.crocodilo", icon: "🐊", image: "/images/mobs/crocodilo.png", category: "dark_swamp", tier: 1, regionId: "dark_swamp" },
  { id: "cobra", nameKey: "regionmob.cobra", icon: "🐍", image: "/images/mobs/cobra.png", category: "dark_swamp", tier: 1, regionId: "dark_swamp" },
  { id: "hidra_jovem", nameKey: "regionmob.hidra_jovem", icon: "🐍", image: "/images/mobs/hidra_jovem.png", category: "dark_swamp", tier: 2, regionId: "dark_swamp" },
  { id: "miniboss_dark_swamp", nameKey: "regionminiboss.senhor_pantano", icon: "🐊", image: "/images/mobs/senhor_pantano.png", category: "dark_swamp", tier: 3, regionId: "dark_swamp" },
  // Montanhas Congeladas
  { id: "lobo_gelo", nameKey: "regionmob.lobo_gelo", icon: "🐺", image: "/images/mobs/lobo_gelo.png", category: "frozen_mountains", tier: 1, regionId: "frozen_mountains" },
  { id: "urso", nameKey: "regionmob.urso", icon: "🐻", image: "/images/mobs/urso.png", category: "frozen_mountains", tier: 1, regionId: "frozen_mountains" },
  { id: "troll", nameKey: "regionmob.troll", icon: "🧌", image: "/images/mobs/troll.png", category: "frozen_mountains", tier: 1, regionId: "frozen_mountains" },
  { id: "troll_gigante", nameKey: "regionmob.troll_gigante", icon: "🧌", image: "/images/mobs/troll_gigante.png", category: "frozen_mountains", tier: 2, regionId: "frozen_mountains" },
  { id: "miniboss_frozen_mountains", nameKey: "regionminiboss.rei_geada", icon: "🧊", image: "/images/mobs/rei_geada.png", category: "frozen_mountains", tier: 3, regionId: "frozen_mountains" },
  // Deserto Escaldante
  { id: "escorpiao", nameKey: "regionmob.escorpiao", icon: "🦂", image: "/images/mobs/escorpiao.png", category: "scorching_desert", tier: 1, regionId: "scorching_desert" },
  { id: "cobra_areia", nameKey: "regionmob.cobra_areia", icon: "🐍", image: "/images/mobs/cobra_areia.png", category: "scorching_desert", tier: 1, regionId: "scorching_desert" },
  { id: "abutre", nameKey: "regionmob.abutre", icon: "🦅", image: "/images/mobs/abutre.png", category: "scorching_desert", tier: 1, regionId: "scorching_desert" },
  { id: "escorpiao_imperial", nameKey: "regionmob.escorpiao_imperial", icon: "🦂", image: "/images/mobs/escorpiao_imperial.png", category: "scorching_desert", tier: 2, regionId: "scorching_desert" },
  { id: "miniboss_scorching_desert", nameKey: "regionminiboss.farao_areia", icon: "🏜️", image: "/images/mobs/farao_areia.png", category: "scorching_desert", tier: 3, regionId: "scorching_desert" },
  // Castelo Imperial
  { id: "soldado", nameKey: "regionmob.soldado", icon: "🛡️", image: "/images/mobs/soldado.png", category: "imperial_castle", tier: 1, regionId: "imperial_castle" },
  { id: "cavaleiro", nameKey: "regionmob.cavaleiro", icon: "🐴", image: "/images/mobs/cavaleiro.png", category: "imperial_castle", tier: 1, regionId: "imperial_castle" },
  { id: "mago_corte", nameKey: "regionmob.mago_corte", icon: "🧙", image: "/images/mobs/mago_corte.png", category: "imperial_castle", tier: 1, regionId: "imperial_castle" },
  { id: "capitao", nameKey: "regionmob.capitao", icon: "⚔️", image: "/images/mobs/capitao.png", category: "imperial_castle", tier: 2, regionId: "imperial_castle" },
  { id: "miniboss_imperial_castle", nameKey: "regionminiboss.general_imperial", icon: "🏰", image: "/images/mobs/general_imperial.png", category: "imperial_castle", tier: 3, regionId: "imperial_castle" },
  // Ilhas Perdidas
  { id: "polvo", nameKey: "regionmob.polvo", icon: "🐙", image: "/images/mobs/polvo.png", category: "lost_islands", tier: 1, regionId: "lost_islands" },
  { id: "tartaruga", nameKey: "regionmob.tartaruga", icon: "🐢", image: "/images/mobs/tartaruga.png", category: "lost_islands", tier: 1, regionId: "lost_islands" },
  { id: "pirata", nameKey: "regionmob.pirata", icon: "🏴‍☠️", image: "/images/mobs/pirata.png", category: "lost_islands", tier: 1, regionId: "lost_islands" },
  { id: "capitao_pirata", nameKey: "regionmob.capitao_pirata", icon: "🏴‍☠️", image: "/images/mobs/capitao_pirata.png", category: "lost_islands", tier: 2, regionId: "lost_islands" },
  { id: "miniboss_lost_islands", nameKey: "regionminiboss.kraken_filhote", icon: "🐙", image: "/images/mobs/kraken_filhote.png", category: "lost_islands", tier: 3, regionId: "lost_islands" },
  // Mundo dos Dragões
  { id: "dragao_filhote", nameKey: "regionmob.dragao_filhote", icon: "🐲", image: "/images/mobs/dragao_filhote.png", category: "dragon_world", tier: 1, regionId: "dragon_world" },
  { id: "dragao_fogo", nameKey: "regionmob.dragao_fogo", icon: "🐉", image: "/images/mobs/dragao_fogo.png", category: "dragon_world", tier: 1, regionId: "dragon_world" },
  { id: "dragao_trovao", nameKey: "regionmob.dragao_trovao", icon: "🐉", image: "/images/mobs/dragao_trovao.png", category: "dragon_world", tier: 1, regionId: "dragon_world" },
  { id: "dragao_anciao_jovem", nameKey: "regionmob.dragao_anciao_jovem", icon: "🐉", image: "/images/mobs/dragao_anciao_jovem.png", category: "dragon_world", tier: 2, regionId: "dragon_world" },
  { id: "miniboss_dragon_world", nameKey: "regionminiboss.dragao_guardião", icon: "🐉", image: "/images/mobs/dragao_guardiao.png", category: "dragon_world", tier: 3, regionId: "dragon_world" },
  // Reino Demoníaco
  { id: "demonio_menor", nameKey: "regionmob.demonio_menor", icon: "👹", image: "/images/mobs/demonio_menor.png", category: "demon_realm", tier: 1, regionId: "demon_realm" },
  { id: "imp", nameKey: "regionmob.imp", icon: "😈", image: "/images/mobs/imp.png", category: "demon_realm", tier: 1, regionId: "demon_realm" },
  { id: "cavaleiro_sombrio", nameKey: "regionmob.cavaleiro_sombrio", icon: "🌑", image: "/images/mobs/cavaleiro_sombrio.png", category: "demon_realm", tier: 1, regionId: "demon_realm" },
  { id: "general_demonio", nameKey: "regionmob.general_demonio", icon: "👹", image: "/images/mobs/general_demonio.png", category: "demon_realm", tier: 2, regionId: "demon_realm" },
  { id: "miniboss_demon_realm", nameKey: "regionminiboss.príncipe_demonio", icon: "😈", image: "/images/mobs/principe_demonio.png", category: "demon_realm", tier: 3, regionId: "demon_realm" },
  // Templo Celestial
  { id: "anjo_menor", nameKey: "regionmob.anjo_menor", icon: "😇", image: "/images/mobs/anjo_menor.png", category: "celestial_temple", tier: 1, regionId: "celestial_temple" },
  { id: "serafim_guarda", nameKey: "regionmob.serafim_guarda", icon: "🪽", image: "/images/mobs/serafim_guarda.png", category: "celestial_temple", tier: 1, regionId: "celestial_temple" },
  { id: "guardiao_celestial", nameKey: "regionmob.guardiao_celestial", icon: "✨", image: "/images/mobs/guardiao_celestial.png", category: "celestial_temple", tier: 1, regionId: "celestial_temple" },
  { id: "arcanjo", nameKey: "regionmob.arcanjo", icon: "🌟", image: "/images/mobs/arcanjo.png", category: "celestial_temple", tier: 2, regionId: "celestial_temple" },
  { id: "miniboss_celestial_temple", nameKey: "regionminiboss.arcanjo_supremo", icon: "🌟", image: "/images/mobs/arcanjo_supremo.png", category: "celestial_temple", tier: 3, regionId: "celestial_temple" },
  // Bosses regionais (tier 4 — drop diário)
  { id: "boss_starter_village", nameKey: "regionboss.slime_king", icon: "👑", image: "/images/tower/boss_rei_slime.png", category: "starter_village", tier: 4, regionId: "starter_village" },
  { id: "boss_forgotten_forest", nameKey: "regionboss.ancestral_ent", icon: "🌳", image: "/images/tower/boss_ent_ancestral.png", category: "forgotten_forest", tier: 4, regionId: "forgotten_forest" },
  { id: "boss_ancient_ruins", nameKey: "regionboss.ancient_guardian", icon: "🏛️", image: "/images/tower/boss_guardiao_antigo.png", category: "ancient_ruins", tier: 4, regionId: "ancient_ruins" },
  { id: "boss_deep_mines", nameKey: "regionboss.goblin_king", icon: "⛏️", image: "/images/tower/boss_rei_goblin.png", category: "deep_mines", tier: 4, regionId: "deep_mines" },
  { id: "boss_dark_swamp", nameKey: "regionboss.hydra", icon: "🐍", image: "/images/tower/boss_hidra.png", category: "dark_swamp", tier: 4, regionId: "dark_swamp" },
  { id: "boss_frozen_mountains", nameKey: "regionboss.yeti", icon: "🏔️", image: "/images/tower/boss_yeti.png", category: "frozen_mountains", tier: 4, regionId: "frozen_mountains" },
  { id: "boss_scorching_desert", nameKey: "regionboss.scorpion_king", icon: "🏜️", image: "/images/tower/boss_escorpiao_rei.png", category: "scorching_desert", tier: 4, regionId: "scorching_desert" },
  { id: "boss_imperial_castle", nameKey: "regionboss.dark_knight", icon: "🏰", image: "/images/tower/boss_cavaleiro_negro.png", category: "imperial_castle", tier: 4, regionId: "imperial_castle" },
  { id: "boss_lost_islands", nameKey: "regionboss.kraken", icon: "🏝️", image: "/images/tower/boss_kraken.png", category: "lost_islands", tier: 4, regionId: "lost_islands" },
  { id: "boss_dragon_world", nameKey: "regionboss.ancient_dragon", icon: "🐉", image: "/images/tower/boss_dragao_anciao.png", category: "dragon_world", tier: 4, regionId: "dragon_world" },
  { id: "boss_demon_realm", nameKey: "regionboss.demon_lord", icon: "👹", image: "/images/tower/boss_lorde_demoniaco.png", category: "demon_realm", tier: 4, regionId: "demon_realm" },
  { id: "boss_celestial_temple", nameKey: "regionboss.seraphim", icon: "⛪", image: "/images/tower/boss_serafim.png", category: "celestial_temple", tier: 4, regionId: "celestial_temple" },
];

/** Lê o estado do bestiário do personagem. */
export function bestiaryState(char: any): { defeated: Record<string, number>; claimed: string[] } {
  const b = char?.bestiary;
  if (b && typeof b === "object") {
    return {
      defeated: (b.defeated && typeof b.defeated === "object" ? b.defeated : {}) as Record<string, number>,
      claimed: Array.isArray(b.claimed) ? b.claimed : [],
    };
  }
  return { defeated: {}, claimed: [] };
}

/** Registra uma derrota no bestiário. Devolve o patch (ou null se nada mudou). */
export function registerDefeat(char: any, creatureId: string): { bestiary: { defeated: Record<string, number>; claimed: string[] } } {
  const st = bestiaryState(char);
  st.defeated[creatureId] = Math.min(9999, (st.defeated[creatureId] || 0) + 1);
  return { bestiary: st };
}

/** Criaturas de uma categoria (para a UI). */
export function entriesForCategory(category: string): BestiaryEntry[] {
  return BESTIARY_ENTRIES.filter((e) => e.category === category);
}

/** Todas as categorias (regiões) do bestiário. */
export function bestiaryCategories(): string[] {
  return [...new Set(BESTIARY_ENTRIES.map((e) => e.category))];
}

/** Progresso do bestiário (total derrotado / total). */
export function bestiaryProgress(char: any) {
  const st = bestiaryState(char);
  const total = BESTIARY_ENTRIES.length;
  const defeated = BESTIARY_ENTRIES.filter((e) => (st.defeated[e.id] || 0) > 0).length;
  return { defeated, total, pct: total > 0 ? Math.round((defeated / total) * 100) : 0 };
}

/** Recompensa de completar uma categoria. */
export function categoryReward(level: number, tierCount: number) {
  const lv = Math.max(1, Number(level) || 1);
  return {
    gold: 300 + lv * 20 + tierCount * 100,
    crystals: 2 + Math.floor(lv / 20) + tierCount,
    towerCoins: 30 + lv * 3 + tierCount * 10,
  };
}

/** Bônus permanente de dano contra a categoria (5% por categoria completa). */
export function bestiaryDamageBonus(char: any): number {
  const st = bestiaryState(char);
  let completed = 0;
  for (const cat of bestiaryCategories()) {
    const entries = entriesForCategory(cat);
    if (entries.every((e) => (st.defeated[e.id] || 0) > 0)) completed++;
  }
  return completed * 5; // +5% por categoria completa
}

/**
 * Coleta a recompensa da categoria (todas as criaturas derrotadas).
 * Devolve patch + recompensa ou erro.
 */
export function claimCategoryReward(
  char: any,
  category: string
): { patch: any; reward: { gold: number; crystals: number; towerCoins: number } } | { error: string } {
  const entries = entriesForCategory(category);
  if (entries.length === 0) return { error: "Categoria não encontrada" };
  const st = bestiaryState(char);
  if (!entries.every((e) => (st.defeated[e.id] || 0) > 0)) {
    return { error: "Derrote todas as criaturas desta categoria primeiro" };
  }
  if (st.claimed.includes(category)) return { error: "Recompensa já coletada" };

  st.claimed.push(category);
  const reward = categoryReward(Number(char.level) || 1, entries.length);
  const patch: any = { bestiary: st };
  patch.gold = (Number(char.gold) || 0) + reward.gold;
  patch.crystals = (Number(char.crystals) || 0) + reward.crystals;
  patch.towerCoins = (Number(char.towerCoins) || 0) + reward.towerCoins;
  return { patch, reward };
}
