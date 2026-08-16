/**
 * MOBS DE REGIÃO 🗺️ — farm por batalha contra monstros da região atual.
 *
 * Cada região tem:
 *   - 3-4 MOBS comuns (luta rápida, XP/ouro, chance de drop);
 *   - 1 ELITE (raridade maior, ~5% de chance de aparecer — mais recompensa);
 *   - 1 MINI-BOSS com respawn (cooldown de 30 min) e drop exclusivo.
 *
 * Stats fixos pela região (não espelham o jogador): voltar à vila com nível
 * alto = farm fácil; avançar para regiões altas = desafio.
 *
 * A batalha é simulada no servidor (rodada a rodada, até 20 rodadas) com a
 * mesma decisão automática do Auto Battle. Cada chamada ao farm custa ENERGIA
 * (combustível do conteúdo secundário).
 */

import { xpForLevel, TOWER_MONSTER_IMAGES } from "./constants";
import { decideAutoAction, type AutoBattleSettings } from "./autoBattle";
import { rollBossEnchant } from "./forge";

export interface RegionMobDef {
  id: string;
  nameKey: string;
  image: string;
  icon: string;
  /** Força base do mob (escala com o nível da região). */
  atkMult: number;
  hpMult: number;
  defMult: number;
  /** XP/ouro extras do elite. */
  elite?: boolean;
}

export interface MiniBossDef {
  nameKey: string;
  image: string;
  icon: string;
  atkMult: number;
  hpMult: number;
  defMult: number;
}

