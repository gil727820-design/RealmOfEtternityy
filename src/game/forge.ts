/**
 * Regras da Forja (compartilhadas entre a API e o cálculo de bônus de equipamento).
 *
 * - RUNA (aprimorar): +1 nível de runa (1 → 15, limite), +5% de atributos por
 *   nível. Fica cada vez mais difícil (chance cai) e mais caro (custo explode)
 *   conforme sobe — as runas altas são conquista de quem tem muito ouro.
 * - ENCANTAR: aplica um encantamento do POOL DA CLASSE (15 por classe), cada
 *   um com bônus fixo e nome exclusivo. Runa e encanto funcionam JUNTOS no
 *   mesmo equipamento (encantar não bloqueia mais aprimorar).
 */

import type { ClassName } from "./constants";

export type EnchantStat = "attack" | "defense" | "critical" | "speed" | "maxHp";

export interface EnchantDef {
  id: string;
  icon: string;
  /** Nome localizado (pt/en/es). */
  name: { pt: string; en: string; es: string };
  stat: EnchantStat;
  amount: number;
}

/** Limite de runas (aprimoramento) por item. */
export const MAX_ENHANCE = 15;

/** Custo em ouro para encantar. */
export const ENCHANT_COST = 5000;

type Loc = { pt: string; en: string; es: string };
const L = (pt: string, en: string, es: string): Loc => ({ pt, en, es });

/** Monta o pool de uma classe: id estável (cls_1..cls_15). */
function pool(
  cls: string,
  entries: Array<[icon: string, pt: string, en: string, es: string, stat: EnchantStat, amount: number]>
): EnchantDef[] {
  return entries.map(([icon, pt, en, es, stat, amount], i) => ({
    id: `${cls}_${i + 1}`,
    icon,
    name: { pt, en, es },
    stat,
    amount,
  }));
}

/**
 * 15 encantamentos únicos por classe (3 de ataque, 3 de defesa, 3 de vida,
 * 3 de velocidade e 3 de crítico, com bônus crescente). Cada classe tem nomes
 * com o tema dela — o encantamento de um guerreiro é diferente do de um mago.
 */
