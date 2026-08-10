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

// --- Torre Infinita: monstros ---
export type TowerMonsterKind =
  | "slime"
  | "lobo"
  | "aranha"
  | "esqueleto"
  | "golem"
  | "minotauro"
  | "espectro"
  | "dragao";

export const TOWER_MONSTER_IMAGES: Record<TowerMonsterKind, string> = {
  slime: "/images/tower/monsters/monstro_slime.png",
  lobo: "/images/tower/monsters/monstro_lobo.png",
  aranha: "/images/tower/monsters/monstro_aranha.png",
  esqueleto: "/images/tower/monsters/monstro_esqueleto.png",
  golem: "/images/tower/monsters/monstro_golem.png",
  minotauro: "/images/tower/monsters/monstro_minotauro.png",
  espectro: "/images/tower/monsters/monstro_espectro.png",
  dragao: "/images/tower/monsters/monstro_dragao.png",
};

export const TOWER_MONSTER_NAMES: Record<TowerMonsterKind, string> = {
  slime: "monster.slime",
  lobo: "monster.lobo",
  aranha: "monster.aranha",
  esqueleto: "monster.esqueleto",
  golem: "monster.golem",
  minotauro: "monster.minotauro",
  espectro: "monster.espectro",
  dragao: "monster.dragao",
};

// Faixas de andar -> quais NPCs aparecem na torre
export const TOWER_MONSTER_TIERS: Array<{ min: number; kinds: TowerMonsterKind[] }> = [
  { min: 1, kinds: ["slime", "lobo"] },
  { min: 5, kinds: ["aranha", "esqueleto"] },
  { min: 10, kinds: ["golem", "minotauro"] },
  { min: 15, kinds: ["espectro"] },
  { min: 20, kinds: ["dragao"] },
];

export function towerMonsterForFloor(floor: number): TowerMonsterKind {
  const tier = [...TOWER_MONSTER_TIERS].reverse().find((t) => floor >= t.min);
  const kinds = tier ? tier.kinds : TOWER_MONSTER_TIERS[0].kinds;
  return kinds[Math.floor(Math.random() * kinds.length)];
}

export function towerMonsterImage(kind: TowerMonsterKind): string {
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
