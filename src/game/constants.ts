export const CLASS_LIST = [
  "warrior","paladin","berserker","mage","necromancer","assassin",
  "hunter","monk","samurai","knight","summoner","templar","archer"
] as const;

export type ClassName = typeof CLASS_LIST[number];

export const CLASS_ICONS: Record<ClassName, string> = {
  warrior: "⚔️", paladin: "🛡️", berserker: "🪓", mage: "🔮",
  necromancer: "💀", assassin: "🗡️", hunter: "🏹", monk: "🥋",
  samurai: "⛩️", knight: "🏰", summoner: "✨", templar: "✝️", archer: "🎯"
};

export const CLASS_IMAGES: Record<ClassName, { male: string; female: string }> = {
  warrior:     { male: "/classes/masculino/pixel_guerreiro.png",  female: "/classes/feminino/pixel_guerreira.png" },
  paladin:     { male: "/classes/masculino/pixel_paladino.png",   female: "/classes/feminino/pixel_paladina.png" },
  berserker:   { male: "/classes/masculino/pixel_berserker.png",  female: "/classes/feminino/pixel_berserker_fem.png" },
  mage:        { male: "/classes/masculino/pixel_mago.png",       female: "/classes/feminino/pixel_maga.png" },
  necromancer: { male: "/classes/masculino/pixel_necromante.png", female: "/classes/feminino/pixel_necromante_fem.png" },
  assassin:    { male: "/classes/masculino/pixel_assassino.png",  female: "/classes/feminino/pixel_assassina.png" },
  hunter:      { male: "/classes/masculino/pixel_cacador.png",    female: "/classes/feminino/pixel_cacadora.png" },
  monk:        { male: "/classes/masculino/pixel_monge.png",      female: "/classes/feminino/pixel_monja.png" },
  samurai:     { male: "/classes/masculino/pixel_samurai.png",    female: "/classes/feminino/pixel_samurai_fem.png" },
  knight:      { male: "/classes/masculino/pixel_cavaleiro.png",  female: "/classes/feminino/pixel_cavaleira.png" },
  summoner:    { male: "/classes/masculino/pixel_invocador.png",  female: "/classes/feminino/pixel_invocadora.png" },
  templar:     { male: "/classes/masculino/pixel_templario.png",  female: "/classes/feminino/pixel_templaria.png" },
  archer:      { male: "/classes/masculino/pixel_arqueiro.png",   female: "/classes/feminino/pixel_arqueira.png" },
};

export function classImage(classType: ClassName, sex: string): string {
  return CLASS_IMAGES[classType]?.[sex === "female" ? "female" : "male"] ?? CLASS_IMAGES.warrior.male;
}

// Nome do golpe especial (golpe poderoso) por classe — cada classe com seu estilo
export const CLASS_SKILL_NAMES: Record<ClassName, { pt: string; en: string }> = {
  warrior:     { pt: "Fúria do Guerreiro", en: "Warrior's Fury" },
  paladin:     { pt: "Lâmina Sagrada",      en: "Holy Blade" },
  berserker:   { pt: "Fúria Brutal",        en: "Brutal Rage" },
  mage:        { pt: "Explosão Arcana",     en: "Arcane Blast" },
  necromancer: { pt: "Toque da Morte",      en: "Death Touch" },
  assassin:    { pt: "Lâmina Sombria",      en: "Shadow Blade" },
  hunter:      { pt: "Disparo Certeiro",    en: "Sure Shot" },
  monk:        { pt: "Punho Supremo",       en: "Supreme Fist" },
  samurai:     { pt: "Corte da Lâmina",     en: "Blade Cut" },
  knight:      { pt: "Investida Nobre",     en: "Noble Charge" },
  summoner:    { pt: "Legião Invocada",     en: "Summoned Legion" },
  templar:     { pt: "Punição Divina",      en: "Divine Punishment" },
  archer:      { pt: "Chuva de Flechas",    en: "Arrow Storm" },
};

export function classSkillName(classType: ClassName, locale: string): string {
  const bare = (locale || "").toLowerCase().startsWith("pt") ? "pt" : "en";
  return CLASS_SKILL_NAMES[classType]?.[bare] ?? (bare === "pt" ? "Golpe Poderoso" : "Powerful Strike");
}

