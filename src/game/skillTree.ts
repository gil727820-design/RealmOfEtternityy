import type { ClassName } from "./constants";

/**
 * Árvore de Habilidades — 10 habilidades por classe, fracas e balanceadas
 * (cada classe tem 9 passivas leves + 1 debuff exclusivo do golpe especial).
 *
 * - PASSIVA: bônus pequeno e permanente (atk/def/hp/crit/precisão/esquiva/vel).
 * - DEBUFF:  efeito aplicado ao inimigo quando você usa o GOLPE ESPECIAL da
 *    classe em batalha (torre/PvP). Cada classe tem um debuff com tema próprio.
 *
 * Pontos: o personagem ganha 1 ponto de habilidade a cada 3 níveis.
 * Custo: 1 ponto por rank (máx. 3 ranks por habilidade). As habilidades
 * desbloqueiam progressivamente conforme você investe pontos na árvore.
 */

export type DebuffType =
  | "bleed"   // sangramento: dano extra imediato (% do ataque)
  | "burn"    // queimadura: dano extra imediato (% do ataque)
  | "poison"  // veneno: dano extra imediato (% do ataque)
  | "weaken"  // enfraquecer: inimigo causa -% de dano no contra-ataque
  | "sunder"  // quebrar armadura: o golpe ignora % da defesa inimiga
  | "curse"   // maldição: o golpe causa +% de dano
  | "slow"    // lentidão: inimigo causa -% de dano e tem -% de esquiva
  | "blind";  // cegueira: inimigo tem -% de chance de crítico no contra-ataque

export type PassiveStat =
  | "attack" | "defense" | "speed" | "maxHp"
  | "critical" | "precision" | "dodge";

export interface SkillDef {
  id: string;
  icon: string;
  name: { pt: string; en: string; es: string };
  desc: { pt: string; en: string; es: string };
  maxRank: number;
  /** Pontos de habilidade por rank. */
  costPerRank: number;
  /** Total de ranks investidos na árvore para desbloquear (0 = livre). */
  requiresRanks: number;
  passive?: { stat: PassiveStat; valuePerRank: number };
  debuff?: { type: DebuffType; valuePerRank: number };
}

type Loc = { pt: string; en: string; es: string };
const L = (pt: string, en: string, es: string): Loc => ({ pt, en, es });

// ---------------------------------------------------------------- valores
/** Bônus fraco por rank de cada passiva. */
const PASSIVE_VALUES: Record<PassiveStat, number> = {
  attack: 1,
  defense: 1,
  speed: 1,
  maxHp: 5,
  critical: 0.5,
  precision: 1,
  dodge: 1,
};

/** Bônus fraco por rank de cada debuff. */
const DEBUFF_VALUES: Record<DebuffType, number> = {
  bleed: 2,
  burn: 2,
  poison: 2,
  weaken: 3,
  sunder: 5,
  curse: 3,
  slow: 2,
  blind: 3,
};

const PASSIVE_DESC: Record<PassiveStat, { pt: string; en: string; es: string }> = {
  attack:    { pt: "+{v} de Ataque por rank.",      en: "+{v} Attack per rank.",      es: "+{v} de Ataque por rango." },
  defense:   { pt: "+{v} de Defesa por rank.",      en: "+{v} Defense per rank.",     es: "+{v} de Defensa por rango." },
  speed:     { pt: "+{v} de Velocidade por rank.",  en: "+{v} Speed per rank.",       es: "+{v} de Velocidad por rango." },
  maxHp:     { pt: "+{v} de Vida Máxima por rank.", en: "+{v} Max HP per rank.",      es: "+{v} de Vida Máxima por rango." },
  critical:  { pt: "+{v}% de Crítico por rank.",    en: "+{v}% Critical per rank.",   es: "+{v}% de Crítico por rango." },
  precision: { pt: "+{v} de Precisão por rank.",    en: "+{v} Precision per rank.",   es: "+{v} de Precisión por rango." },
  dodge:     { pt: "+{v}% de Esquiva por rank.",    en: "+{v}% Dodge per rank.",      es: "+{v}% de Evasión por rango." },
};