/** Mobs por região (3-4 comuns + 1 elite marcado com `elite: true`). */
export const REGION_MOBS: Record<string, RegionMobDef[]> = {
  starter_village: [
    { id: "slime", nameKey: "regionmob.slime", image: "/images/mobs/slime.png", icon: "🟢", atkMult: 1, hpMult: 1, defMult: 1 },
    { id: "rato", nameKey: "regionmob.rato", image: "/images/mobs/rato.png", icon: "🐀", atkMult: 1.1, hpMult: 0.9, defMult: 0.9 },
    { id: "lobo_vila", nameKey: "regionmob.lobo_vila", image: "/images/mobs/lobo.png", icon: "🐺", atkMult: 1.2, hpMult: 1.1, defMult: 1 },
    { id: "slime_alfa", nameKey: "regionmob.slime_alfa", image: "/images/mobs/slime_alfa.png", icon: "🟢", atkMult: 1.6, hpMult: 1.8, defMult: 1.4, elite: true },
  ],
  forgotten_forest: [
    { id: "slime_verde", nameKey: "regionmob.slime_verde", image: "/images/mobs/slime.png", icon: "🟢", atkMult: 1.2, hpMult: 1.1, defMult: 1.1 },
    { id: "lobo", nameKey: "regionmob.lobo", image: "/images/mobs/lobo.png", icon: "🐺", atkMult: 1.3, hpMult: 1.2, defMult: 1.1 },
    { id: "aranha", nameKey: "regionmob.aranha", image: "/images/mobs/aranha.png", icon: "🕷️", atkMult: 1.4, hpMult: 1, defMult: 1 },
    { id: "lobo_alfa", nameKey: "regionmob.lobo_alfa", image: "/images/mobs/lobo_alfa.png", icon: "🐺", atkMult: 2, hpMult: 2.2, defMult: 1.6, elite: true },
  ],
  ancient_ruins: [
    { id: "esqueleto", nameKey: "regionmob.esqueleto", image: "/images/mobs/esqueleto.png", icon: "💀", atkMult: 1.5, hpMult: 1.3, defMult: 1.3 },
    { id: "golem_ruina", nameKey: "regionmob.golem_ruina", image: "/images/mobs/golem.png", icon: "🗿", atkMult: 1.4, hpMult: 1.8, defMult: 1.8 },
    { id: "espectro", nameKey: "regionmob.espectro", image: "/images/mobs/espectro.png", icon: "👻", atkMult: 1.6, hpMult: 1.1, defMult: 1.2 },
    { id: "golem_antigo", nameKey: "regionmob.golem_antigo", image: "/images/mobs/golem_alfa.png", icon: "🗿", atkMult: 2.2, hpMult: 2.6, defMult: 2.4, elite: true },
  ],
  deep_mines: [
    { id: "morcego", nameKey: "regionmob.morcego", image: "/images/mobs/morcego.png", icon: "🦇", atkMult: 1.6, hpMult: 1.2, defMult: 1.2 },
    { id: "goblin", nameKey: "regionmob.goblin", image: "/images/mobs/goblin.png", icon: "👺", atkMult: 1.7, hpMult: 1.4, defMult: 1.3 },
    { id: "cristal_vivo", nameKey: "regionmob.cristal_vivo", image: "/images/mobs/cristal_vivo.png", icon: "💎", atkMult: 1.5, hpMult: 1.9, defMult: 1.7 },
    { id: "goblin_chefe", nameKey: "regionmob.goblin_chefe", image: "/images/mobs/goblin_chefe.png", icon: "👺", atkMult: 2.4, hpMult: 2.8, defMult: 2.2, elite: true },
  ],
  dark_swamp: [
    { id: "sapo", nameKey: "regionmob.sapo", image: "/images/mobs/sapo.png", icon: "🐸", atkMult: 1.7, hpMult: 1.4, defMult: 1.3 },
    { id: "crocodilo", nameKey: "regionmob.crocodilo", image: "/images/mobs/crocodilo.png", icon: "🐊", atkMult: 1.8, hpMult: 1.8, defMult: 1.6 },
    { id: "cobra", nameKey: "regionmob.cobra", image: "/images/mobs/cobra.png", icon: "🐍", atkMult: 1.9, hpMult: 1.3, defMult: 1.2 },
    { id: "hidra_jovem", nameKey: "regionmob.hidra_jovem", image: "/images/mobs/hidra_jovem.png", icon: "🐍", atkMult: 2.6, hpMult: 3, defMult: 2.4, elite: true },
  ],
  frozen_mountains: [
    { id: "lobo_gelo", nameKey: "regionmob.lobo_gelo", image: "/images/mobs/lobo_gelo.png", icon: "🐺", atkMult: 2, hpMult: 1.8, defMult: 1.7 },
    { id: "urso", nameKey: "regionmob.urso", image: "/images/mobs/urso.png", icon: "🐻", atkMult: 2.1, hpMult: 2.4, defMult: 2 },
    { id: "troll", nameKey: "regionmob.troll", image: "/images/mobs/troll.png", icon: "🧌", atkMult: 2.2, hpMult: 2.2, defMult: 2.1 },
    { id: "troll_gigante", nameKey: "regionmob.troll_gigante", image: "/images/mobs/troll_gigante.png", icon: "🧌", atkMult: 3, hpMult: 3.6, defMult: 3, elite: true },
  ],
  scorching_desert: [
    { id: "escorpiao", nameKey: "regionmob.escorpiao", image: "/images/mobs/escorpiao.png", icon: "🦂", atkMult: 2.2, hpMult: 1.9, defMult: 1.9 },
    { id: "cobra_areia", nameKey: "regionmob.cobra_areia", image: "/images/mobs/cobra_areia.png", icon: "🐍", atkMult: 2.3, hpMult: 1.7, defMult: 1.6 },
    { id: "abutre", nameKey: "regionmob.abutre", image: "/images/mobs/abutre.png", icon: "🦅", atkMult: 2.4, hpMult: 1.8, defMult: 1.7 },
    { id: "escorpiao_imperial", nameKey: "regionmob.escorpiao_imperial", image: "/images/mobs/escorpiao_imperial.png", icon: "🦂", atkMult: 3.4, hpMult: 4, defMult: 3.2, elite: true },
  ],
  imperial_castle: [
    { id: "soldado", nameKey: "regionmob.soldado", image: "/images/mobs/soldado.png", icon: "🛡️", atkMult: 2.5, hpMult: 2.3, defMult: 2.4 },
    { id: "cavaleiro", nameKey: "regionmob.cavaleiro", image: "/images/mobs/cavaleiro.png", icon: "🐴", atkMult: 2.7, hpMult: 2.6, defMult: 2.8 },
    { id: "mago_corte", nameKey: "regionmob.mago_corte", image: "/images/mobs/mago_corte.png", icon: "🧙", atkMult: 2.9, hpMult: 2.1, defMult: 2 },
    { id: "capitao", nameKey: "regionmob.capitao", image: "/images/mobs/capitao.png", icon: "⚔️", atkMult: 4, hpMult: 4.6, defMult: 4.2, elite: true },
  ],
  lost_islands: [
    { id: "polvo", nameKey: "regionmob.polvo", image: "/images/mobs/polvo.png", icon: "🐙", atkMult: 2.8, hpMult: 2.6, defMult: 2.4 },
    { id: "tartaruga", nameKey: "regionmob.tartaruga", image: "/images/mobs/tartaruga.png", icon: "🐢", atkMult: 2.6, hpMult: 3.4, defMult: 3.2 },
    { id: "pirata", nameKey: "regionmob.pirata", image: "/images/mobs/pirata.png", icon: "🏴‍☠️", atkMult: 3, hpMult: 2.6, defMult: 2.4 },
    { id: "capitao_pirata", nameKey: "regionmob.capitao_pirata", image: "/images/mobs/capitao_pirata.png", icon: "🏴‍☠️", atkMult: 4.4, hpMult: 5, defMult: 4.4, elite: true },
  ],
  dragon_world: [
    { id: "dragao_filhote", nameKey: "regionmob.dragao_filhote", image: "/images/mobs/dragao_filhote.png", icon: "🐲", atkMult: 3.2, hpMult: 3, defMult: 2.8 },
    { id: "dragao_fogo", nameKey: "regionmob.dragao_fogo", image: "/images/mobs/dragao_fogo.png", icon: "🐉", atkMult: 3.5, hpMult: 3.4, defMult: 3 },
    { id: "dragao_trovão", nameKey: "regionmob.dragao_trovao", image: "/images/mobs/dragao_trovao.png", icon: "🐉", atkMult: 3.8, hpMult: 3.2, defMult: 3.2 },
    { id: "dragao_ancião_jovem", nameKey: "regionmob.dragao_anciao_jovem", image: "/images/mobs/dragao_anciao_jovem.png", icon: "🐉", atkMult: 5.2, hpMult: 6, defMult: 5, elite: true },
  ],
  demon_realm: [
    { id: "demonio_menor", nameKey: "regionmob.demonio_menor", image: "/images/mobs/demonio_menor.png", icon: "👹", atkMult: 3.8, hpMult: 3.4, defMult: 3.2 },
    { id: "imp", nameKey: "regionmob.imp", image: "/images/mobs/imp.png", icon: "😈", atkMult: 4, hpMult: 3, defMult: 2.8 },
    { id: "cavaleiro_sombrio", nameKey: "regionmob.cavaleiro_sombrio", image: "/images/mobs/cavaleiro_sombrio.png", icon: "🌑", atkMult: 4.2, hpMult: 4, defMult: 3.8 },
    { id: "general_demonio", nameKey: "regionmob.general_demonio", image: "/images/mobs/general_demonio.png", icon: "👹", atkMult: 6, hpMult: 7, defMult: 6, elite: true },
  ],
  celestial_temple: [
    { id: "anjo_menor", nameKey: "regionmob.anjo_menor", image: "/images/mobs/anjo_menor.png", icon: "😇", atkMult: 4.2, hpMult: 3.8, defMult: 3.8 },
    { id: "serafim_guarda", nameKey: "regionmob.serafim_guarda", image: "/images/mobs/serafim_guarda.png", icon: "🪽", atkMult: 4.5, hpMult: 4.2, defMult: 4 },
    { id: "guardião_celestial", nameKey: "regionmob.guardiao_celestial", image: "/images/mobs/guardiao_celestial.png", icon: "✨", atkMult: 4.8, hpMult: 4.6, defMult: 4.4 },
    { id: "arcanjo", nameKey: "regionmob.arcanjo", image: "/images/mobs/arcanjo.png", icon: "🌟", atkMult: 6.8, hpMult: 8, defMult: 7, elite: true },
  ],
};