/**
 * Efeito mecânico do golpe especial por classe — cada classe joga de um jeito
 * (não é só um multiplicador igual para todo mundo). Diferenças:
 *  - dano extra (% do ataque), bônus de crítico
 *  - fúria/rage: dano alto com penalidade de defesa
 *  - magia: ignora parte da defesa inimiga
 *  - destreza: chance extra de golpe duplo
 *  - cura/sangramento ligados às classes de suporte
 */
export interface ClassSkillEffect {
  /** Multiplicador sobre o ataque BASE para o golpe especial. */
  dmgMult: number;
  /** Bônus percentual de crítico durante o golpe especial. */
  critBonus: number;
  /** Multiplicador de dano RECEBIDO durante/por causa do golpe (≥1 = penalidade, <1 = é resistente). */
  receivedMult?: number;
  /** % da defesa inimiga ignorada neste golpe (0–1). */
  pierce?: number;
  /** Chance (%) de acertar 1 ataque extra básico (+dano sem crítico). */
  doubleStrikeChance?: number;
  /** Chance (%) de aplicar sangramento (dano ao longo da luta vs monstro). */
  bleedChance?: number;
  /** Cura fixa (% do HP máx) ao usar o golpe. */
  healOnUse?: number;
  /** Custo de mana do golpe (padrão das outras rotas: 15). */
  manaCost?: number;
}

export const CLASS_SKILL_EFFECTS: Record<ClassName, ClassSkillEffect> = {
  warrior:     { dmgMult: 1.7,  critBonus: 5 },
  paladin:     { dmgMult: 1.5,  critBonus: 5,  receivedMult: 0.8, healOnUse: 0.06 },
  berserker:   { dmgMult: 2.1,  critBonus: 8,  receivedMult: 1.25 },
  mage:        { dmgMult: 1.6,  critBonus: 10, pierce: 0.3 },
  necromancer: { dmgMult: 1.5,  critBonus: 5,  bleedChance: 55 },
  assassin:    { dmgMult: 1.45, critBonus: 18, doubleStrikeChance: 40 },
  hunter:      { dmgMult: 1.5,  critBonus: 15, pierce: 0.3 },
  monk:        { dmgMult: 1.75, critBonus: 8,  receivedMult: 0.85 },
  samurai:     { dmgMult: 1.9,  critBonus: 12 },
  knight:      { dmgMult: 1.55, critBonus: 5,  receivedMult: 0.75 },
  summoner:    { dmgMult: 1.55, critBonus: 7,  bleedChance: 45 },
  templar:     { dmgMult: 1.5,  critBonus: 6,  receivedMult: 0.82, healOnUse: 0.05 },
  archer:      { dmgMult: 1.4,  critBonus: 15, pierce: 0.4 },
};

export function classSkillEffect(classType: ClassName): ClassSkillEffect {
  return CLASS_SKILL_EFFECTS[classType] ?? CLASS_SKILL_EFFECTS.warrior;
}

// --- Torre Infinita: monstros ---
// Mobs dos andares comuns (visuais novos da pasta MOBS) + os 8 originais.
export type TowerMonsterKind =
  | "slime"
  | "lobo"
  | "aranha"
  | "esqueleto"
  | "golem"
  | "minotauro"
  | "espectro"
  | "dragao"
  | "sentinela_pedra"
  | "assassino_sombras"
  | "mago_caos"
  | "gargula_ferro"
  | "cavaleiro_corrompido"
  | "invocador_almas"
  | "beholder_vigilancia"
  | "lich_trono"
  | "avatar_eternidade"
  | "quimera_torre";

// Chefes (todo andar múltiplo de 10) — visuais "Realm of Eternity".
export type TowerBossKind =
  | "coral_kraken"
  | "crystal_basilisk"
  | "eclipse_lich"
  | "ember_phoenix"
  | "glacier_troll"
  | "mushroom_brute"
  | "root_guardian"
  | "sand_scorpion"
  | "steam_automaton"
  | "thunder_roc"
  | "void_wyrm";

