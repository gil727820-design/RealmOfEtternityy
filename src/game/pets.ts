/**
 * Sistema de PETS 🐲 — companheiros que dão buffs permanentes ao personagem.
 *
 * Cada pet tem uma raridade (Comum → Divino) e buffs que escalam com o nível.
 * O pet equipado (`character.activePetId`) contribui:
 *   - dano %, defesa %, HP máx %, crítico (aplicados no combate da Torre);
 *   - XP % e ouro % (integrados aos multiplicadores globais — valem para
 *     missões, AFK, masmorras e Torre automaticamente);
 *   - revive (Fênix): sobrevive a um golpe fatal por batalha.
 *
 * Evolução: o pet ganha XP junto com o combate; a cada 10 níveis (10/20/30)
 * ele evolui e ganha uma estrela ★, aumentando os buffs.
 *
 * Os pets ficam salvos no documento do personagem:
 *   character.pets = [{ id, level, xp }]   (coleção)
 *   character.activePetId = "lobo_sombrio" (equipado)
 */

export type PetRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "divine";

export interface PetDef {
  id: string;
  nameKey: string;
  icon: string;
  image: string;
  rarity: PetRarity;
  desc: string;
  /** Buffs base — crescem com o nível do pet. */
  damagePct?: number; // +% dano
  xpPct?: number; // +% XP
  defensePct?: number; // +% defesa
  goldPct?: number; // +% ouro
  maxHpPct?: number; // +% HP máx
  critPct?: number; // +% crítico
  /** Revive 1x por batalha (Fênix). */
  revive?: boolean;
}

/** Ordem de raridades (para cores/ordenação). */
export const PET_RARITY_ORDER: PetRarity[] = [
  "common", "uncommon", "rare", "epic", "legendary", "mythic", "divine",
];

export const PET_MAX_LEVEL = 30;

/** Catálogo de pets disponíveis no jogo. */
export const PET_DEFS: PetDef[] = [
  {
    id: "lobo_sombrio",
    nameKey: "pet.lobo_sombrio",
    icon: "🐺",
    image: "/images/pets/pet_lobo_sombrio.png",
    rarity: "common",
    desc: "pet.lobo_sombrio.desc",
    damagePct: 0.5,
  },
  {
    id: "fada_lunar",
    nameKey: "pet.fada_lunar",
    icon: "🧚",
    image: "/images/pets/pet_fada_lunar.png",
    rarity: "uncommon",
    desc: "pet.fada_lunar.desc",
    xpPct: 0.8,
  },
  {
    id: "golem",
    nameKey: "pet.golem",
    icon: "🗿",
    image: "/images/pets/pet_golem.png",
    rarity: "rare",
    desc: "pet.golem.desc",
    defensePct: 1.0,
    maxHpPct: 0.8,
  },
  {
    id: "dragao_bebe",
    nameKey: "pet.dragao_bebe",
    icon: "🐲",
    image: "/images/pets/pet_dragao_bebe.png",
    rarity: "rare",
    desc: "pet.dragao_bebe.desc",
    goldPct: 0.5,
  },
  {
    id: "fenix",
    nameKey: "pet.fenix",
    icon: "🔥",
    image: "/images/pets/pet_fenix.png",
    rarity: "epic",
    desc: "pet.fenix.desc",
    revive: true,
    maxHpPct: 0.5,
  },
  {
    id: "tigre_espiritual",
    nameKey: "pet.tigre_espiritual",
    icon: "🐅",
    image: "/images/pets/pet_tigre_espiritual.png",
    rarity: "epic",
    desc: "pet.tigre_espiritual.desc",
    damagePct: 1.2,
    critPct: 0.5,
  },
  {
    id: "unicornio_sagrado",
    nameKey: "pet.unicornio_sagrado",
    icon: "🦄",
    image: "/images/pets/pet_unicornio_sagrado.png",
    rarity: "legendary",
    desc: "pet.unicornio_sagrado.desc",
    xpPct: 1.5,
    goldPct: 1.0,
  },
  {
    id: "dragao_anciao",
    nameKey: "pet.dragao_anciao",
    icon: "🐉",
    image: "/images/pets/pet_dragao_anciao.png",
    rarity: "mythic",
    desc: "pet.dragao_anciao.desc",
    damagePct: 2.0,
    defensePct: 1.5,
    maxHpPct: 1.2,
  },
  {
    id: "fenix_divina",
    nameKey: "pet.fenix_divina",
    icon: "🦅",
    image: "/images/pets/pet_fenix_divina.png",
    rarity: "divine",
    desc: "pet.fenix_divina.desc",
    revive: true,
    damagePct: 1.5,
    xpPct: 1.0,
    goldPct: 1.5,
    critPct: 1.0,
  },
];