/**
 * Mini-boss (respawn com cooldown) por região.
 *
 * IMAGENS: usam os monstros da TORRE (TOWER_MONSTER_IMAGES) — os arquivos de
 * /images/mobs/* não existem no projeto, então reaproveitamos os visuais da
 * torre que já estão no jogo (cada mini-boss recebe o visual mais parecido).
 */
export const REGION_MINI_BOSSES: Record<string, MiniBossDef> = {
  starter_village: { nameKey: "regionminiboss.guardiao_floresta", image: TOWER_MONSTER_IMAGES.sentinela_pedra, icon: "🌳", atkMult: 2.4, hpMult: 5, defMult: 2 },
  forgotten_forest: { nameKey: "regionminiboss.rei_ent", image: TOWER_MONSTER_IMAGES.golem, icon: "🌳", atkMult: 2.8, hpMult: 6, defMult: 2.4 },
  ancient_ruins: { nameKey: "regionminiboss.governante_ruinas", image: TOWER_MONSTER_IMAGES.esqueleto, icon: "🏛️", atkMult: 3.2, hpMult: 7, defMult: 2.8 },
  deep_mines: { nameKey: "regionminiboss.rei_mina", image: TOWER_MONSTER_IMAGES.gargula_ferro, icon: "⛏️", atkMult: 3.6, hpMult: 8, defMult: 3.2 },
  dark_swamp: { nameKey: "regionminiboss.senhor_pantano", image: TOWER_MONSTER_IMAGES.quimera_torre, icon: "🐊", atkMult: 4, hpMult: 9, defMult: 3.6 },
  frozen_mountains: { nameKey: "regionminiboss.rei_geada", image: TOWER_MONSTER_IMAGES.lich_trono, icon: "🧊", atkMult: 4.6, hpMult: 10, defMult: 4.2 },
  scorching_desert: { nameKey: "regionminiboss.farao_areia", image: TOWER_MONSTER_IMAGES.avatar_eternidade, icon: "🏜️", atkMult: 5.2, hpMult: 11, defMult: 4.8 },
  imperial_castle: { nameKey: "regionminiboss.general_imperial", image: TOWER_MONSTER_IMAGES.cavaleiro_corrompido, icon: "🏰", atkMult: 6, hpMult: 12, defMult: 5.4 },
  lost_islands: { nameKey: "regionminiboss.kraken_filhote", image: TOWER_MONSTER_IMAGES.beholder_vigilancia, icon: "🐙", atkMult: 6.8, hpMult: 13, defMult: 6 },
  dragon_world: { nameKey: "regionminiboss.dragao_guardião", image: TOWER_MONSTER_IMAGES.dragao, icon: "🐉", atkMult: 7.6, hpMult: 14, defMult: 6.8 },
  demon_realm: { nameKey: "regionminiboss.príncipe_demonio", image: TOWER_MONSTER_IMAGES.mago_caos, icon: "😈", atkMult: 8.4, hpMult: 15, defMult: 7.6 },
  celestial_temple: { nameKey: "regionminiboss.arcanjo_supremo", image: TOWER_MONSTER_IMAGES.invocador_almas, icon: "🌟", atkMult: 9.2, hpMult: 16, defMult: 8.4 },
};