const DEBUFF_DESC: Record<DebuffType, { pt: string; en: string; es: string }> = {
  bleed: {
    pt: "Golpe especial causa SANGRAMENTO: dano extra de {v}% do ataque por rank.",
    en: "Special strike BLEEDS: extra damage equal to {v}% of your attack per rank.",
    es: "El golpe especial SANGRÍA: daño extra del {v}% de tu ataque por rango.",
  },
  burn: {
    pt: "Golpe especial QUEIMA: dano extra de {v}% do ataque por rank.",
    en: "Special strike BURNS: extra damage equal to {v}% of your attack per rank.",
    es: "El golpe especial QUEMA: daño extra del {v}% de tu ataque por rango.",
  },
  poison: {
    pt: "Golpe especial ENVENENA: dano extra de {v}% do ataque por rank.",
    en: "Special strike POISONS: extra damage equal to {v}% of your attack per rank.",
    es: "El golpe especial ENVENENA: daño extra del {v}% de tu ataque por rango.",
  },
  weaken: {
    pt: "Golpe especial ENFRAQUECE o inimigo em {v}% de dano por rank.",
    en: "Special strike WEAKENS the enemy by {v}% damage per rank.",
    es: "El golpe especial DEBILITA al enemigo un {v}% de daño por rango.",
  },
  sunder: {
    pt: "Golpe especial QUEBRA {v}% da armadura do inimigo por rank.",
    en: "Special strike breaks {v}% of the enemy's armor per rank.",
    es: "El golpe especial ROMPE el {v}% de la armadura enemiga por rango.",
  },
  curse: {
    pt: "Golpe especial AMALDIÇOA: +{v}% de dano causado por rank.",
    en: "Special strike CURSES: +{v}% damage dealt per rank.",
    es: "El golpe especial MALDICE: +{v}% de daño causado por rango.",
  },
  slow: {
    pt: "Golpe especial LENTIFICA: inimigo causa -{v}% de dano e esquiva -{v}% por rank.",
    en: "Special strike SLOWS: enemy deals -{v}% damage and dodges -{v}% per rank.",
    es: "El golpe especial LENTIFICA: el enemigo causa -{v}% de daño y esquiva -{v}% por rango.",
  },
  blind: {
    pt: "Golpe especial CEGA: inimigo com -{v}% de crítico por rank.",
    en: "Special strike BLINDS: enemy has -{v}% critical per rank.",
    es: "El golpe especial CIEGA: el enemigo tiene -{v}% de crítico por rango.",
  },
};

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toLocaleString("pt-BR");
}

function passiveDesc(stat: PassiveStat, value: number): Loc {
  const d = PASSIVE_DESC[stat];
  const v = fmt(value);
  return { pt: d.pt.replace("{v}", v), en: d.en.replace("{v}", v), es: d.es.replace("{v}", v) };
}

function debuffDesc(type: DebuffType, value: number): Loc {
  const d = DEBUFF_DESC[type];
  const v = fmt(value);
  return { pt: d.pt.replaceAll("{v}", v), en: d.en.replaceAll("{v}", v), es: d.es.replaceAll("{v}", v) };
}

/** Descrição genérica do debuff para a prévia do golpe especial. */
export const DEBUFF_PREVIEW: Record<DebuffType, { pt: string; en: string; es: string }> = {
  bleed: { pt: "Sangramento (dano extra)", en: "Bleed (extra damage)", es: "Sangrado (daño extra)" },
  burn: { pt: "Queimadura (dano extra)", en: "Burn (extra damage)", es: "Quemadura (daño extra)" },
  poison: { pt: "Veneno (dano extra)", en: "Poison (extra damage)", es: "Veneno (daño extra)" },
  weaken: { pt: "Enfraquecer (menos dano)", en: "Weaken (less damage)", es: "Debilitar (menos daño)" },
  sunder: { pt: "Quebrar armadura (ignora defesa)", en: "Sunder (ignores armor)", es: "Romper armadura (ignora defensa)" },
  curse: { pt: "Maldição (mais dano)", en: "Curse (more damage)", es: "Maldición (más daño)" },
  slow: { pt: "Lentidão (menos dano/esquiva)", en: "Slow (less damage/dodge)", es: "Lentitud (menos daño/esquiva)" },
  blind: { pt: "Cegueira (menos crítico)", en: "Blind (less critical)", es: "Ceguera (menos crítico)" },
};