export function petById(id: string | null | undefined): PetDef | null {
  if (!id) return null;
  return PET_DEFS.find((p) => p.id === id) ?? null;
}

/** Buff de um pet num dado nível — escala linearmente até o nível máximo. */
export function petBuffAtLevel(def: PetDef, level: number): Omit<PetDef, "id" | "nameKey" | "icon" | "image" | "rarity" | "desc"> {
  const lv = Math.min(PET_MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
  const scale = lv / PET_MAX_LEVEL;
  return {
    damagePct: Math.round((def.damagePct || 0) * scale * 100) / 100,
    xpPct: Math.round((def.xpPct || 0) * scale * 100) / 100,
    defensePct: Math.round((def.defensePct || 0) * scale * 100) / 100,
    goldPct: Math.round((def.goldPct || 0) * scale * 100) / 100,
    maxHpPct: Math.round((def.maxHpPct || 0) * scale * 100) / 100,
    critPct: Math.round((def.critPct || 0) * scale * 100) / 100,
    revive: def.revive === true,
  };
}

/** XP necessário para subir do nível atual para o próximo (curva suave). */
export function petXpForLevel(level: number): number {
  return Math.floor(20 + Math.pow(level, 1.6) * 12);
}

/** Estrelas de evolução: 0★ (1-9), 1★ (10-19), 2★ (20-29), 3★ (30). */
export function petStars(level: number): number {
  return Math.min(3, Math.floor(Math.max(1, Math.floor(level) || 1) / 10));
}

/** Nível do próximo marco de evolução (10/20/30) ou null se já no máximo. */
export function petNextEvolutionLevel(level: number): number | null {
  const lv = Math.max(1, Math.floor(level) || 1);
  if (lv >= PET_MAX_LEVEL) return null;
  return Math.min(PET_MAX_LEVEL, Math.ceil(lv / 10) * 10);
}

/** Pets do personagem (coleção). */
export function getPets(char: Record<string, unknown> | null | undefined): Array<{ id: string; level: number; xp: number }> {
  const pets = char?.pets;
  return Array.isArray(pets) ? (pets as Array<{ id: string; level: number; xp: number }>) : [];
}

/** Pet equipado (objeto com dados do pet + nível). */
export function getActivePet(char: Record<string, unknown> | null | undefined) {
  const activeId = char?.activePetId ? String(char.activePetId) : null;
  const def = petById(activeId);
  if (!def) return null;
  const mine = getPets(char).find((p) => p.id === def.id);
  const level = mine?.level || 1;
  return { def, level, xp: mine?.xp || 0, buffs: petBuffAtLevel(def, level) };
}

/** Soma os buffs do pet equipado (para aplicar no combate). */
export function petCombatBuff(char: Record<string, unknown> | null | undefined) {
  const pet = getActivePet(char);
  if (!pet) return null;
  return pet.buffs;
}

/** Multiplicadores globais do pet equipado (XP/ouro — integram com os boosts). */
export function petXpMult(char: Record<string, unknown> | null | undefined): number {
  const pet = getActivePet(char);
  return pet && pet.buffs.xpPct ? 1 + pet.buffs.xpPct / 100 : 1;
}

export function petGoldMult(char: Record<string, unknown> | null | undefined): number {
  const pet = getActivePet(char);
  return pet && pet.buffs.goldPct ? 1 + pet.buffs.goldPct / 100 : 1;
}

/** Adiciona um pet à coleção do personagem (se ainda não tiver). */
export function addPetToCharacter(
  char: Record<string, unknown>,
  petId: string
): Array<{ id: string; level: number; xp: number }> {
  const def = petById(petId);
  if (!def) return getPets(char);
  const pets = getPets(char);
  if (pets.some((p) => p.id === def.id)) return pets;
  return [...pets, { id: def.id, level: 1, xp: 0 }];
}

/**
 * OVOS DE PET 🥚 — como novos pets entram no jogo (loja / drops de chefes).
 *
 * O lobo sombrio é o pet inicial; os outros 8 só aparecem via ovos:
 *   - ovo básico   (loja por ouro)      → até raro
 *   - ovo raro     (loja por diamantes) → até lendário
 *   - ovo épico    (loja por diamantes) → até divino
 *
 * Pet repetido vira XP para o pet ativo (duplicata nunca é desperdício).
 */
export type PetEggQuality = "basic" | "rare" | "epic";

/** XP que uma duplicata de pet concede ao pet ativo. */
export const PET_DUPLICATE_XP = 250;

/** Peso de cada raridade no sorteio do ovo (raro = peso baixo = difícil). */
export const EGG_RARITY_WEIGHTS: Record<PetRarity, number> = {
  common: 40,
  uncommon: 28,
  rare: 17,
  epic: 9,
  legendary: 4,
  mythic: 1.5,
  divine: 0.5,
};

/** Raridade máxima de cada qualidade de ovo. */
export const EGG_MAX_RARITY: Record<PetEggQuality, PetRarity> = {
  basic: "rare",
  rare: "legendary",
  epic: "divine",
};

/**
 * Sorteia um pet de um ovo (ponderado por raridade, respeitando o teto).
 * Com `forceTop = true` (PITY garantido), o pet sai da raridade TOP do ovo.
 */
export function hatchPetEgg(quality: PetEggQuality = "basic", forceTop = false): PetDef {
  const topRarity = EGG_MAX_RARITY[quality] ?? "rare";
  const maxIdx = PET_RARITY_ORDER.indexOf(topRarity);
  const eligible = PET_DEFS.filter((p) => PET_RARITY_ORDER.indexOf(p.rarity) <= maxIdx);
  if (eligible.length === 0) return PET_DEFS[0];
  if (forceTop) {
    const tops = eligible.filter((p) => p.rarity === topRarity);
    const pool = tops.length > 0 ? tops : eligible;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const weighted = eligible.map((p) => ({ p, w: EGG_RARITY_WEIGHTS[p.rarity] ?? 1 }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.p;
  }
  return weighted[weighted.length - 1].p;
}

/**
 * Patch para ADICIONAR um pet ao personagem. Se já tiver o pet, converte a
 * duplicata em XP para o pet ativo. Retorna { patch, added, def }.
 */
export function grantPetPatch(
  char: Record<string, unknown>,
  petId: string
): { patch: Record<string, unknown>; added: boolean; def: PetDef | null } {
  const def = petById(petId);
  if (!def) return { patch: {}, added: false, def: null };
  if (getPets(char).some((p) => p.id === def.id)) {
    const xp = grantPetXp(char, PET_DUPLICATE_XP);
    return { patch: { pets: xp.pets }, added: false, def };
  }
  return { patch: { pets: addPetToCharacter(char, def.id) }, added: true, def };
}

/** Aplica XP ganho ao pet equipado (retorna patch a aplicar no personagem). */
export function grantPetXp(
  char: Record<string, unknown>,
  amount: number
): { pets: Array<{ id: string; level: number; xp: number }>; leveledUp: boolean } {
  const active = getActivePet(char);
  if (!active) return { pets: getPets(char), leveledUp: false };
  let leveledUp = false;
  const pets: Array<{ id: string; level: number; xp: number }> = getPets(char).map((p) => {
    if (p.id !== active.def.id) return p;
    let xp = (p.xp || 0) + Math.max(0, Math.floor(amount));
    let level = p.level || 1;
    while (level < PET_MAX_LEVEL && xp >= petXpForLevel(level)) {
      xp -= petXpForLevel(level);
      level += 1;
      leveledUp = true;
    }
    if (level >= PET_MAX_LEVEL) xp = 0;
    return { ...p, level, xp };
  });
  return { pets, leveledUp };
}