export const ENCHANT_POOLS: Record<ClassName, EnchantDef[]> = {
  warrior: pool("war", [
    ["🔥", "Chama de Guerra", "War Flame", "Llama de Guerra", "attack", 5],
    ["🛡️", "Muralha de Aço", "Steel Wall", "Muro de Acero", "defense", 5],
    ["❤️", "Vigor Guerreiro", "Warrior Vigor", "Vigor Guerrero", "maxHp", 60],
    ["👟", "Passo de Batalha", "Battle Step", "Paso de Batalla", "speed", 2],
    ["💥", "Olho Crítico", "Critical Eye", "Ojo Crítico", "critical", 2],
    ["⚔️", "Golpe Pesado", "Heavy Blow", "Golpe Pesado", "attack", 8],
    ["🧱", "Pele de Ferro", "Iron Skin", "Piel de Hierro", "defense", 8],
    ["🦁", "Coração de Leão", "Lionheart", "Corazón de León", "maxHp", 100],
    ["💨", "Investida Veloz", "Swift Charge", "Carga Veloz", "speed", 4],
    ["🎯", "Mira de Guerra", "War Aim", "Mira de Guerra", "critical", 4],
    ["🌋", "Fúria Destrutiva", "Destructive Fury", "Furia Destructiva", "attack", 12],
    ["🏰", "Fortaleza Andante", "Walking Fortress", "Fortaleza Andante", "defense", 12],
    ["💪", "Espírito Indomável", "Unbroken Spirit", "Espíritu Indomable", "maxHp", 150],
    ["⚡", "Fúria Relâmpago", "Lightning Fury", "Furia Relámpago", "speed", 6],
    ["☠️", "Lâmina Mortal", "Deadly Blade", "Hoja Mortal", "critical", 6],
  ]),
  paladin: pool("pal", [
    ["✨", "Luz Sagrada", "Holy Light", "Luz Sagrada", "attack", 5],
    ["🛡️", "Aura Protetora", "Protective Aura", "Aura Protectora", "defense", 5],
    ["❤️", "Bênção Vital", "Vital Blessing", "Bendición Vital", "maxHp", 60],
    ["👟", "Passo Celestial", "Celestial Step", "Paso Celestial", "speed", 2],
    ["💥", "Fé Certeira", "Sure Faith", "Fe Certera", "critical", 2],
    ["⚔️", "Lâmina da Justiça", "Blade of Justice", "Hoja de la Justicia", "attack", 8],
    ["🧱", "Escudo Divino", "Divine Shield", "Escudo Divino", "defense", 8],
    ["❤️‍🩹", "Toque Curativo", "Healing Touch", "Toque Sanador", "maxHp", 100],
    ["💨", "Fúria Celestial", "Celestial Fury", "Furia Celestial", "speed", 4],
    ["🎯", "Olho Divino", "Divine Eye", "Ojo Divino", "critical", 4],
    ["🌟", "Poder Celestial", "Celestial Power", "Poder Celestial", "attack", 12],
    ["🏛️", "Muralha Sagrada", "Holy Bulwark", "Muralla Sagrada", "defense", 12],
    ["💪", "Vontade de Aço", "Will of Steel", "Voluntad de Acero", "maxHp", 150],
    ["⚡", "Investida Sagrada", "Holy Charge", "Carga Sagrada", "speed", 6],
    ["👑", "Julgamento Final", "Final Judgment", "Juicio Final", "critical", 6],
  ]),
  berserker: pool("ber", [
    ["🩸", "Sede de Sangue", "Bloodthirst", "Sed de Sangre", "attack", 5],
    ["🛡️", "Pele de Fera", "Beast Skin", "Piel de Bestia", "defense", 5],
    ["❤️", "Coração Selvagem", "Wild Heart", "Corazón Salvaje", "maxHp", 60],
    ["👟", "Instinto Veloz", "Swift Instinct", "Instinto Veloz", "speed", 2],
    ["💥", "Olhar Feroz", "Fierce Gaze", "Mirada Feroz", "critical", 2],
    ["⚔️", "Golpe Brutal", "Brutal Strike", "Golpe Brutal", "attack", 8],
    ["🧱", "Pele de Rocha", "Rock Skin", "Piel de Roca", "defense", 8],
    ["❤️‍🔥", "Fúria Interior", "Inner Rage", "Furia Interior", "maxHp", 100],
    ["💨", "Corrida da Fúria", "Rage Rush", "Carrera de la Furia", "speed", 4],
    ["🎯", "Mira Selvagem", "Wild Aim", "Mira Salvaje", "critical", 4],
    ["🌋", "Fúria Vulcânica", "Volcanic Rage", "Furia Volcánica", "attack", 12],
    ["🏰", "Inquebrável", "Unbreakable", "Inquebrantable", "defense", 12],
    ["💪", "Força Bruta", "Brute Force", "Fuerza Bruta", "maxHp", 150],
    ["⚡", "Fúria em Chamas", "Blazing Rage", "Furia Ardiente", "speed", 6],
    ["☠️", "Golpe Fatal", "Fatal Strike", "Golpe Fatal", "critical", 6],
  ]),
  mage: pool("mag", [
    ["🔥", "Chama Arcana", "Arcane Flame", "Llama Arcana", "attack", 5],
    ["🛡️", "Escudo Arcano", "Arcane Shield", "Escudo Arcano", "defense", 5],
    ["❤️", "Essência Vital", "Vital Essence", "Esencia Vital", "maxHp", 60],
    ["👟", "Passo Místico", "Mystic Step", "Paso Místico", "speed", 2],
    ["💥", "Olho Arcano", "Arcane Eye", "Ojo Arcano", "critical", 2],
    ["⚔️", "Explosão Mística", "Mystic Blast", "Explosión Mística", "attack", 8],
    ["🧱", "Pele de Cristal", "Crystal Skin", "Piel de Cristal", "defense", 8],
    ["❤️‍🔥", "Fogo Interior", "Inner Fire", "Fuego Interior", "maxHp", 100],
    ["💨", "Vento Arcano", "Arcane Wind", "Viento Arcano", "speed", 4],
    ["🎯", "Mira Mágica", "Magic Sight", "Mira Mágica", "critical", 4],
    ["🌌", "Poder Estelar", "Stellar Power", "Poder Estelar", "attack", 12],
    ["🏛️", "Muralha Arcana", "Arcane Wall", "Muro Arcano", "defense", 12],
    ["💪", "Reserva Arcana", "Arcane Reserve", "Reserva Arcana", "maxHp", 150],
    ["⚡", "Relâmpago Arcano", "Arcane Lightning", "Relámpago Arcano", "speed", 6],
    ["👁️", "Visão do Vazio", "Void Sight", "Visión del Vacío", "critical", 6],
  ]),
  necromancer: pool("nec", [
    ["🕯️", "Chama Sombria", "Dark Flame", "Llama Oscura", "attack", 5],
    ["🛡️", "Armadura de Ossos", "Bone Armor", "Armadura de Huesos", "defense", 5],
    ["❤️", "Vida Roubada", "Stolen Life", "Vida Robada", "maxHp", 60],
    ["👟", "Passo de Sombra", "Shadow Step", "Paso de Sombra", "speed", 2],
    ["💥", "Olhar da Morte", "Death Gaze", "Mirada de la Muerte", "critical", 2],
    ["⚔️", "Garra Espectral", "Spectral Claw", "Garra Espectral", "attack", 8],
    ["🧱", "Pele de Cadáver", "Corpse Skin", "Piel de Cadáver", "defense", 8],
    ["❤️‍🩹", "Vampirismo", "Vampirism", "Vampirismo", "maxHp", 100],
    ["💨", "Vento Fúnebre", "Funeral Wind", "Viento Fúnebre", "speed", 4],
    ["🎯", "Mira do Além", "Beyond Sight", "Mira del Más Allá", "critical", 4],
    ["🌑", "Poder do Vazio", "Void Power", "Poder del Vacío", "attack", 12],
    ["🏰", "Fortaleza Morta", "Dead Fortress", "Fortaleza Muerta", "defense", 12],
    ["💪", "Alma Inquebrantável", "Unbroken Soul", "Alma Inquebrantable", "maxHp", 150],
    ["⚡", "Raio Necrótico", "Necrotic Ray", "Rayo Necrótico", "speed", 6],
    ["☠️", "Toque da Morte", "Death Touch", "Toque de la Muerte", "critical", 6],
  ]),
  assassin: pool("ass", [
    ["🐍", "Veneno Letal", "Lethal Venom", "Veneno Letal", "attack", 5],
    ["🛡️", "Sombra Protetora", "Protective Shadow", "Sombra Protectora", "defense", 5],
    ["❤️", "Sangue Frio", "Cold Blood", "Sangre Fría", "maxHp", 60],
    ["👟", "Passo Fantasma", "Ghost Step", "Paso Fantasma", "speed", 2],
    ["💥", "Olhar Sombrio", "Dark Gaze", "Mirada Oscura", "critical", 2],
    ["⚔️", "Lâmina Envenenada", "Poisoned Blade", "Hoja Envenenada", "attack", 8],
    ["🧱", "Pele de Sombra", "Shadow Skin", "Piel de Sombra", "defense", 8],
    ["❤️‍🔥", "Fúria Noturna", "Night Fury", "Furia Nocturna", "maxHp", 100],
    ["💨", "Velocidade Sombria", "Shadow Speed", "Velocidad Sombra", "speed", 4],
    ["🎯", "Mira de Assassino", "Assassin's Aim", "Mira del Asesino", "critical", 4],
    ["🌑", "Golpe das Sombras", "Shadow Strike", "Golpe de las Sombras", "attack", 12],
    ["🏛️", "Manto Noturno", "Night Cloak", "Manto Nocturno", "defense", 12],
    ["💪", "Instinto Assassino", "Assassin Instinct", "Instinto Asesino", "maxHp", 150],
    ["⚡", "Relâmpago Sombrio", "Dark Lightning", "Relámpago Oscuro", "speed", 6],
    ["💀", "Toque Letal", "Lethal Touch", "Toque Letal", "critical", 6],
  ]),
  hunter: pool("hun", [
    ["🌿", "Flecha Natural", "Natural Arrow", "Flecha Natural", "attack", 5],
    ["🛡️", "Pele de Couro", "Leather Skin", "Piel de Cuero", "defense", 5],
    ["❤️", "Vigor do Caçador", "Hunter's Vigor", "Vigor del Cazador", "maxHp", 60],
    ["👟", "Passo Ágil", "Swift Step", "Paso Ágil", "speed", 2],
    ["💥", "Olho de Águia", "Eagle Eye", "Ojo de Águila", "critical", 2],
    ["⚔️", "Disparo Preciso", "Precise Shot", "Disparo Preciso", "attack", 8],
    ["🧱", "Camuflagem", "Camouflage", "Camuflaje", "defense", 8],
    ["❤️‍🔥", "Instinto de Caça", "Hunting Instinct", "Instinto de Caza", "maxHp", 100],
    ["💨", "Vento nas Costas", "Wind at Your Back", "Viento a Favor", "speed", 4],
    ["🎯", "Mira Infalível", "Unfailing Aim", "Mira Infalible", "critical", 4],
    ["🌪️", "Tempestade de Flechas", "Arrow Storm", "Tormenta de Flechas", "attack", 12],
    ["🏰", "Armadilha de Espinhos", "Thorn Trap", "Trampa de Espinas", "defense", 12],
    ["💪", "Resistência Selvagem", "Wild Endurance", "Resistencia Salvaje", "maxHp", 150],
    ["⚡", "Disparo Veloz", "Swift Shot", "Disparo Veloz", "speed", 6],
    ["☠️", "Flecha Mortal", "Mortal Arrow", "Flecha Mortal", "critical", 6],
  ]),
  monk: pool("mon", [
    ["🌀", "Fluxo do Ki", "Ki Flow", "Flujo del Ki", "attack", 5],
    ["🛡️", "Pele de Pedra", "Stone Skin", "Piel de Piedra", "defense", 5],
    ["❤️", "Respiração Vital", "Breath of Life", "Respiración Vital", "maxHp", 60],
    ["👟", "Passo do Vento", "Wind Step", "Paso del Viento", "speed", 2],
    ["💥", "Olho Interior", "Inner Eye", "Ojo Interior", "critical", 2],
    ["⚔️", "Punho de Ferro", "Iron Fist", "Puño de Hierro", "attack", 8],
    ["🧱", "Corpo de Ferro", "Iron Body", "Cuerpo de Hierro", "defense", 8],
    ["❤️‍🩹", "Cura do Ki", "Ki Healing", "Cura del Ki", "maxHp", 100],
    ["💨", "Dança do Vento", "Wind Dance", "Danza del Viento", "speed", 4],
    ["🎯", "Mira Espiritual", "Spiritual Aim", "Mira Espiritual", "critical", 4],
    ["🌊", "Força da Maré", "Tide Force", "Fuerza de la Marea", "attack", 12],
    ["🏛️", "Muralha do Monge", "Monk's Wall", "Muralla del Monje", "defense", 12],
    ["💪", "Harmonia Total", "Total Harmony", "Armonía Total", "maxHp", 150],
    ["⚡", "Golpe do Relâmpago", "Lightning Strike", "Golpe del Relámpago", "speed", 6],
    ["👁️", "Olho do Dragão", "Dragon Eye", "Ojo del Dragón", "critical", 6],
  ]),
  samurai: pool("sam", [
    ["⚔️", "Lâmina Afiada", "Sharp Blade", "Hoja Afilada", "attack", 5],
    ["🛡️", "Armadura de Samurai", "Samurai Armor", "Armadura de Samurái", "defense", 5],
    ["❤️", "Bushido", "Bushido", "Bushido", "maxHp", 60],
    ["👟", "Passo do Guerreiro", "Warrior Step", "Paso del Guerrero", "speed", 2],
    ["💥", "Olho da Lâmina", "Blade Eye", "Ojo de la Hoja", "critical", 2],
    ["⚔️", "Corte Limpo", "Clean Cut", "Corte Limpio", "attack", 8],
    ["🧱", "Pele de Aço", "Steel Skin", "Piel de Acero", "defense", 8],
    ["❤️‍🔥", "Espírito de Honra", "Spirit of Honor", "Espíritu de Honor", "maxHp", 100],
    ["💨", "Corte do Vento", "Wind Slash", "Corte del Viento", "speed", 4],
    ["🎯", "Mira Perfeita", "Perfect Aim", "Mira Perfecta", "critical", 4],
    ["🌸", "Flor de Cerejeira", "Cherry Blossom", "Flor de Cerezo", "attack", 12],
    ["🏰", "Postura Inquebrável", "Unbroken Stance", "Postura Inquebrantable", "defense", 12],
    ["💪", "Vontade de Samurai", "Samurai Will", "Voluntad de Samurái", "maxHp", 150],
    ["⚡", "Corte Relâmpago", "Lightning Slash", "Corte Relámpago", "speed", 6],
    ["☠️", "Golpe Final", "Final Cut", "Corte Final", "critical", 6],
  ]),
  knight: pool("kni", [
    ["⚔️", "Lança Real", "Royal Lance", "Lanza Real", "attack", 5],
    ["🛡️", "Escudo Real", "Royal Shield", "Escudo Real", "defense", 5],
    ["❤️", "Sangue Nobre", "Noble Blood", "Sangre Noble", "maxHp", 60],
    ["👟", "Passo Nobre", "Noble Step", "Paso Noble", "speed", 2],
    ["💥", "Olho do Rei", "King's Eye", "Ojo del Rey", "critical", 2],
    ["⚔️", "Investida Cavalheiresca", "Knightly Charge", "Carga Caballeresca", "attack", 8],
    ["🧱", "Armadura de Muralha", "Wall Armor", "Armadura de Muro", "defense", 8],
    ["❤️‍🩹", "Juramento de Proteção", "Oath of Protection", "Juramento de Protección", "maxHp", 100],
    ["💨", "Fúria do Corcel", "Steed Fury", "Furia del Corcel", "speed", 4],
    ["🎯", "Mira de Comandante", "Commander's Aim", "Mira del Comandante", "critical", 4],
    ["🌟", "Poder do Reino", "Realm Power", "Poder del Reino", "attack", 12],
    ["🏛️", "Fortaleza do Reino", "Realm Fortress", "Fortaleza del Reino", "defense", 12],
    ["💪", "Coração de Cavaleiro", "Knight's Heart", "Corazón de Caballero", "maxHp", 150],
    ["⚡", "Investida Relâmpago", "Lightning Charge", "Carga Relámpago", "speed", 6],
    ["👑", "Golpe do Rei", "King's Strike", "Golpe del Rey", "critical", 6],
  ]),
  summoner: pool("sum", [
    ["🔮", "Poder de Invocação", "Summoning Power", "Poder de Invocación", "attack", 5],
    ["🛡️", "Escudo Místico", "Mystic Shield", "Escudo Místico", "defense", 5],
    ["❤️", "Vínculo Vital", "Vital Bond", "Vínculo Vital", "maxHp", 60],
    ["👟", "Passo dos Espíritos", "Spirit Step", "Paso de los Espíritus", "speed", 2],
    ["💥", "Olho Místico", "Mystic Eye", "Ojo Místico", "critical", 2],
    ["⚔️", "Garra Invocada", "Summoned Claw", "Garra Invocada", "attack", 8],
    ["🧱", "Pele de Cristal Arcano", "Arcane Crystal Skin", "Piel de Cristal Arcano", "defense", 8],
    ["❤️‍🔥", "Essência de Dragão", "Dragon Essence", "Esencia de Dragón", "maxHp", 100],
    ["💨", "Vento dos Espíritos", "Spirit Wind", "Viento de los Espíritus", "speed", 4],
    ["🎯", "Mira Arcana", "Arcane Aim", "Mira Arcana", "critical", 4],
    ["🌌", "Poder Astral", "Astral Power", "Poder Astral", "attack", 12],
    ["🏰", "Guardião de Pedra", "Stone Guardian", "Guardián de Piedra", "defense", 12],
    ["💪", "Alma do Invocador", "Summoner's Soul", "Alma del Invocador", "maxHp", 150],
    ["⚡", "Raio Místico", "Mystic Ray", "Rayo Místico", "speed", 6],
    ["🌟", "Estrela Cadente", "Shooting Star", "Estrella Fugaz", "critical", 6],
  ]),
  templar: pool("tem", [
    ["🔥", "Fogo Sagrado", "Holy Fire", "Fuego Sagrado", "attack", 5],
    ["🛡️", "Escudo da Fé", "Shield of Faith", "Escudo de la Fe", "defense", 5],
    ["❤️", "Fé Inabalável", "Unwavering Faith", "Fe Inquebrantable", "maxHp", 60],
    ["👟", "Passo Divino", "Divine Step", "Paso Divino", "speed", 2],
    ["💥", "Olho Sagrado", "Holy Eye", "Ojo Sagrado", "critical", 2],
    ["⚔️", "Lâmina Sagrada", "Holy Blade", "Hoja Sagrada", "attack", 8],
    ["🧱", "Armadura da Cruz", "Cross Armor", "Armadura de la Cruz", "defense", 8],
    ["❤️‍🩹", "Bênção Curadora", "Healing Blessing", "Bendición Sanadora", "maxHp", 100],
    ["💨", "Fúria Divina", "Divine Fury", "Furia Divina", "speed", 4],
    ["🎯", "Mira da Fé", "Aim of Faith", "Mira de la Fe", "critical", 4],
    ["🌟", "Poder do Céu", "Heavenly Power", "Poder del Cielo", "attack", 12],
    ["🏛️", "Muralha Sagrada", "Holy Wall", "Muro Sagrado", "defense", 12],
    ["💪", "Proteção Divina", "Divine Protection", "Protección Divina", "maxHp", 150],
    ["⚡", "Relâmpago Divino", "Divine Lightning", "Relámpago Divino", "speed", 6],
    ["👑", "Punição Divina", "Divine Punishment", "Castigo Divino", "critical", 6],
  ]),
  archer: pool("arc", [
    ["🌬️", "Flecha do Vento", "Wind Arrow", "Flecha del Viento", "attack", 5],
    ["🛡️", "Pele de Elfo", "Elven Skin", "Piel de Elfo", "defense", 5],
    ["❤️", "Vigor da Floresta", "Forest Vigor", "Vigor del Bosque", "maxHp", 60],
    ["👟", "Passo Leve", "Light Step", "Paso Ligero", "speed", 2],
    ["💥", "Olho de Falcão", "Hawk Eye", "Ojo de Halcón", "critical", 2],
    ["⚔️", "Disparo Preciso", "Precise Shot", "Disparo Preciso", "attack", 8],
    ["🧱", "Camuflagem da Selva", "Jungle Camouflage", "Camuflaje de la Selva", "defense", 8],
    ["❤️‍🔥", "Instinto de Predador", "Predator Instinct", "Instinto de Depredador", "maxHp", 100],
    ["💨", "Vento Rápido", "Quick Wind", "Viento Rápido", "speed", 4],
    ["🎯", "Mira de Falcão", "Falcon Aim", "Mira de Halcón", "critical", 4],
    ["🌪️", "Chuva de Flechas", "Arrow Rain", "Lluvia de Flechas", "attack", 12],
    ["🏰", "Armadilha Natural", "Natural Trap", "Trampa Natural", "defense", 12],
    ["💪", "Resistência da Floresta", "Forest Endurance", "Resistencia del Bosque", "maxHp", 150],
    ["⚡", "Flecha Relâmpago", "Lightning Arrow", "Flecha Relámpago", "speed", 6],
    ["☠️", "Flecha Perfurante", "Piercing Arrow", "Flecha Perforante", "critical", 6],
  ]),
};