// ---------------------------------------------------------------- definição por classe
interface ClassTree {
  /** 9 passivas: 7 status-base + 2 extras com tema da classe. */
  passives: Array<{ icon: string; name: Loc; stat: PassiveStat }>;
  /** O debuff exclusivo da classe. */
  debuff: { icon: string; name: Loc; type: DebuffType };
}

const CLASS_TREES: Record<ClassName, ClassTree> = {
  warrior: {
    passives: [
      { icon: "⚔️", name: L("Força de Batalha", "Battle Strength", "Fuerza de Batalla"), stat: "attack" },
      { icon: "🛡️", name: L("Pele de Ferro", "Iron Skin", "Piel de Hierro"), stat: "defense" },
      { icon: "❤️", name: L("Vigor de Guerra", "War Vigor", "Vigor de Guerra"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Firme", "Steady Step", "Paso Firme"), stat: "speed" },
      { icon: "💥", name: L("Olho de Guerra", "War Eye", "Ojo de Guerra"), stat: "critical" },
      { icon: "🎯", name: L("Mira de Batalha", "Battle Aim", "Mira de Batalla"), stat: "precision" },
      { icon: "💨", name: L("Esquiva Guerreira", "Warrior Dodge", "Esquiva Guerrera"), stat: "dodge" },
      { icon: "🌋", name: L("Fúria Crescente", "Rising Fury", "Furia Creciente"), stat: "attack" },
      { icon: "💪", name: L("Resistência de Aço", "Steel Endurance", "Resistencia de Acero"), stat: "maxHp" },
    ],
    debuff: { icon: "🔨", name: L("Golpe Derrubador", "Sundering Blow", "Golpe Derrubador"), type: "sunder" },
  },
  paladin: {
    passives: [
      { icon: "🛡️", name: L("Aura Protetora", "Protective Aura", "Aura Protectora"), stat: "defense" },
      { icon: "❤️", name: L("Bênção Vital", "Vital Blessing", "Bendición Vital"), stat: "maxHp" },
      { icon: "⚔️", name: L("Lâmina Sagrada", "Holy Blade", "Hoja Sagrada"), stat: "attack" },
      { icon: "👟", name: L("Passo Celestial", "Celestial Step", "Paso Celestial"), stat: "speed" },
      { icon: "💥", name: L("Fé Certeira", "Sure Faith", "Fe Certera"), stat: "critical" },
      { icon: "🎯", name: L("Mira Divina", "Divine Aim", "Mira Divina"), stat: "precision" },
      { icon: "✨", name: L("Proteção Divina", "Divine Protection", "Protección Divina"), stat: "dodge" },
      { icon: "🏰", name: L("Escudo da Fé", "Shield of Faith", "Escudo de la Fe"), stat: "defense" },
      { icon: "💪", name: L("Vontade Sagrada", "Holy Will", "Voluntad Sagrada"), stat: "maxHp" },
    ],
    debuff: { icon: "⚖️", name: L("Julgamento", "Judgment", "Juicio"), type: "weaken" },
  },
  berserker: {
    passives: [
      { icon: "🪓", name: L("Fúria Bruta", "Brute Rage", "Furia Bruta"), stat: "attack" },
      { icon: "🩸", name: L("Sede de Sangue", "Bloodthirst", "Sed de Sangre"), stat: "attack" },
      { icon: "🛡️", name: L("Pele de Fera", "Beast Skin", "Piel de Bestia"), stat: "defense" },
      { icon: "❤️", name: L("Coração Selvagem", "Wild Heart", "Corazón Salvaje"), stat: "maxHp" },
      { icon: "👟", name: L("Instinto Selvagem", "Wild Instinct", "Instinto Salvaje"), stat: "speed" },
      { icon: "💥", name: L("Olhar Feroz", "Fierce Gaze", "Mirada Feroz"), stat: "critical" },
      { icon: "🎯", name: L("Mira da Fúria", "Rage Aim", "Mira de la Furia"), stat: "precision" },
      { icon: "💨", name: L("Reflexos de Fera", "Beast Reflexes", "Reflejos de Bestia"), stat: "dodge" },
      { icon: "🌋", name: L("Corrida da Fúria", "Rage Rush", "Carrera de la Furia"), stat: "speed" },
    ],
    debuff: { icon: "🩸", name: L("Golpe Brutal", "Brutal Strike", "Golpe Brutal"), type: "bleed" },
  },
  mage: {
    passives: [
      { icon: "🔮", name: L("Poder Arcano", "Arcane Power", "Poder Arcano"), stat: "attack" },
      { icon: "📖", name: L("Conhecimento Arcano", "Arcane Lore", "Conocimiento Arcano"), stat: "attack" },
      { icon: "🛡️", name: L("Escudo Arcano", "Arcane Shield", "Escudo Arcano"), stat: "defense" },
      { icon: "❤️", name: L("Essência Vital", "Vital Essence", "Esencia Vital"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Místico", "Mystic Step", "Paso Místico"), stat: "speed" },
      { icon: "💥", name: L("Olho Arcano", "Arcane Eye", "Ojo Arcano"), stat: "critical" },
      { icon: "🎯", name: L("Mira Mágica", "Magic Sight", "Mira Mágica"), stat: "precision" },
      { icon: "💨", name: L("Desvio Arcano", "Arcane Dodge", "Evasión Arcana"), stat: "dodge" },
      { icon: "🧠", name: L("Foco Mental", "Mental Focus", "Enfoque Mental"), stat: "critical" },
    ],
    debuff: { icon: "🔥", name: L("Combustão", "Combustion", "Combustión"), type: "burn" },
  },
  necromancer: {
    passives: [
      { icon: "💀", name: L("Poder Sombrio", "Dark Power", "Poder Oscuro"), stat: "attack" },
      { icon: "🕯️", name: L("Chama Sombria", "Dark Flame", "Llama Oscura"), stat: "attack" },
      { icon: "🛡️", name: L("Armadura de Ossos", "Bone Armor", "Armadura de Huesos"), stat: "defense" },
      { icon: "❤️", name: L("Vida Roubada", "Stolen Life", "Vida Robada"), stat: "maxHp" },
      { icon: "💀", name: L("Carne Morta", "Dead Flesh", "Carne Muerta"), stat: "maxHp" },
      { icon: "👟", name: L("Passo de Sombra", "Shadow Step", "Paso de Sombra"), stat: "speed" },
      { icon: "💥", name: L("Olhar da Morte", "Death Gaze", "Mirada de la Muerte"), stat: "critical" },
      { icon: "🎯", name: L("Mira do Além", "Beyond Sight", "Mira del Más Allá"), stat: "precision" },
      { icon: "💨", name: L("Esquiva Sombria", "Shadow Dodge", "Evasión Sombría"), stat: "dodge" },
    ],
    debuff: { icon: "☠️", name: L("Maldição da Morte", "Death Curse", "Maldición de la Muerte"), type: "curse" },
  },
  assassin: {
    passives: [
      { icon: "🗡️", name: L("Lâmina Sombria", "Shadow Blade", "Hoja Sombría"), stat: "attack" },
      { icon: "🐍", name: L("Veneno Letal", "Lethal Venom", "Veneno Letal"), stat: "attack" },
      { icon: "🛡️", name: L("Manto Noturno", "Night Cloak", "Manto Nocturno"), stat: "defense" },
      { icon: "❤️", name: L("Sangue Frio", "Cold Blood", "Sangre Fría"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Fantasma", "Ghost Step", "Paso Fantasma"), stat: "speed" },
      { icon: "🤲", name: L("Mãos Rápidas", "Quick Hands", "Manos Rápidas"), stat: "speed" },
      { icon: "💥", name: L("Olhar Sombrio", "Dark Gaze", "Mirada Oscura"), stat: "critical" },
      { icon: "🎯", name: L("Mira do Assassino", "Assassin's Aim", "Mira del Asesino"), stat: "precision" },
      { icon: "💨", name: L("Esquiva Letal", "Lethal Dodge", "Evasión Letal"), stat: "dodge" },
    ],
    debuff: { icon: "🐍", name: L("Lâmina Envenenada", "Venomous Blade", "Hoja Envenenada"), type: "poison" },
  },
  hunter: {
    passives: [
      { icon: "🏹", name: L("Flecha Certeira", "Sure Arrow", "Flecha Certera"), stat: "attack" },
      { icon: "🦅", name: L("Olho de Águia", "Eagle Eye", "Ojo de Águila"), stat: "precision" },
      { icon: "🎯", name: L("Mira Infalível", "Unfailing Aim", "Mira Infalible"), stat: "precision" },
      { icon: "🛡️", name: L("Pele de Couro", "Leather Skin", "Piel de Cuero"), stat: "defense" },
      { icon: "❤️", name: L("Vigor do Caçador", "Hunter's Vigor", "Vigor del Cazador"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Ágil", "Swift Step", "Paso Ágil"), stat: "speed" },
      { icon: "💥", name: L("Olho de Caça", "Hunting Eye", "Ojo de Caza"), stat: "critical" },
      { icon: "💨", name: L("Reflexos de Predador", "Predator Reflexes", "Reflejos de Depredador"), stat: "dodge" },
      { icon: "🌬️", name: L("Vento nas Costas", "Wind at Your Back", "Viento a Favor"), stat: "speed" },
    ],
    debuff: { icon: "🏹", name: L("Flecha Paralisante", "Crippling Arrow", "Flecha Paralizante"), type: "slow" },
  },
  monk: {
    passives: [
      { icon: "🥋", name: L("Punho do Ki", "Ki Fist", "Puño del Ki"), stat: "attack" },
      { icon: "🧘", name: L("Corpo de Ferro", "Iron Body", "Cuerpo de Hierro"), stat: "defense" },
      { icon: "🪨", name: L("Pele de Pedra", "Stone Skin", "Piel de Piedra"), stat: "defense" },
      { icon: "❤️", name: L("Respiração Vital", "Breath of Life", "Respiración Vital"), stat: "maxHp" },
      { icon: "🌀", name: L("Fluxo do Ki", "Ki Flow", "Flujo del Ki"), stat: "speed" },
      { icon: "🌬️", name: L("Passo do Vento", "Wind Step", "Paso del Viento"), stat: "speed" },
      { icon: "💥", name: L("Olho Interior", "Inner Eye", "Ojo Interior"), stat: "critical" },
      { icon: "🎯", name: L("Mira Espiritual", "Spiritual Aim", "Mira Espiritual"), stat: "precision" },
      { icon: "💨", name: L("Dança do Vento", "Wind Dance", "Danza del Viento"), stat: "dodge" },
    ],
    debuff: { icon: "🙈", name: L("Toque Cego", "Blinding Touch", "Toque Cegador"), type: "blind" },
  },
  samurai: {
    passives: [
      { icon: "⚔️", name: L("Caminho da Lâmina", "Path of the Blade", "Camino de la Espada"), stat: "attack" },
      { icon: "🗡️", name: L("Corte Limpo", "Clean Cut", "Corte Limpio"), stat: "attack" },
      { icon: "🛡️", name: L("Postura Firme", "Firm Stance", "Postura Firme"), stat: "defense" },
      { icon: "❤️", name: L("Bushido", "Bushido", "Bushido"), stat: "maxHp" },
      { icon: "👟", name: L("Passo do Guerreiro", "Warrior Step", "Paso del Guerrero"), stat: "speed" },
      { icon: "💥", name: L("Olho da Lâmina", "Blade Eye", "Ojo de la Hoja"), stat: "critical" },
      { icon: "✨", name: L("Espírito de Honra", "Spirit of Honor", "Espíritu de Honor"), stat: "critical" },
      { icon: "🎯", name: L("Mira Perfeita", "Perfect Aim", "Mira Perfecta"), stat: "precision" },
      { icon: "💨", name: L("Esquiva do Samurai", "Samurai Dodge", "Esquiva del Samurái"), stat: "dodge" },
    ],
    debuff: { icon: "🩸", name: L("Corte Profundo", "Deep Cut", "Corte Profundo"), type: "bleed" },
  },
  knight: {
    passives: [
      { icon: "⚔️", name: L("Lança Real", "Royal Lance", "Lanza Real"), stat: "attack" },
      { icon: "🛡️", name: L("Escudo Real", "Royal Shield", "Escudo Real"), stat: "defense" },
      { icon: "🏰", name: L("Muralha Viva", "Living Wall", "Muralla Viviente"), stat: "defense" },
      { icon: "❤️", name: L("Sangue Nobre", "Noble Blood", "Sangre Noble"), stat: "maxHp" },
      { icon: "💪", name: L("Coração de Cavaleiro", "Knight's Heart", "Corazón de Caballero"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Nobre", "Noble Step", "Paso Noble"), stat: "speed" },
      { icon: "💥", name: L("Olho do Rei", "King's Eye", "Ojo del Rey"), stat: "critical" },
      { icon: "🎯", name: L("Mira de Comandante", "Commander's Aim", "Mira del Comandante"), stat: "precision" },
      { icon: "💨", name: L("Postura de Guarda", "Guarded Stance", "Postura de Guardia"), stat: "dodge" },
    ],
    debuff: { icon: "💥", name: L("Quebra-escudo", "Shieldbreaker", "Rompeescudos"), type: "sunder" },
  },
  summoner: {
    passives: [
      { icon: "✨", name: L("Poder de Invocação", "Summoning Power", "Poder de Invocación"), stat: "attack" },
      { icon: "🐉", name: L("Garra Invocada", "Summoned Claw", "Garra Invocada"), stat: "attack" },
      { icon: "🛡️", name: L("Escudo Místico", "Mystic Shield", "Escudo Místico"), stat: "defense" },
      { icon: "❤️", name: L("Vínculo Vital", "Vital Bond", "Vínculo Vital"), stat: "maxHp" },
      { icon: "🐲", name: L("Essência de Dragão", "Dragon Essence", "Esencia de Dragón"), stat: "maxHp" },
      { icon: "👟", name: L("Passo dos Espíritos", "Spirit Step", "Paso de los Espíritus"), stat: "speed" },
      { icon: "💥", name: L("Olho Místico", "Mystic Eye", "Ojo Místico"), stat: "critical" },
      { icon: "🎯", name: L("Mira Arcana", "Arcane Aim", "Mira Arcana"), stat: "precision" },
      { icon: "💨", name: L("Desvio Espiritual", "Spirit Dodge", "Evasión Espiritual"), stat: "dodge" },
    ],
    debuff: { icon: "😈", name: L("Aflição", "Affliction", "Afligir"), type: "curse" },
  },
  templar: {
    passives: [
      { icon: "✝️", name: L("Fé Inabalável", "Unwavering Faith", "Fe Inquebrantable"), stat: "maxHp" },
      { icon: "🛡️", name: L("Escudo da Fé", "Shield of Faith", "Escudo de la Fe"), stat: "defense" },
      { icon: "🏛️", name: L("Muralha Sagrada", "Holy Wall", "Muro Sagrado"), stat: "defense" },
      { icon: "⚔️", name: L("Poder Sagrado", "Holy Power", "Poder Sagrado"), stat: "attack" },
      { icon: "🔥", name: L("Ira Divina", "Divine Wrath", "Ira Divina"), stat: "attack" },
      { icon: "❤️", name: L("Bênção Curadora", "Healing Blessing", "Bendición Sanadora"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Divino", "Divine Step", "Paso Divino"), stat: "speed" },
      { icon: "💥", name: L("Olho Sagrado", "Holy Eye", "Ojo Sagrado"), stat: "critical" },
      { icon: "🎯", name: L("Mira da Fé", "Aim of Faith", "Mira de la Fe"), stat: "precision" },
    ],
    debuff: { icon: "☀️", name: L("Punição Divina", "Divine Punishment", "Castigo Divino"), type: "burn" },
  },
  archer: {
    passives: [
      { icon: "🎯", name: L("Flecha do Vento", "Wind Arrow", "Flecha del Viento"), stat: "attack" },
      { icon: "🦅", name: L("Olho de Falcão", "Hawk Eye", "Ojo de Halcón"), stat: "critical" },
      { icon: "👁️", name: L("Visão do Falcão", "Falcon Sight", "Visión del Halcón"), stat: "precision" },
      { icon: "🎯", name: L("Mira de Falcão", "Falcon Aim", "Mira de Halcón"), stat: "precision" },
      { icon: "🛡️", name: L("Pele de Elfo", "Elven Skin", "Piel de Elfo"), stat: "defense" },
      { icon: "❤️", name: L("Vigor da Floresta", "Forest Vigor", "Vigor del Bosque"), stat: "maxHp" },
      { icon: "👟", name: L("Passo Leve", "Light Step", "Paso Ligero"), stat: "speed" },
      { icon: "🌬️", name: L("Vento Rápido", "Quick Wind", "Viento Rápido"), stat: "speed" },
      { icon: "💨", name: L("Reflexos de Elfo", "Elven Reflexes", "Reflejos de Elfo"), stat: "dodge" },
    ],
    debuff: { icon: "💫", name: L("Flecha da Cegueira", "Blinding Arrow", "Flecha Cegadora"), type: "blind" },
  },
};

// ---------------------------------------------------------------- árvore montada
function buildSkill(id: string, icon: string, name: Loc, desc: Loc, requiresRanks: number, passive?: SkillDef["passive"], debuff?: SkillDef["debuff"]): SkillDef {
  return { id, icon, name, desc, maxRank: 3, costPerRank: 1, requiresRanks, passive, debuff };
}

/** Monta as 10 habilidades da classe (9 passivas + 1 debuff). */
function buildTree(cls: ClassName, def: ClassTree): SkillDef[] {
  const out: SkillDef[] = [];
  def.passives.forEach((p, i) => {
    const value = PASSIVE_VALUES[p.stat];
    out.push(
      buildSkill(
        `${cls}_p${i + 1}`,
        p.icon,
        p.name,
        passiveDesc(p.stat, value),
        i, // desbloqueia progressivamente (0, 1, 2, ... 8)
        { stat: p.stat, valuePerRank: value }
      )
    );
  });
  const dv = DEBUFF_VALUES[def.debuff.type];
  out.push(
    buildSkill(
      `${cls}_debuff`,
      def.debuff.icon,
      def.debuff.name,
      debuffDesc(def.debuff.type, dv),
      def.passives.length, // última habilidade: requer 9 pontos na árvore
      undefined,
      { type: def.debuff.type, valuePerRank: dv }
    )
  );
  return out;
}

export const SKILL_TREES: Record<ClassName, SkillDef[]> = Object.fromEntries(
  (Object.keys(CLASS_TREES) as ClassName[]).map((cls) => [cls, buildTree(cls, CLASS_TREES[cls])])
) as Record<ClassName, SkillDef[]>;

/** Retorna a árvore da classe (fallback: warrior). */
export function skillTreeForClass(cls: ClassName | string): SkillDef[] {
  return SKILL_TREES[(cls as ClassName) ?? "warrior"] ?? SKILL_TREES.warrior;
}

/** Soma os ranks investidos na árvore do personagem. */
export function skillTreeTotalRanks(char: any): number {
  const skills = (char?.skills as Record<string, number> | undefined) ?? {};
  return Object.values(skills).reduce((a, b) => a + (Number(b) || 0), 0);
}

/**
 * Bônus passivo TOTAL da árvore (soma de todas as habilidades por rank).
 * Usado pelo painel para exibir o que a árvore já está dando.
 */
export function skillTreePassiveBonuses(char: any): Partial<Record<PassiveStat, number>> {
  const cls = (char?.classType as ClassName) || "warrior";
  const skills = (char?.skills as Record<string, number> | undefined) ?? {};
  const out: Partial<Record<PassiveStat, number>> = {};
  for (const s of SKILL_TREES[cls] ?? []) {
    const rank = Number(skills[s.id]) || 0;
    if (rank > 0 && s.passive) {
      out[s.passive.stat] = (out[s.passive.stat] || 0) + s.passive.valuePerRank * rank;
    }
  }
  return out;
}

/**
 * Debuff da árvore do personagem (o da habilidade de debuff da classe).
 * Retorna null se nada foi aprendido.
 */
export function skillTreeDebuff(char: any): { type: DebuffType; value: number } | null {
  const cls = (char?.classType as ClassName) || "warrior";
  const skills = (char?.skills as Record<string, number> | undefined) ?? {};
  for (const s of SKILL_TREES[cls] ?? []) {
    const rank = Number(skills[s.id]) || 0;
    if (rank > 0 && s.debuff) {
      return { type: s.debuff.type, value: s.debuff.valuePerRank * rank };
    }
  }
  return null;
}

/** Texto do debuff para logs de batalha (pt-BR, padrão do jogo). */
export const DEBUFF_LOG: Record<DebuffType, string> = {
  bleed: "🩸 Sangramento",
  burn: "🔥 Queimadura",
  poison: "🐍 Veneno",
  weaken: "💫 Enfraquecido",
  sunder: "🔨 Armadura quebrada",
  curse: "☠️ Amaldiçoado",
  slow: "🐌 Lentidão",
  blind: "🙈 Cego",
};
