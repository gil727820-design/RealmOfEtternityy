/**
 * SKILLS DE GUILDA ⚔️ — bônus passivos comprados com moedas da guilda.
 *
 * Cada skill tem nível máximo e custa moedas da guilda para subir.
 * Os bônus afetam TODOS os membros da guilda enquanto estiverem ativos.
 */

export interface GuildSkill {
  id: string;
  nameKey: string;
  icon: string;
  description: string;
  maxLevel: number;
  /** Custo por nível (escala). */
  costPerLevel: number;
  /** Bônus por nível (porcentagem ou valor fixo). */
  bonusPerLevel: number;
  /** Tipo de bônus. */
  bonusType: "attack" | "defense" | "hp" | "xp" | "gold" | "speed" | "critical";
}

export const GUILD_SKILLS: GuildSkill[] = [
  {
    id: "guild_attack",
    nameKey: "guild.skill.attack",
    icon: "⚔️",
    description: "Aumenta o ataque de todos os membros em +2% por nível",
    maxLevel: 10,
    costPerLevel: 5000,
    bonusPerLevel: 2,
    bonusType: "attack",
  },
  {
    id: "guild_defense",
    nameKey: "guild.skill.defense",
    icon: "🛡️",
    description: "Aumenta a defesa de todos os membros em +2% por nível",
    maxLevel: 10,
    costPerLevel: 5000,
    bonusPerLevel: 2,
    bonusType: "defense",
  },
  {
    id: "guild_hp",
    nameKey: "guild.skill.hp",
    icon: "❤️",
    description: "Aumenta o HP máximo de todos os membros em +3% por nível",
    maxLevel: 10,
    costPerLevel: 4000,
    bonusPerLevel: 3,
    bonusType: "hp",
  },
  {
    id: "guild_xp",
    nameKey: "guild.skill.xp",
    icon: "✨",
    description: "Aumenta o XP ganho em +5% por nível",
    maxLevel: 8,
    costPerLevel: 8000,
    bonusPerLevel: 5,
    bonusType: "xp",
  },
  {
    id: "guild_gold",
    nameKey: "guild.skill.gold",
    icon: "💰",
    description: "Aumenta o ouro ganho em +5% por nível",
    maxLevel: 8,
    costPerLevel: 8000,
    bonusPerLevel: 5,
    bonusType: "gold",
  },
  {
    id: "guild_speed",
    nameKey: "guild.skill.speed",
    icon: "👟",
    description: "Aumenta a velocidade de todos os membros em +1 por nível",
    maxLevel: 10,
    costPerLevel: 6000,
    bonusPerLevel: 1,
    bonusType: "speed",
  },
  {
    id: "guild_critical",
    nameKey: "guild.skill.critical",
    icon: "💥",
    description: "Aumenta o crítico de todos os membros em +1% por nível",
    maxLevel: 10,
    costPerLevel: 6000,
    bonusPerLevel: 1,
    bonusType: "critical",
  },
];

/** Custo total para subir uma skill de nível 0 ao nível especificado. */
export function guildSkillTotalCost(skill: GuildSkill, targetLevel: number): number {
  let total = 0;
  for (let i = 1; i <= Math.min(targetLevel, skill.maxLevel); i++) {
    total += skill.costPerLevel * i;
  }
  return total;
}

/** Bônus total de uma skill em dado nível. */
export function guildSkillBonus(skill: GuildSkill, level: number): number {
  return skill.bonusPerLevel * Math.min(level, skill.maxLevel);
}