export const TOWER_MONSTER_IMAGES: Record<TowerMonsterKind | TowerBossKind, string> = {
  slime: "/images/tower/monsters/monstro_slime.png",
  lobo: "/images/tower/monsters/monstro_lobo.png",
  aranha: "/images/tower/monsters/monstro_aranha.png",
  esqueleto: "/images/tower/monsters/monstro_esqueleto.png",
  golem: "/images/tower/monsters/monstro_golem.png",
  minotauro: "/images/tower/monsters/monstro_minotauro.png",
  espectro: "/images/tower/monsters/monstro_espectro.png",
  dragao: "/images/tower/monsters/monstro_dragao.png",
  sentinela_pedra: "/images/tower/monsters/mob_sentinela_pedra.png",
  assassino_sombras: "/images/tower/monsters/mob_assassino_sombras.png",
  mago_caos: "/images/tower/monsters/mob_mago_caos.png",
  gargula_ferro: "/images/tower/monsters/mob_gargula_ferro.png",
  cavaleiro_corrompido: "/images/tower/monsters/mob_cavaleiro_corrompido.png",
  invocador_almas: "/images/tower/monsters/mob_invocador_almas.png",
  beholder_vigilancia: "/images/tower/monsters/mob_beholder_vigilancia.png",
  lich_trono: "/images/tower/monsters/mob_lich_trono.png",
  avatar_eternidade: "/images/tower/monsters/mob_avatar_eternidade.png",
  quimera_torre: "/images/tower/monsters/mob_quimera_torre.png",
  coral_kraken: "/images/tower/monsters/realm_of_eternity_coral_kraken_clean.png",
  crystal_basilisk: "/images/tower/monsters/realm_of_eternity_crystal_basilisk_clean.png",
  eclipse_lich: "/images/tower/monsters/realm_of_eternity_eclipse_lich_clean.png",
  ember_phoenix: "/images/tower/monsters/realm_of_eternity_ember_phoenix_clean.png",
  glacier_troll: "/images/tower/monsters/realm_of_eternity_glacier_troll_clean.png",
  mushroom_brute: "/images/tower/monsters/realm_of_eternity_mushroom_brute_clean.png",
  root_guardian: "/images/tower/monsters/realm_of_eternity_root_guardian_final.png",
  sand_scorpion: "/images/tower/monsters/realm_of_eternity_sand_scorpion_clean.png",
  steam_automaton: "/images/tower/monsters/realm_of_eternity_steam_automaton_clean.png",
  thunder_roc: "/images/tower/monsters/realm_of_eternity_thunder_roc_clean.png",
  void_wyrm: "/images/tower/monsters/realm_of_eternity_void_wyrm_clean.png",
};

export const TOWER_MONSTER_NAMES: Record<TowerMonsterKind | TowerBossKind, string> = {
  slime: "monster.slime",
  lobo: "monster.lobo",
  aranha: "monster.aranha",
  esqueleto: "monster.esqueleto",
  golem: "monster.golem",
  minotauro: "monster.minotauro",
  espectro: "monster.espectro",
  dragao: "monster.dragao",
  sentinela_pedra: "monster.sentinela_pedra",
  assassino_sombras: "monster.assassino_sombras",
  mago_caos: "monster.mago_caos",
  gargula_ferro: "monster.gargula_ferro",
  cavaleiro_corrompido: "monster.cavaleiro_corrompido",
  invocador_almas: "monster.invocador_almas",
  beholder_vigilancia: "monster.beholder_vigilancia",
  lich_trono: "monster.lich_trono",
  avatar_eternidade: "monster.avatar_eternidade",
  quimera_torre: "monster.quimera_torre",
  coral_kraken: "monster.coral_kraken",
  crystal_basilisk: "monster.crystal_basilisk",
  eclipse_lich: "monster.eclipse_lich",
  ember_phoenix: "monster.ember_phoenix",
  glacier_troll: "monster.glacier_troll",
  mushroom_brute: "monster.mushroom_brute",
  root_guardian: "monster.root_guardian",
  sand_scorpion: "monster.sand_scorpion",
  steam_automaton: "monster.steam_automaton",
  thunder_roc: "monster.thunder_roc",
  void_wyrm: "monster.void_wyrm",
};