/** Pool de encantamentos disponíveis para a classe do personagem. */
export function enchantPoolForClass(cls: ClassName | string): EnchantDef[] {
  return ENCHANT_POOLS[(cls as ClassName) ?? "warrior"] ?? ENCHANT_POOLS.warrior;
}

/** Nome localizado do encantamento (pt/en/es). */
export function enchantName(en: EnchantDef, locale: string): string {
  if (locale?.toLowerCase().startsWith("en")) return en.name.en;
  if (locale?.toLowerCase().startsWith("es")) return en.name.es;
  return en.name.pt;
}

/** Busca um encantamento pelo id (em qualquer pool). */
export function enchantById(id: string): EnchantDef | undefined {
  for (const p of Object.values(ENCHANT_POOLS)) {
    const found = p.find((e) => e.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Custo em ouro para gravar a runa `level` → `level + 1`.
 * Cresce rápido (×1.6 por nível) e parte de 1.000 — as runas altas ficam
 * caras de verdade, dando à forja um bom destino para o ouro do jogador.
 * Ex.: +0 → 1.000 · +5 → ~10.500 · +10 → ~110.000 · +14 → ~720.000
 */
export function enhanceCost(level: number): number {
  return Math.floor(1000 * Math.pow(1.6, Math.min(level, MAX_ENHANCE)));
}

/**
 * Chance de sucesso (%) ao gravar a runa do nível `level`.
 * Começa garantida (100%) e cai ~6,5 pontos por nível até o piso de 10% —
 * aprimorar até +15 exige sorte (ou muitas tentativas) além de ouro.
 * Ex.: +0 → 100% · +5 → ~68% · +10 → ~35% · +14 → 10%
 */
export function enhanceChance(level: number): number {
  if (level >= MAX_ENHANCE) return 0;
  return Math.max(10, Math.round(100 - level * 6.5));
}

/** Bônus de atributos de um item de equipamento considerando runas + encanto. */
export function equipmentBonus(template: Record<string, unknown> | null, item: Record<string, unknown>) {
  const t = template || {};
  // +5% por runa (aumento pequeno e controlado).
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