/** Cooldown do mini-boss (ms). */
export const MINI_BOSS_COOLDOWN_MS = 30 * 60 * 1000;

export function mobsForRegion(regionId: string): RegionMobDef[] {
  return REGION_MOBS[regionId] ?? REGION_MOBS.starter_village;
}

export function miniBossForRegion(regionId: string): MiniBossDef | null {
  return REGION_MINI_BOSSES[regionId] ?? null;
}

/** Stats do mob escalados pela região (fixos, não espelham o jogador). */
export function regionMobStats(mob: RegionMobDef, regionLevel: number) {
  const f = Math.max(1, Math.floor(Number(regionLevel) || 1));
  return {
    maxHp: Math.round(mob.hpMult * (30 + f * 14)),
    attack: Math.round(mob.atkMult * (5 + f * 2)),
    defense: Math.round(mob.defMult * (1 + f * 1)),
    speed: Math.max(1, Math.round((1 + f * 0.04) * 100) / 100),
    critical: Math.min(25, Math.round(1 + f * 0.15)),
    dodge: Math.min(10, Math.round((0.5 + f * 0.07) * 10) / 10),
  };
}

/** Stats do mini-boss escalados pela região. */
export function miniBossStats(mb: MiniBossDef, regionLevel: number) {
  const f = Math.max(1, Math.floor(Number(regionLevel) || 1));
  return {
    maxHp: Math.round(mb.hpMult * (40 + f * 16)),
    attack: Math.round(mb.atkMult * (6 + f * 2.2)),
    defense: Math.round(mb.defMult * (1 + f * 1.1)),
    speed: Math.max(1, Math.round((1 + f * 0.05) * 100) / 100),
    critical: Math.min(30, Math.round(1 + f * 0.2)),
    dodge: Math.min(12, Math.round((0.5 + f * 0.08) * 10) / 10),
  };
}