// Faixas de andar -> quais NPCs aparecem na torre (andares comuns, sem boss).
export const TOWER_MONSTER_TIERS: Array<{ min: number; kinds: TowerMonsterKind[] }> = [
  { min: 1, kinds: ["slime", "lobo", "sentinela_pedra"] },
  { min: 5, kinds: ["aranha", "esqueleto", "mago_caos", "assassino_sombras"] },
  { min: 10, kinds: ["golem", "minotauro", "gargula_ferro", "cavaleiro_corrompido"] },
  { min: 15, kinds: ["espectro", "invocador_almas", "beholder_vigilancia"] },
  { min: 20, kinds: ["dragao", "lich_trono", "avatar_eternidade"] },
  { min: 30, kinds: ["quimera_torre"] },
];

// Mix adicional por faixa: soma aos kinds acima para dar mais variedade sem
// repetir o mesmo bicho toda hora (o usuário via ~5 sempre iguais).
export const TOWER_MONSTER_TIERS_BONUS: Array<{ min: number; kinds: TowerMonsterKind[] }> = [
  { min: 1, kinds: ["esqueleto", "aranha"] },
  { min: 5, kinds: ["slime", "espectro"] },
  { min: 10, kinds: ["assassino_sombras", "invocador_almas"] },
  { min: 15, kinds: ["beholder_vigilancia", "gargula_ferro"] },
  { min: 20, kinds: ["espectro", "mago_caos"] },
  { min: 30, kinds: ["avatar_eternidade", "lich_trono", "cavaleiro_corrompido"] },
];

// Chefes da torre: um diferente a cada 10 andares, ciclando.
export const TOWER_BOSS_KINDS: TowerBossKind[] = [
  "coral_kraken",
  "crystal_basilisk",
  "eclipse_lich",
  "ember_phoenix",
  "glacier_troll",
  "mushroom_brute",
  "root_guardian",
  "sand_scorpion",
  "steam_automaton",
  "thunder_roc",
  "void_wyrm",
];

export function towerBossForFloor(floor: number): TowerBossKind {
  const i = Math.floor(floor / 10) - 1; // andar 10 → 0, 20 → 1...
  const idx = ((i % TOWER_BOSS_KINDS.length) + TOWER_BOSS_KINDS.length) % TOWER_BOSS_KINDS.length;
  return TOWER_BOSS_KINDS[idx];
}

// Faixa de andar -> qual monstro aparece (comum, sem boss). Mistura base + bônus
// para variar bastante: evita repetir os mesmos ~5 toda hora.
export function towerMonsterForFloor(floor: number): TowerMonsterKind | TowerBossKind {
  if (floor % 10 === 0) return towerBossForFloor(floor);
  const tier = [...TOWER_MONSTER_TIERS].reverse().find((t) => floor >= t.min);
  let kinds = tier ? tier.kinds : TOWER_MONSTER_TIERS[0].kinds;
  const bonus = [...TOWER_MONSTER_TIERS_BONUS].reverse().find((t) => floor >= t.min);
  if (bonus) kinds = [...kinds, ...bonus.kinds];
  return kinds[Math.floor(Math.random() * kinds.length)];
}

export function isTowerMonsterKind(kind: any): kind is TowerMonsterKind | TowerBossKind {
  return typeof kind === "string" && kind in TOWER_MONSTER_IMAGES;
}

export function towerMonsterImage(kind: TowerMonsterKind | TowerBossKind): string {
  return TOWER_MONSTER_IMAGES[kind] ?? TOWER_MONSTER_IMAGES.slime;
}

