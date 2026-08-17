/**
 * BOSSES REGIONAIS 👹 — chefes permanentes de cada região.
 *
 * Cada uma das 12 regiões tem seu próprio boss (Rei Slime, Ent Ancestral,
 * Hidra, Yeti...). O boss escala com a região (minLevel → mais forte) e pode
 * ser derrotado 1x por dia por região — depois entra em cooldown até meia-noite.
 *
 * A batalha é SIMULADA no servidor (rodada a rodada, até 40 rodadas): o herói
 * luta sozinho com decisão automática (defende com HP baixo, usa o golpe com
 * mana — a mesma lógica do Auto Battle da torre). A UI só exibe o resultado.
 *
 * Recompensas: XP/ouro escalados, e DROP EXCLUSIVO do boss (item de raridade
 * alta da região com encanto de chefe) + chance de poção.
 */

import { xpForLevel, powerCalc, TOWER_MONSTER_IMAGES, type RegionId } from "./constants";
import { decideAutoAction, type AutoBattleSettings } from "./autoBattle";
import { petCombatBuff } from "./pets";
import { rollBossEnchant } from "./forge";

export interface RegionBossDef {
  regionId: RegionId;
  nameKey: string;
  /** Imagem reutilizada dos monstros da torre (sem assets novos). */
  image: string;
  icon: string;
  /** Nível mínimo da região (para escalar os stats). */
  regionLevel: number;
  /** HP/ataque/defesa multiplicadores da escala do boss. */
  hpMult: number;
  atkMult: number;
  defMult: number;
}

/**
 * Um boss por região — do Rei Slime ao Serafim Celestial.
 *
 * IMAGENS: usam os chefes da TORRE (TOWER_MONSTER_IMAGES) — os arquivos
 * /images/tower/boss_*.png não existem no projeto. Cada boss regional recebe
 * o visual de chefe da torre mais parecido (Rei Slime → slime gigante, Ent
 * Ancestral → Guardião das Raízes, Escorpião Rei → Escorpião de Areia...).
 */
export const REGION_BOSSES: RegionBossDef[] = [
  { regionId: "starter_village", nameKey: "regionboss.slime_king", image: TOWER_MONSTER_IMAGES.slime, icon: "👑", regionLevel: 1, hpMult: 14, atkMult: 3.2, defMult: 1.6 },
  { regionId: "forgotten_forest", nameKey: "regionboss.ancestral_ent", image: TOWER_MONSTER_IMAGES.root_guardian, icon: "🌳", regionLevel: 5, hpMult: 16, atkMult: 3.6, defMult: 1.8 },
  { regionId: "ancient_ruins", nameKey: "regionboss.ancient_guardian", image: TOWER_MONSTER_IMAGES.steam_automaton, icon: "🏛️", regionLevel: 10, hpMult: 18, atkMult: 4.0, defMult: 2.0 },
  { regionId: "deep_mines", nameKey: "regionboss.goblin_king", image: TOWER_MONSTER_IMAGES.mushroom_brute, icon: "⛏️", regionLevel: 15, hpMult: 20, atkMult: 4.4, defMult: 2.2 },
  { regionId: "dark_swamp", nameKey: "regionboss.hydra", image: TOWER_MONSTER_IMAGES.void_wyrm, icon: "🐍", regionLevel: 20, hpMult: 22, atkMult: 4.8, defMult: 2.4 },
  { regionId: "frozen_mountains", nameKey: "regionboss.yeti", image: TOWER_MONSTER_IMAGES.glacier_troll, icon: "🏔️", regionLevel: 30, hpMult: 26, atkMult: 5.4, defMult: 2.8 },
  { regionId: "scorching_desert", nameKey: "regionboss.scorpion_king", image: TOWER_MONSTER_IMAGES.sand_scorpion, icon: "🏜️", regionLevel: 40, hpMult: 30, atkMult: 6.0, defMult: 3.2 },
  { regionId: "imperial_castle", nameKey: "regionboss.dark_knight", image: TOWER_MONSTER_IMAGES.eclipse_lich, icon: "🏰", regionLevel: 50, hpMult: 34, atkMult: 6.6, defMult: 3.6 },
  { regionId: "lost_islands", nameKey: "regionboss.kraken", image: TOWER_MONSTER_IMAGES.coral_kraken, icon: "🏝️", regionLevel: 60, hpMult: 38, atkMult: 7.2, defMult: 4.0 },
  { regionId: "dragon_world", nameKey: "regionboss.ancient_dragon", image: TOWER_MONSTER_IMAGES.dragao, icon: "🐉", regionLevel: 75, hpMult: 44, atkMult: 8.2, defMult: 4.6 },
  { regionId: "demon_realm", nameKey: "regionboss.demon_lord", image: TOWER_MONSTER_IMAGES.ember_phoenix, icon: "👹", regionLevel: 90, hpMult: 52, atkMult: 9.4, defMult: 5.4 },
  { regionId: "celestial_temple", nameKey: "regionboss.seraphim", image: TOWER_MONSTER_IMAGES.thunder_roc, icon: "⛪", regionLevel: 100, hpMult: 58, atkMult: 10.4, defMult: 6.0 },
];