/** Recompensa do mob (XP escala com a curva de nível; elite dá mais). */
export function mobRewards(char: any, regionLevel: number, elite: boolean, won: boolean) {
  const lv = Math.max(1, Number(char?.level) || 1);
  if (!won) return { xp: 0, gold: 0 };
  const mult = elite ? 2.5 : 1;
  const xp = Math.max(10, Math.floor(xpForLevel(lv) * (0.008 + regionLevel * 0.0008) * mult));
  const gold = Math.max(15, Math.round((25 + regionLevel * 8) * mult));
  return { xp, gold };
}

export interface RegionMobFightResult {
  won: boolean;
  rounds: number;
  log: string[];
  elite: boolean;
  rewards: { xp: number; gold: number };
}

const FARM_MAX_ROUNDS = 20;

function strike(
  att: { attack: number; critical: number; precision: number },
  def: { defense: number; dodge: number }
) {
  const dodge = Math.max(0, def.dodge - (att.precision || 0));
  if (Math.random() * 100 < dodge) return { hit: false, dmg: 0, crit: false, dodged: true };
  let dmg = Math.max(1, Math.round(att.attack - Math.floor(def.defense * 0.4)));
  const crit = Math.random() * 100 < att.critical;
  if (crit) dmg = Math.round(dmg * 1.7);
  return { hit: true, dmg, crit, dodged: false };
}

/** Sorteia um mob da região (elite com ~5%). */
export function rollRegionMob(regionId: string): { mob: RegionMobDef; elite: boolean } {
  const mobs = mobsForRegion(regionId);
  const normal = mobs.filter((m) => !m.elite);
  const elites = mobs.filter((m) => m.elite);
  const isElite = elites.length > 0 && Math.random() < 0.05;
  const pool = isElite ? elites : normal;
  const mob = pool[Math.floor(Math.random() * pool.length)] ?? mobs[0];
  return { mob, elite: isElite };
}

