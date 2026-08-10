import type { ClassName } from "./constants";

/**
 * Sistema "SKIN FULL".
 *
 * Catálogo estático das skins por classe (pacotes vindos de MMORPG/CLASSE),
 * servidos pelo Next em /skins/<classe>/<arquivo>. PNGs em public/skins.
 *
 * As skins de um personagem ficam persistidas em characters.json no campo
 * `skins` (array de ids). O Admin concede/remove via /api/admin (give_skin).
 *
 * Obs.: o pacote PACOTE CACADOR traz PNGs "arqueiro_*"; aqui elas são
 * atribuídas à classe `hunter` (Caçador), conforme o nome do pacote.
 */
export type SkinRarity = "epic" | "legendary" | "mythic";

export interface SkinTemplate {
  id: string;
  className: ClassName;
  nameKey: string;
  rarity: SkinRarity;
  image: string;
}

export const SKIN_CATALOG: SkinTemplate[] = [
  // PACOTE ASSASINO
  { id: "assassin_corte",  className: "assassin",     nameKey: "skin.assassin.corte",  rarity: "legendary", image: "/skins/assassin/assassino_skin_corte.png" },
  { id: "assassin_veneno", className: "assassin",     nameKey: "skin.assassin.veneno", rarity: "epic",      image: "/skins/assassin/assassino_skin_veneno.png" },

  // PACOTE BERSKER
  { id: "berserker_glacial", className: "berserker",  nameKey: "skin.berserker.glacial", rarity: "epic",      image: "/skins/berserker/berserker_skin_glacial.png" },
  { id: "berserker_lava",    className: "berserker",  nameKey: "skin.berserker.lava",    rarity: "legendary", image: "/skins/berserker/berserker_skin_lava.png" },

  // PACOTE CACADOR (arqueiro_* → hunter)
  { id: "hunter_dourada", className: "hunter",        nameKey: "skin.hunter.dourada", rarity: "legendary", image: "/skins/hunter/arqueiro_skin_dourada.png" },
  { id: "hunter_prata",   className: "hunter",        nameKey: "skin.hunter.prata",   rarity: "epic",      image: "/skins/hunter/arqueiro_skin_prata.png" },

  // PACOTE CAVALEIRO
  { id: "knight_dragon", className: "knight",         nameKey: "skin.knight.dragon", rarity: "epic",      image: "/skins/knight/cavaleiro_skin_dragon.png" },
  { id: "knight_holy",   className: "knight",         nameKey: "skin.knight.holy",   rarity: "legendary", image: "/skins/knight/cavaleiro_skin_holy.png" },

  // PACOTE GUERREIRO
  { id: "warrior_real_01", className: "warrior",      nameKey: "skin.warrior.real_01", rarity: "legendary", image: "/skins/warrior/skin_real_01_full.png" },
  { id: "warrior_real_02", className: "warrior",      nameKey: "skin.warrior.real_02", rarity: "mythic",    image: "/skins/warrior/skin_real_02_full.png" },

  // PACOTE INVOCADOR
  { id: "summoner_druida", className: "summoner",     nameKey: "skin.summoner.druida", rarity: "epic",      image: "/skins/summoner/invocador_skin_druida.png" },
  { id: "summoner_necro",  className: "summoner",     nameKey: "skin.summoner.necro",  rarity: "legendary", image: "/skins/summoner/invocador_skin_necro.png" },

  // PACOTE MAGO
  { id: "mage_fogo", className: "mage",               nameKey: "skin.mage.fogo", rarity: "epic",      image: "/skins/mage/mago_skin_fogo.png" },
  { id: "mage_vento", className: "mage",              nameKey: "skin.mage.vento", rarity: "legendary", image: "/skins/mage/mago_skin_vento.png" },

  // PACOTE MONGE
  { id: "monk_drao",  className: "monk",              nameKey: "skin.monk.drao", rarity: "epic",      image: "/skins/monk/monge_skin_drao.png" },
  { id: "monk_tigre", className: "monk",              nameKey: "skin.monk.tigre", rarity: "legendary", image: "/skins/monk/monge_skin_tigre.png" },

  // PACOTE NECROMANTE
  { id: "necromancer_praga",  className: "necromancer", nameKey: "skin.necromancer.praga",  rarity: "legendary", image: "/skins/necromancer/necromante_skin_praga.png" },
  { id: "necromancer_sangue", className: "necromancer", nameKey: "skin.necromancer.sangue", rarity: "mythic",    image: "/skins/necromancer/necromante_skin_sangue.png" },

  // PACOTE PALADINO
  { id: "paladin_lua", className: "paladin",           nameKey: "skin.paladin.lua", rarity: "epic",      image: "/skins/paladin/paladino_skin_lua.png" },
  { id: "paladin_sol", className: "paladin",           nameKey: "skin.paladin.sol", rarity: "legendary", image: "/skins/paladin/paladino_skin_sol.png" },

  // PACOTE SAMURAI
  { id: "samurai_fogo", className: "samurai",          nameKey: "skin.samurai.fogo", rarity: "epic",      image: "/skins/samurai/samurai_skin_fogo.png" },
  { id: "samurai_gelo", className: "samurai",          nameKey: "skin.samurai.gelo", rarity: "legendary", image: "/skins/samurai/samurai_skin_gelo.png" },

  // PACOTE TEMPLARIO
  { id: "templar_fogo", className: "templar",          nameKey: "skin.templar.fogo", rarity: "legendary", image: "/skins/templar/templario_skin_fogo.png" },
  { id: "templar_mar",  className: "templar",          nameKey: "skin.templar.mar",  rarity: "epic",      image: "/skins/templar/templario_skin_mar.png" },
];

export function skinById(id: string): SkinTemplate | null {
  return SKIN_CATALOG.find((s) => s.id === id) ?? null;
}

/**
 * Retorna a imagem padrão de perfil do personagem. Quando uma skin estiver
 * equipada, o perfil passa a exibir a imagem da skin (ex.: Samurai). Ao
 * desequipar, o sistema reverterá ao avatar da classe.
 */
export function characterAvatar(character: Record<string, unknown> | null | undefined): string {
  const equipped = (character as any)?.equippedSkin;
  const equippedSkin = equipped ? skinById(String(equipped)) : null;
  if (equippedSkin) return equippedSkin.image;
  const cls = String((character as any)?.className ?? "warrior");
  return `/avatars/${cls}.png`;
}