export function regionBossFor(regionId: string): RegionBossDef | null {
  return REGION_BOSSES.find((b) => b.regionId === regionId) ?? null;
}

/**
 * Stats do boss — FIXOS pela região (não espelham o jogador).
 * O Rei Slime da vila continua fraco para quem voltou mais forte (sensação de
 * progresso), e o Serafim do Templo Celestial continua um desafio de endgame.
 */
export function regionBossStats(boss: RegionBossDef, _charLevel?: number) {
  const f = Math.max(1, Math.floor(Number(boss.regionLevel) || 1));
  return {
    maxHp: Math.round(boss.hpMult * (40 + f * 16)),
    attack: Math.round(boss.atkMult * (6 + f * 2.2)),
    defense: Math.round(boss.defMult * (1 + f * 1.1)),
    speed: Math.max(1, Math.round((1 + f * 0.05) * 100) / 100),
    critical: Math.min(30, Math.round(1 + f * 0.2)),
    dodge: Math.min(12, Math.round((0.5 + f * 0.08) * 10) / 10),
  };
}

/**
 * Stats do boss regional na BATALHA (combate falso 🎬): a vida aguenta ~7
 * golpes do jogador e o ataque só arranha (~7% da vida máxima por rodada),
 * então o jogador domina como num mega PvP e parece que vai ganhar. A
 * ameaça real é a RAGE (super ataque) — e depois ele se esgota.
 */
export function regionBossBattleMonster(char: any, boss: RegionBossDef) {
  const s = regionBossStats(boss, Math.max(1, Number(char?.level) || 1));
  const playerMaxHit = Math.max(150, Math.round((Number(char?.attack) || 0) * 1.7));
  const playerMaxHp = Math.max(250, Number(char?.maxHp) || 250);
  return {
    maxHp: Math.round(playerMaxHit * 7),
    // Dominação: ataque CAPADO em ~5% da vida do jogador (sem hitkill no
    // começo — o chefe "parece fraco" e o jogador domina como num mega PvP).
    attack: Math.max(1, Math.min(s.attack, Math.round(playerMaxHp * 0.05))),
    defense: Math.max(1, Math.round(s.defense * 0.7)),
    speed: s.speed,
    critical: Math.max(5, Math.round(s.critical * 0.6)),
    dodge: Math.max(2, Math.round(s.dodge * 0.6)),
  };
}

/** Chave de data local (YYYY-MM-DD) para o cooldown diário. */
export function bossDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Registro de derrotas por boss: { [regionId]: "YYYY-MM-DD" }. */
export function getBossKills(char: any): Record<string, string> {
  const k = char?.regionBossKills;
  return k && typeof k === "object" ? k : {};
}

/** Já derrotou este boss hoje? */
export function bossKilledToday(char: any, regionId: string, now: Date = new Date()): boolean {
  return getBossKills(char)[regionId] === bossDateKey(now);
}

/** Bônus de recompensa: cada boss derrotado na região dá um pouco mais de XP/ouro. */
export function bossRewards(boss: RegionBossDef, char: any, won: boolean) {
  const lv = Math.max(1, Number(char?.level) || 1);
  if (!won) {
    return { xp: 0, gold: 0 };
  }
  const xp = Math.max(50, Math.floor(xpForLevel(lv) * (0.04 + boss.regionLevel * 0.002)));
  const gold = Math.max(80, Math.round((120 + boss.regionLevel * 30) * (1 + lv * 0.01)));
  return { xp, gold };
}

export interface RegionBossFightResult {
  won: boolean;
  rounds: number;
  log: string[];
  playerHpLeft: number;
  bossHpLeft: number;
  /** Drop exclusivo (item + encanto de chefe) — null se não venceu. */
  drop: { templateId: number; nameKey: string; icon: string; image: string; rarity: string; enchant: any } | null;
  potionDrop: boolean;
  rewards: { xp: number; gold: number };
}