/** Simula a batalha contra um mob da região. */
export function simulateRegionMobFight(
  char: any,
  regionLevel: number,
  mob: RegionMobDef,
  elite: boolean
): RegionMobFightResult {
  const stats = regionMobStats(mob, regionLevel);
  const log: string[] = [];
  let charHp = Number(char.maxHp) || 100;
  let charMp = Number(char.maxMana) || 50;
  const charMaxHp = charHp;
  let mobHp = stats.maxHp;

  const attack = Number(char.attack) || 0;
  const defense = Number(char.defense) || 0;
  const critical = Math.min(90, Number(char.critical) || 0);
  const precision = Number(char.precision) || 0;
  const dodge = Math.min(50, Number(char.dodge) || 0);
  const speed = Number(char.speed) || 0;

  const autoSettings: AutoBattleSettings = {
    mode: "balanced",
    useSkill: true,
    potionEnabled: false,
    potionPct: 30,
  };

  let round = 0;
  while (round < FARM_MAX_ROUNDS && charHp > 0 && mobHp > 0) {
    round++;
    const action = decideAutoAction(
      {
        hp: charHp,
        maxHp: charMaxHp,
        mp: charMp,
        maxMp: Number(char.maxMana) || 50,
        enemyHp: mobHp,
        enemyMaxHp: stats.maxHp,
        skillCost: 15,
        round,
      },
      autoSettings
    );

    let defended = false;
    if (action === "defend") {
      defended = true;
      charMp = Math.min(Number(char.maxMana) || 50, charMp + 8);
    } else if (action === "skill" && charMp >= 15) {
      charMp -= 15;
      const r = strike({ attack: Math.round(attack * 1.8), critical: critical + 15, precision }, { defense: stats.defense, dodge: stats.dodge });
      if (r.hit) {
        mobHp = Math.max(0, mobHp - r.dmg);
        log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥" : ""}`);
      }
    } else {
      const r = strike({ attack, critical, precision }, { defense: stats.defense, dodge: stats.dodge });
      if (r.hit) {
        mobHp = Math.max(0, mobHp - r.dmg);
        log.push(`⚔️ Ataque! -${r.dmg}${r.crit ? " 💥" : ""}`);
      } else {
        log.push("💨 O mob esquivou!");
      }
    }

    // Velocidade: ataque extra.
    if (!defended && mobHp > 0) {
      const speedChance = Math.min(50, Math.max(0, (speed - stats.speed) * 0.5));
      if (Math.random() * 100 < speedChance) {
        const r2 = strike({ attack, critical, precision }, { defense: stats.defense, dodge: stats.dodge });
        if (r2.hit) {
          mobHp = Math.max(0, mobHp - r2.dmg);
          log.push(`⚡ Velocidade! Ataque extra! -${r2.dmg}`);
        }
      }
    }

    if (mobHp > 0) {
      const r = strike({ attack: stats.attack, critical: stats.critical, precision: 0 }, { defense, dodge });
      if (r.hit) {
        const taken = Math.max(1, Math.round((defended ? r.dmg * 0.5 : r.dmg) * Math.max(0.7, 1 - (Number(char.resistance) || 0) * 0.0033)));
        charHp = Math.max(0, charHp - taken);
        log.push(`🗡️ O mob atacou! -${taken}`);
      }
    }
  }

  const won = mobHp <= 0 && charHp > 0;
  const rewards = mobRewards(char, regionLevel, elite, won);
  return { won, rounds: round, log, elite, rewards };
}

/** Recompensa do mini-boss. */
export function miniBossRewards(char: any, regionLevel: number, won: boolean) {
  const lv = Math.max(1, Number(char?.level) || 1);
  if (!won) return { xp: 0, gold: 0 };
  const xp = Math.max(40, Math.floor(xpForLevel(lv) * (0.03 + regionLevel * 0.0018)));
  const gold = Math.max(60, Math.round((90 + regionLevel * 24) * (1 + lv * 0.008)));
  return { xp, gold };
}

export interface MiniBossFightResult {
  won: boolean;
  rounds: number;
  log: string[];
  rewards: { xp: number; gold: number };
  drop: { templateId: number; nameKey: string; icon: string; image: string; rarity: string; enchant: any } | null;
}