export const CLASS_BASE_STATS: Record<ClassName, {hp:number;attack:number;defense:number;speed:number;mana:number;critical:number}> = {
  warrior:     { hp: 120, attack: 12, defense: 10, speed: 4, mana: 30, critical: 3 },
  paladin:     { hp: 130, attack: 10, defense: 12, speed: 3, mana: 60, critical: 2 },
  berserker:   { hp: 100, attack: 18, defense: 5,  speed: 6, mana: 20, critical: 8 },
  mage:        { hp: 70,  attack: 16, defense: 4,  speed: 5, mana: 100, critical: 5 },
  necromancer: { hp: 80,  attack: 14, defense: 5,  speed: 4, mana: 90, critical: 4 },
  assassin:    { hp: 75,  attack: 15, defense: 3,  speed: 10, mana: 40, critical: 15 },
  hunter:      { hp: 85,  attack: 14, defense: 5,  speed: 8, mana: 35, critical: 10 },
  monk:        { hp: 95,  attack: 11, defense: 8,  speed: 9, mana: 50, critical: 6 },
  samurai:     { hp: 90,  attack: 16, defense: 7,  speed: 7, mana: 35, critical: 12 },
  knight:      { hp: 140, attack: 8,  defense: 15, speed: 2, mana: 25, critical: 2 },
  summoner:    { hp: 75,  attack: 13, defense: 4,  speed: 5, mana: 95, critical: 4 },
  templar:     { hp: 110, attack: 12, defense: 11, speed: 4, mana: 55, critical: 3 },
  archer:      { hp: 80,  attack: 15, defense: 4,  speed: 8, mana: 30, critical: 12 },
};

/**
 * Limite de investimento de status POR CLASSE.
 *
 * Cada classe tem um papel (DPS, tank, suporte/caster) e NÃO pode virar outra:
 * um mago não pode virar tanque, um cavaleiro não alcança o DPS de um berserker
 * etc. O valor é o MÁXIMO alcançável em cada status (base da classe + pontos
 * investidos, SEM contar itens equipados — equipamentos ainda somam por cima).
 */
export type AllocStatKey =
  | "attack" | "defense" | "speed" | "hp" | "mana"
  | "critical" | "precision" | "dodge" | "resistance";

export const CLASS_STAT_CAPS: Record<ClassName, Record<AllocStatKey, number>> = {
  // DPS puro: ataque/crítico altos, frágil
  berserker:   { attack: 190, defense: 55,  speed: 85,  hp: 400, mana: 160, critical: 65, precision: 25, dodge: 25, resistance: 20 },
  samurai:     { attack: 180, defense: 90,  speed: 100, hp: 450, mana: 220, critical: 55, precision: 35, dodge: 35, resistance: 35 },
  assassin:    { attack: 160, defense: 45,  speed: 130, hp: 280, mana: 220, critical: 60, precision: 45, dodge: 50, resistance: 20 },
  archer:      { attack: 160, defense: 55,  speed: 110, hp: 320, mana: 200, critical: 55, precision: 55, dodge: 45, resistance: 25 },
  hunter:      { attack: 150, defense: 65,  speed: 100, hp: 340, mana: 220, critical: 50, precision: 50, dodge: 35, resistance: 25 },
  // Híbrido / equilibrado
  warrior:     { attack: 140, defense: 120, speed: 70,  hp: 550, mana: 220, critical: 45, precision: 35, dodge: 35, resistance: 35 },
  monk:        { attack: 110, defense: 140, speed: 100, hp: 550, mana: 270, critical: 40, precision: 35, dodge: 40, resistance: 50 },
  // Caster / suporte: mana altíssima, frágil fisicamente
  mage:        { attack: 160, defense: 45,  speed: 65,  hp: 280, mana: 520, critical: 40, precision: 25, dodge: 20, resistance: 25 },
  necromancer: { attack: 140, defense: 55,  speed: 55,  hp: 320, mana: 470, critical: 35, precision: 25, dodge: 20, resistance: 30 },
  summoner:    { attack: 130, defense: 55,  speed: 65,  hp: 300, mana: 500, critical: 35, precision: 25, dodge: 20, resistance: 30 },
  // Tank: defesa/vida altíssimas, ataque baixo
  knight:      { attack: 75,  defense: 210, speed: 35,  hp: 850, mana: 160, critical: 20, precision: 15, dodge: 15, resistance: 90 },
  paladin:     { attack: 90,  defense: 170, speed: 45,  hp: 750, mana: 320, critical: 25, precision: 20, dodge: 20, resistance: 70 },
  templar:     { attack: 90,  defense: 170, speed: 50,  hp: 700, mana: 340, critical: 25, precision: 20, dodge: 20, resistance: 80 },
};