const MAX_ROUNDS = 40;

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

/**
 * Simula a batalha completa contra o boss regional.
 * O herói luta com decisão automática (modo equilibrado + skill).
 */
export function simulateRegionBossFight(
  char: any,
  boss: RegionBossDef,
  allTemplates: any[]
): RegionBossFightResult {
  const stats = regionBossStats(boss, char.level || 1);
  const log: string[] = [];

  // Stats do herói (com pet).
  const pet = petCombatBuff(char);
  const atkMult = pet?.damagePct ? 1 + pet.damagePct / 100 : 1;
  const defMult = pet?.defensePct ? 1 + pet.defensePct / 100 : 1;
  const hpMult = pet?.maxHpPct ? 1 + pet.maxHpPct / 100 : 1;

  let charHp = Math.round((Number(char.maxHp) || 100) * hpMult);
  let charMp = Number(char.maxMana) || 50;
  let bossHp = stats.maxHp;
  const charMaxHp = charHp;

  const attack = Math.round((Number(char.attack) || 0) * atkMult);
  const defense = Math.round((Number(char.defense) || 0) * defMult);
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
  while (round < MAX_ROUNDS && charHp > 0 && bossHp > 0) {
    round++;
    // Decisão automática do herói (mesma lógica do Auto Battle).
    const action = decideAutoAction(
      {
        hp: charHp,
        maxHp: charMaxHp,
        mp: charMp,
        maxMp: Number(char.maxMana) || 50,
        enemyHp: bossHp,
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
        bossHp = Math.max(0, bossHp - r.dmg);
        log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥" : ""}`);
      } else {
        log.push("💨 O boss desviou do golpe!");
      }
    } else {
      const r = strike({ attack, critical, precision }, { defense: stats.defense, dodge: stats.dodge });
      if (r.hit) {
        bossHp = Math.max(0, bossHp - r.dmg);
        log.push(`⚔️ Ataque! -${r.dmg}${r.crit ? " 💥" : ""}`);
      } else {
        log.push("💨 O boss esquivou!");
      }
    }

    // Contra-ataque do boss (se ainda vivo).
    if (bossHp > 0) {
      const r = strike({ attack: stats.attack, critical: stats.critical, precision: 0 }, { defense, dodge });
      if (r.hit) {
        const taken = Math.max(1, Math.round((defended ? r.dmg * 0.5 : r.dmg) * Math.max(0.7, 1 - (Number(char.resistance) || 0) * 0.0033)));
        charHp = Math.max(0, charHp - taken);
        log.push(`🗡️ O boss atacou! -${taken}${r.crit ? " 💥" : ""}`);
      } else {
        log.push("✅ Você desviou do ataque do boss!");
      }
    }
  }

  const won = bossHp <= 0 && charHp > 0;

  // Drop exclusivo do boss: item de raridade alta da região + encanto de chefe.
  let drop: RegionBossFightResult["drop"] = null;
  let potionDrop = false;
  if (won) {
    const lv = Number(char.level) || 1;
    const minRarityIdx = Math.min(
      ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"].length - 1,
      boss.regionLevel < 10 ? 2 : boss.regionLevel < 30 ? 3 : boss.regionLevel < 60 ? 4 : boss.regionLevel < 85 ? 5 : 6
    );
    const usable = allTemplates.filter((it: any) => {
      if (it.type === "consumable" || it.stackable === true) return false;
      if (!it.slot) return false;
      const idx = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"].indexOf(String(it.rarity));
      if (idx < 0 || idx < minRarityIdx) return false;
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
    // Chance de poção junto.
    const potions = allTemplates.filter((it: any) => it.type === "consumable" && Number(it.effect?.hp || 0) > 0);
    potionDrop = potions.length > 0 && Math.random() < 0.5;
  }

  const rewards = bossRewards(boss, char, won);

  return {
    won,
    rounds: round,
    log,
    playerHpLeft: charHp,
    bossHpLeft: bossHp,
    drop,
    potionDrop,
    rewards,
  };
}

/** Poder do jogador (para a prévia do boss na UI). */
export function bossPowerPreview(char: any): number {
  return powerCalc({
    attack: Number(char.attack) || 0,
    defense: Number(char.defense) || 0,
    hp: Number(char.maxHp) || 100,
    speed: Number(char.speed) || 0,
    critical: Number(char.critical) || 0,
    level: Number(char.level) || 1,
  });
}