/** Simula a batalha contra o mini-boss da região (drop exclusivo + encanto). */
export function simulateMiniBossFight(
  char: any,
  mb: MiniBossDef,
  allTemplates: any[]
): MiniBossFightResult {
  const regionLevel = Math.max(1, Number(char.level) || 1);
  const stats = miniBossStats(mb, regionLevel);
  const log: string[] = [];
  let charHp = Number(char.maxHp) || 100;
  let charMp = Number(char.maxMana) || 50;
  const charMaxHp = charHp;
  let mbHp = stats.maxHp;

  const attack = Number(char.attack) || 0;
  const defense = Number(char.defense) || 0;
  const critical = Math.min(90, Number(char.critical) || 0);
  const precision = Number(char.precision) || 0;
  const dodge = Math.min(50, Number(char.dodge) || 0);
  const speed = Number(char.speed) || 0;

  const autoSettings: AutoBattleSettings = {
    mode: "balanced",
    useSkill: true,
    potionEnabled: false,
    potionPct: 30,
  };

  let round = 0;
  while (round < 30 && charHp > 0 && mbHp > 0) {
    round++;
    const action = decideAutoAction(
      {
        hp: charHp,
        maxHp: charMaxHp,
        mp: charMp,
        maxMp: Number(char.maxMana) || 50,
        enemyHp: mbHp,
        enemyMaxHp: stats.maxHp,
        skillCost: 15,
        round,
      },
      autoSettings
    );

    let defended = false;
    if (action === "defend") {
      defended = true;
      charMp = Math.min(Number(char.maxMana) || 50, charMp + 8);
    } else if (action === "skill" && charMp >= 15) {
      charMp -= 15;
      const r = strike({ attack: Math.round(attack * 1.8), critical: critical + 15, precision }, { defense: stats.defense, dodge: stats.dodge });
      if (r.hit) {
        mbHp = Math.max(0, mbHp - r.dmg);
        log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥" : ""}`);
      }
    } else {
      const r = strike({ attack, critical, precision }, { defense: stats.defense, dodge: stats.dodge });
      if (r.hit) {
        mbHp = Math.max(0, mbHp - r.dmg);
        log.push(`⚔️ Ataque! -${r.dmg}${r.crit ? " 💥" : ""}`);
      } else {
        log.push("💨 O mini-boss esquivou!");
      }
    }

    if (!defended && mbHp > 0) {
      const speedChance = Math.min(50, Math.max(0, (speed - stats.speed) * 0.5));
      if (Math.random() * 100 < speedChance) {
        const r2 = strike({ attack, critical, precision }, { defense: stats.defense, dodge: stats.dodge });
        if (r2.hit) {
          mbHp = Math.max(0, mbHp - r2.dmg);
          log.push(`⚡ Velocidade! Ataque extra! -${r2.dmg}`);
        }
      }
    }

    if (mbHp > 0) {
      const r = strike({ attack: stats.attack, critical: stats.critical, precision: 0 }, { defense, dodge });
      if (r.hit) {
        const taken = Math.max(1, Math.round((defended ? r.dmg * 0.5 : r.dmg) * Math.max(0.7, 1 - (Number(char.resistance) || 0) * 0.0033)));
        charHp = Math.max(0, charHp - taken);
        log.push(`🗡️ O mini-boss atacou! -${taken}`);
      }
    }
  }

  const won = mbHp <= 0 && charHp > 0;
  const rewards = miniBossRewards(char, regionLevel, won);

  // Drop exclusivo: item de raridade alta + encanto de chefe.
  let drop: MiniBossFightResult["drop"] = null;
  if (won) {
    const lv = Number(char.level) || 1;
    const usable = allTemplates.filter((it: any) => {
      if (it.type === "consumable" || it.stackable === true) return false;
      if (!it.slot) return false;
      const idx = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"].indexOf(String(it.rarity));
      if (idx < 0 || idx < 2) return false;
      return (Number(it.minLevel) || 1) <= lv + 10;
    });
    if (usable.length > 0) {
      const pick = usable[Math.floor(Math.random() * usable.length)];
      const enchant = rollBossEnchant();
      drop = {
        templateId: Number(pick.id),
        nameKey: pick.nameKey,
        icon: pick.icon,
        image: pick.image,
        rarity: String(pick.rarity || "rare"),
        enchant,
      };
    }
  }

  return { won, rounds: round, log, rewards, drop };
}
