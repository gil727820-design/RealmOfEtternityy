/**
 * Sprites do guerreiro em camadas.
 *
 * Os PNGs (copiados das fontes locais para /sprites/guerreiro/{base,novos})
 * têm todos o MESMO canvas 1632×2176 (proporção 3:4), alinhados entre si.
 * Por isso o personagem pode ser composto no navegador simplesmente
 * empilhando os <img> na ordem (de trás para a frente):
 *
 *     capa → corpo → armadura → capacete → escudo → espada
 *
 * Essa é a mesma ordem usada pelo script offline (scripts/compor_guerreiro.py),
 * agora reproduzida em TSX para o site renderizar dinamicamente conforme o
 * personagem equipa/desequipa itens no inventário.
 */
export const WARRIOR_SPRITES_DIR = "/sprites/guerreiro";

export const WARRIOR_LAYERS = {
  corpo: `${WARRIOR_SPRITES_DIR}/base/00_corpo_base.png`,
  capacete: `${WARRIOR_SPRITES_DIR}/base/04_capacete.png`,
  capa_inicial: `${WARRIOR_SPRITES_DIR}/base/03_capa.png`,
  escudo_inicial: `${WARRIOR_SPRITES_DIR}/base/02_escudo.png`,
  espada_inicial: `${WARRIOR_SPRITES_DIR}/base/espada_v1_ferro.png`,
  espada_classica: `${WARRIOR_SPRITES_DIR}/novos/01_espada.PNG`,
  armadura_cavaleiro: `${WARRIOR_SPRITES_DIR}/novos/armadura_v1_cavaleiro.png`,
  armadura_negra: `${WARRIOR_SPRITES_DIR}/novos/armadura_v2_negra.png`,
  capa_real: `${WARRIOR_SPRITES_DIR}/novos/capa_v1_real.png`,
  capa_arcano: `${WARRIOR_SPRITES_DIR}/novos/capa_v2_arcano.png`,
  escudo_ferro: `${WARRIOR_SPRITES_DIR}/novos/escudo_v1_ferro.png`,
  escudo_ouro: `${WARRIOR_SPRITES_DIR}/novos/escudo_v2_ouro.png`,
  escudo_cristal: `${WARRIOR_SPRITES_DIR}/novos/escudo_v3_cristal.png`,
  espada_chama: `${WARRIOR_SPRITES_DIR}/novos/espada_v2_chama.png`,
  espada_sombra: `${WARRIOR_SPRITES_DIR}/novos/espada_v3_sombra.png`,
} as const;

export type WarriorLayerKey = keyof typeof WARRIOR_LAYERS;

/**
 * Mapa template-id → camada de sprite usada para representar o item.
 * Itens sem arte (anel, amuleto, luvas, calças, botas...) continuam usando
 * o emoji padrão (template.icon).
 */
const ITEM_SPRITE_LAYERS: Record<number, WarriorLayerKey> = {
  // armas
  4: "espada_inicial", // wooden_sword
  5: "espada_classica", // iron_sword
  6: "espada_classica", // steel_blade
  7: "espada_chama", // flame_sword
  8: "espada_sombra", // frost_staff → lâmina sombria (mais próxima)
  9: "espada_sombra", // shadow_dagger
  // armaduras
  10: "armadura_cavaleiro", // leather_armor
  11: "armadura_negra", // iron_armor
  12: "armadura_cavaleiro", // dragon_armor
  // escudos
  13: "escudo_inicial", // wooden_shield
  14: "escudo_ouro", // holy_shield → escudo de ouro
  // capacetes
  15: "capacete", // iron_helmet
  16: "capacete", // titan_helmet
};

/**
 * Retorna a URL do sprite/camada correspondente a um template de item.
 * Prioriza o mapeamento local; com fallback para o campo `sheet` do template.
 */
export function itemSpriteUrl(
  template: { id?: number; sheet?: string } | null | undefined
): string | undefined {
  if (!template) return undefined;
  if (typeof template.id === "number" && template.id in ITEM_SPRITE_LAYERS) {
    return WARRIOR_LAYERS[ITEM_SPRITE_LAYERS[template.id]];
  }
  return typeof template.sheet === "string" ? template.sheet : undefined;
}

/** Camadas equipadas no personagem (slot → entry do inventário). */
export interface EquippedPiece {
  slot?: string | null;
  template?: { id?: number; sheet?: string } | null;
}

/**
 * Monta a lista ordenada de camadas (de baixo para cima) refletindo os itens
 * equipados no guerreiro: capa → corpo → armadura → capacete → escudo → espada.
 * Se `defaultCape` for verdadeiro (true), inclui a capa inicial do kit.
 */
export function buildWarriorLayers(equipped: EquippedPiece[], defaultCape = true): string[] {
  const bySlot = new Map<string, { id?: number; sheet?: string }>();
  for (const e of equipped) {
    if (e.slot && e.template) bySlot.set(e.slot, e.template);
  }

  const layers: string[] = [];
  if (defaultCape) layers.push(WARRIOR_LAYERS.capa_inicial);
  layers.push(WARRIOR_LAYERS.corpo);

  const pick = (slot: string) => {
    const t = bySlot.get(slot);
    if (!t) return;
    const src = itemSpriteUrl(t);
    if (src) layers.push(src);
  };

  pick("armor");
  pick("helmet");
  pick("shield");
  pick("weapon");

  return layers;
}