/** Cap de um status específico para uma classe (retorna null se não houver limite). */
export function classStatCap(classType: ClassName | string, stat: AllocStatKey): number | null {
  const caps = CLASS_STAT_CAPS[(classType as ClassName) ?? "warrior"];
  return caps?.[stat] ?? null;
}

// Custo (em ouro) do botão de resetar atributos (Dashboard).
export const STAT_RESET_COST = 100_000;

// Fundo de tela cheia (MAPA/) + tema (accent) de cada ilha.
export const REGIONS = [
  { id: "starter_village", icon: "🏘️", minLevel: 1, image: "/images/islands/regiao_vila_inicial.png", bg: "/images/map_bg/bg_vila_inicial.png", accent: "#e94560" },
  { id: "forgotten_forest", icon: "🌲", minLevel: 5, image: "/images/islands/regiao_floresta_esquecida.png", bg: "/images/map_bg/bg_floresta_esquecida.png", accent: "#4ecdc4" },
  { id: "ancient_ruins", icon: "🏛️", minLevel: 10, image: "/images/islands/regiao_ruinas_antigas.png", bg: "/images/map_bg/bg_ruinas_antigas.png", accent: "#d4a373" },
  { id: "deep_mines", icon: "⛏️", minLevel: 15, image: "/images/islands/regiao_minas_profundas.png", bg: "/images/map_bg/bg_minas_profundas.png", accent: "#a855f7" },
  { id: "dark_swamp", icon: "🐊", minLevel: 20, image: "/images/islands/regiao_pantano_sombrio.png", bg: "/images/map_bg/bg_pantano_sombrio.png", accent: "#22c55e" },
  { id: "frozen_mountains", icon: "🏔️", minLevel: 30, image: "/images/islands/regiao_montanhas_geladas.png", bg: "/images/map_bg/bg_montanhas_geladas.png", accent: "#60a5fa" },
  { id: "scorching_desert", icon: "🏜️", minLevel: 40, image: "/images/islands/regiao_deserto_escaldante.png", bg: "/images/map_bg/bg_deserto_escaldante.png", accent: "#f59e0b" },
  { id: "imperial_castle", icon: "🏰", minLevel: 50, image: "/images/islands/regiao_castelo_imperial.png", bg: "/images/map_bg/bg_castelo_imperial.png", accent: "#3b82f6" },
  { id: "lost_islands", icon: "🏝️", minLevel: 60, image: "/images/islands/regiao_ilhas_perdidas.png", bg: "/images/map_bg/bg_ilhas_perdidas.png", accent: "#00b4d8" },
  { id: "dragon_world", icon: "🐉", minLevel: 75, image: "/images/islands/regiao_mundo_dragoes.png", bg: "/images/map_bg/bg_mundo_dragoes.png", accent: "#ef4444" },
  { id: "demon_realm", icon: "👹", minLevel: 90, image: "/images/islands/regiao_reino_demoniaco.png", bg: "/images/map_bg/bg_reino_demoniaco.png", accent: "#c026d3" },
  { id: "celestial_temple", icon: "⛪", minLevel: 100, image: "/images/islands/regiao_templo_celestial.png", bg: "/images/map_bg/bg_templo_celestial.png", accent: "#facc15" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

// Aplica um acento (hex rgba) com o canal alpha informado.
export const regionWithAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ef4444",
  divine: "#06b6d4",
  ancestral: "#ec4899",
  supreme: "#fbbf24",
};

export const PVP_LEAGUES = [
  { id: "bronze", minRating: 0, icon: "🥉", image: "/images/icons/liga_bronze.png" },
  { id: "silver", minRating: 300, icon: "🥈", image: "/images/icons/liga_prata.png" },
  { id: "gold", minRating: 600, icon: "🥇", image: "/images/icons/liga_ouro.png" },
  { id: "platinum", minRating: 1000, icon: "💎", image: "/images/icons/liga_platina.png" },
  { id: "diamond", minRating: 1400, icon: "💠", image: "/images/icons/liga_diamante.png" },
  { id: "master", minRating: 1800, icon: "👑", image: "/images/icons/liga_mestre.png" },
  { id: "legend", minRating: 2300, icon: "🌟", image: "/images/icons/liga_lenda.png" },
  { id: "emperor", minRating: 2800, icon: "🔱", image: "/images/icons/liga_imperador.png" },
] as const;

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

/**
 * XP efetivo de uma missão.
 *
 * Em vez de um valor fixo (que fica irrelevante em níveis altos), a recompensa
 * escala com a curva de níveis: uma missão rende ~MISSION_XP_RATIO do XP
 * necessário para subir de nível no nível da própria missão. Isso mantém um
 * ritmo consistente (~2-3 missões do seu tier ≈ 1 nível) — nem fácil demais
 * no fim do jogo, nem impossível no começo.
 */
const MISSION_XP_RATIO = 0.32;
export function missionXpReward(mission: { minLevel?: number; xpReward?: number }): number {
  const lv = Math.max(1, mission.minLevel ?? 1);
  const scaled = Math.floor(xpForLevel(lv) * MISSION_XP_RATIO);
  const base = Math.floor((mission.xpReward ?? 0) * 1.35);
  return Math.max(scaled, base);
}

export function powerCalc(c: { attack: number; defense: number; hp: number; speed: number; critical: number; level: number }): number {
  return Math.floor(c.attack * 2 + c.defense * 1.5 + c.hp * 0.5 + c.speed * 1.2 + c.critical * 1.8 + c.level * 5);
}

/**
 * Mapeia o nameKey de cada missão para a imagem correspondente.
 * Missões sem imagem continuam usando o emoji padrão do template.
 */
export const MISSION_IMAGES: Record<string, string> = {
  "mission.patrol_village": "/images/icons/missao_patrulhar_vila.png",
  "mission.kill_slimes": "/images/icons/missao_exterminar_slimes.png",
  "mission.deliver_letter": "/images/icons/missao_entregar_carta.png",
  "mission.fish_river": "/images/icons/missao_pescar_rio.png",
  "mission.help_farmer": "/images/icons/missao_ajudar_fazendeiro.png",
  "mission.collect_fruits": "/images/icons/missao_colher_frutas.png",
  "mission.light_torches": "/images/icons/missao_acender_tochas.png",
  "mission.gather_herbs": "/images/icons/missao_coletar_ervas.png",
  "mission.collect_wood": "/images/icons/missao_coletar_madeira.png",
  "mission.catch_chickens": "/images/icons/missao_recolher_galinhas.png",
  "mission.clean_well": "/images/icons/missao_limpar_poco.png",
  "mission.fix_bridge": "/images/icons/missao_consertar_ponte.png",
  "mission.escort_merchant": "/images/icons/missao_escoltar_mercador.png",
  "mission.hunt_wolves": "/images/icons/missao_cacar_lobos.png",
  "mission.scout_forest": "/images/icons/missao_explorar_floresta.png",
  "mission.explore_ruins": "/images/icons/missao_explorar_ruinas.png",
  "mission.seek_artifact": "/images/icons/missao_buscar_artefato.png",
  "mission.mine_ore": "/images/icons/missao_minerar_minerio.png",
  "mission.clear_cave": "/images/icons/missao_limpar_caverna.png",
  "mission.fight_undead": "/images/icons/missao_combater_mortos_vivos.png",
  "mission.tame_beast": "/images/icons/missao_domar_fera.png",
  "mission.defeat_bandit": "/images/icons/missao_derrotar_bandidos.png",
  "mission.defend_wall": "/images/icons/missao_defender_muralha.png",
  "mission.guard_fountain": "/images/icons/missao_guardar_fonte.png",
  "mission.help_blacksmith": "/images/icons/missao_ajudar_ferreiro.png",
  "mission.clean_camp": "/images/icons/missao_limpar_acampamento.png",
  "mission.gather_mushrooms": "/images/icons/missao_colher_cogumelos.png",
};

export function missionImage(nameKey: string): string | undefined {
  return MISSION_IMAGES[nameKey];
}

export function leagueForRating(rating: number): string {
  let league = "bronze";
  for (const l of PVP_LEAGUES) {
    if (rating >= l.minRating) league = l.id;
  }
  return league;
}
