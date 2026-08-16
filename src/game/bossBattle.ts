/**
 * BATALHA DE CHEFE ⚔️ — motor de combate turno a turno COMPARTILHADO.
 *
 * Usado pelo mini-boss regional, pelo boss regional e pelo boss de guilda:
 * a luta agora acontece igual à TORRE (imagem do monstro, barras de HP,
 * golpe/defesa, auto battle) em vez de ser resolvida num log instantâneo.
 *
 * Mecânicas idênticas à torre:
 *   - ataque / golpe poderoso / defender (com custo de mana)
 *   - ataque extra por velocidade, contra-ataque com resistência
 *   - revive da Fênix (1x por batalha)
 *   - TTL anti-burla: batalha abandonada (saiu da página >2min) expira
 */

import { classSkillEffect, type ClassName } from "./constants";
import { decideAutoAction } from "./autoBattle";
import { petCombatBuff } from "./pets";
import { bestiaryDamageBonus } from "./bestiary";
import { applyRelicCombat } from "./relics";
import { applySpecializationCombat } from "./specializations";
import { applyAdvancedClassCombat, advSkillDmgMult } from "./advancedClasses";
import { applyAscensionCombat } from "./ascension";

export interface BossBattleMonster {
  nameKey: string;
  image: string;
  icon?: string;
  stats: {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    critical: number;
    dodge: number;
  };
  /** Marca o monstro como chefe (borda dourada na UI). */
  boss?: boolean;
}

export interface BossBattleState {
  seed: number;
  startedAt: number;
  monNameKey: string;
  monImage: string;
  boss: boolean;
  scaled: boolean;
  monMaxHp: number;
  monHp: number;
  monAttack: number;
  monDefense: number;
  monSpeed: number;
  monCritical: number;
  monDodge: number;
  charMaxHp: number;
  charHp: number;
  charMaxMp: number;
  charMp: number;
  round: number;
  petRevived: boolean;
}

/** Batalha abandonada expira após 2 min (mesmo TTL da torre). */
export const BOSS_BATTLE_TTL_MS = 2 * 60 * 1000;
export const BOSS_BATTLE_MAX_ROUNDS = 40;
const SKILL_COST = 15;

/** Golpe: retorna dano, crítico ou esquiva (mesma fórmula da torre). */
export function strike(
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
 * Stats de COMBATE do personagem com TODOS os buffs (bestiário, relíquia,
 * especialização, classe avançada, ascensão, guilda e pet) — mesma conta da
 * torre, para o chefe ser tão difícil quanto o andar equivalente.
 */
export function buildCharCombat(char: any) {
  const ca: { attack: number; defense: number; speed: number; critical: number; dodge: number; precision: number; maxHp: number; maxMana: number; resistance: number } = {
    attack: Number(char.attack) || 0,
    defense: Number(char.defense) || 0,
    speed: Number(char.speed) || 0,
    critical: Math.min(90, Number(char.critical) || 0),
    dodge: Math.min(50, Number(char.dodge) || 0),
    precision: Number(char.precision) || 0,
    maxHp: Number(char.maxHp) || 100,
    maxMana: Number(char.maxMana) || 50,
    resistance: Number(char.resistance) || 0,
  };
  // Bestiário: +5% dano por categoria completa.
  const bestiaryBonus = bestiaryDamageBonus(char);
  if (bestiaryBonus) ca.attack = Math.round(ca.attack * (1 + bestiaryBonus / 100));
  // Relíquia / especialização / classe avançada / ascensão.
  applyRelicCombat(char, ca as any);
  applySpecializationCombat(char, ca as any);
  applyAdvancedClassCombat(char, ca as any);
  applyAscensionCombat(char, ca as any);
  // Guilda: buffs de HP máx % e dano %.
  const guildBuff = (char.guildBuffs && typeof char.guildBuffs === "object" ? char.guildBuffs : {}) as Record<string, number>;
  if (guildBuff.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + (Number(guildBuff.maxHpPct) || 0) / 100));
  if (guildBuff.damagePct) ca.attack = Math.round(ca.attack * (1 + (Number(guildBuff.damagePct) || 0) / 100));
  // Pet equipado.
  const petBuff = petCombatBuff(char);
  if (petBuff) {
    if (petBuff.damagePct) ca.attack = Math.round(ca.attack * (1 + petBuff.damagePct / 100));
    if (petBuff.defensePct) ca.defense = Math.round(ca.defense * (1 + petBuff.defensePct / 100));
    if (petBuff.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + petBuff.maxHpPct / 100));
    if (petBuff.critPct) ca.critical = Math.min(90, ca.critical + petBuff.critPct);
  }
  return { ca, petBuff };
}

/** Anti-one-shot: se o jogador mataria o chefe num único golpe, escala. */
function antiOneShot(mon: any, ca: any) {
  const playerMaxHit = Math.round(ca.attack * 1.7);
  if (playerMaxHit < mon.maxHp) return { ...mon, scaled: false };
  const hp = Math.max(mon.maxHp, Math.round(playerMaxHit * 6));
  const atk = Math.max(mon.attack, Math.round(ca.maxHp * 0.2));
  return { ...mon, maxHp: hp, attack: atk, scaled: true };
}

/** Inicia a batalha: estado fresco com stats do monstro e do herói. */
export function bossBattleStart(char: any, monster: BossBattleMonster) {
  const { ca, petBuff } = buildCharCombat(char);
  const mon = antiOneShot({ ...monster.stats, boss: monster.boss !== false }, ca);
  return {
    ca,
    petBuff,
    battle: {
      seed: Math.floor(Math.random() * 1e9),
      startedAt: Date.now(),
      monNameKey: monster.nameKey,
      monImage: monster.image,
      boss: mon.boss,
      scaled: !!mon.scaled,
      monMaxHp: mon.maxHp,
      monHp: mon.maxHp,
      monAttack: mon.attack,
      monDefense: mon.defense,
      monSpeed: mon.speed,
      monCritical: mon.critical,
      monDodge: mon.dodge,
      charMaxHp: ca.maxHp,
      charHp: ca.maxHp,
      charMaxMp: ca.maxMana,
      charMp: ca.maxMana,
      round: 0,
      petRevived: false,
    },
  };
}

export interface BossBattleStepResult {
  battle: BossBattleState;
  log: string[];
  events: any[];
  won: boolean;
  lost: boolean;
  error?: string;
  code?: string;
}

/**
 * Executa UMA rodada da batalha. `action` = "attack" | "skill" | "defend" |
 * "auto". No "auto" o servidor decide pela configuração de Auto Battle.
 * Batalha abandonada (TTL estourado) retorna { error, code: "battle_expired" }.
 */
export function bossBattleStep(
  char: any,
  monster: BossBattleMonster,
  state: BossBattleState,
  action: string,
  autoSettings: any
): BossBattleStepResult {
  if (!state || typeof state.monHp !== "number") {
    return { error: "Estado de batalha inválido", code: "bad_state", battle: state, log: [], events: [], won: false, lost: false };
  }
  const startedAt = Number(state.startedAt) || 0;
  if (startedAt > 0 && Date.now() - startedAt > BOSS_BATTLE_TTL_MS) {
    return { error: "Batalha expirada — você ficou fora tempo demais. Recomece!", code: "battle_expired", battle: state, log: [], events: [], won: false, lost: false };
  }

  const { ca, petBuff } = buildCharCombat(char);
  const mon = antiOneShot({ ...monster.stats, boss: monster.boss !== false }, ca);

  // Estado atual (não confia cegamente no cliente).
  let charHp = Math.min(ca.maxHp, Math.max(1, Number(state.charHp) || ca.maxHp));
  let charMp = Math.min(ca.maxMana, Math.max(0, Number(state.charMp) || ca.maxMana));
  let monHp = Math.min(mon.maxHp, Math.max(0, Number(state.monHp) || mon.maxHp));
  let round = Math.max(0, Number(state.round) || 0);
  let petRevived = !!state.petRevived;

  const log: string[] = [];
  const events: any[] = [];
  let defended = false;

  const skillFx = classSkillEffect((char.classType as ClassName) || "warrior");

  // AUTO BATTLE: servidor decide a ação.
  let resolvedAction = action;
  if (action === "auto") {
    resolvedAction = decideAutoAction(
      {
        hp: charHp,
        maxHp: ca.maxHp,
        mp: charMp,
        maxMp: ca.maxMana,
        enemyHp: monHp,
        enemyMaxHp: mon.maxHp,
        skillCost: skillFx.manaCost ?? SKILL_COST,
        round,
      },
      autoSettings
    );
  }

  // ---- Ação do herói ----
  if (resolvedAction === "defend") {
    defended = true;
    charMp = Math.min(ca.maxMana, charMp + 8);
    log.push("🛡️ Você assume postura de defesa.");
    events.push({ type: "defend", target: "player" });
  } else if (resolvedAction === "skill") {
    const cost = skillFx.manaCost ?? SKILL_COST;
    if (charMp < cost) {
      return { error: "Mana insuficiente", code: "no_mana", battle: state, log, events, won: false, lost: false };
    }
    charMp -= cost;
    const pierceDef = mon.defense * (1 - (skillFx.pierce || 0));
    const advSkillMult = advSkillDmgMult(char);
    const r = strike(
      { attack: Math.round(ca.attack * (skillFx.dmgMult || 1.8) * advSkillMult), critical: ca.critical + (skillFx.critBonus ?? 15), precision: ca.precision },
      { defense: pierceDef, dodge: mon.dodge }
    );
    if (r.dodged) {
      log.push(`💨 O chefe desviou do golpe poderoso!`);
      events.push({ type: "dodge", target: "monster" });
    } else {
      monHp = Math.max(0, monHp - r.dmg);
      log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
      events.push({ type: r.crit ? "crit" : "skill", target: "monster", amount: r.dmg });
      if (skillFx.doubleStrikeChance && Math.random() * 100 < skillFx.doubleStrikeChance) {
        const d2 = Math.max(1, Math.round(ca.attack - Math.floor(mon.defense * 0.4)));
        monHp = Math.max(0, monHp - d2);
        log.push(`⚡ Golpe duplo! -${d2}`);
        events.push({ type: "skill", target: "monster", amount: d2 });
      }
      if (skillFx.healOnUse) {
        const heal = Math.max(1, Math.round(ca.maxHp * skillFx.healOnUse));
        charHp = Math.min(ca.maxHp, charHp + heal);
        log.push(`✨ Você se cura! +${heal}`);
        events.push({ type: "heal", target: "player", amount: heal });
      }
    }
  } else {
    const r = strike({ attack: ca.attack, critical: ca.critical, precision: ca.precision }, { defense: mon.defense, dodge: mon.dodge });
    if (r.dodged) {
      log.push(`💨 O chefe esquivou!`);
      events.push({ type: "dodge", target: "monster" });
    } else {
      monHp = Math.max(0, monHp - r.dmg);
      log.push(`⚔️ Você ataca! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
      events.push({ type: r.crit ? "crit" : "hit", target: "monster", amount: r.dmg });
    }
  }

  // Ataque extra por velocidade.
  if (!defended && monHp > 0) {
    const speedChance = Math.min(50, Math.max(0, (ca.speed - mon.speed) * 0.5));
    if (Math.random() * 100 < speedChance) {
      const r2 = strike({ attack: ca.attack, critical: ca.critical, precision: ca.precision }, { defense: mon.defense, dodge: mon.dodge });
      if (r2.hit) {
        monHp = Math.max(0, monHp - r2.dmg);
        log.push(`⚡ Velocidade! Ataque extra! -${r2.dmg}${r2.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r2.crit ? "crit" : "hit", target: "monster", amount: r2.dmg });
      }
    }
  }

  let won = monHp <= 0;
  let lost = false;

  // Contra-ataque do chefe (se ainda vivo).
  if (monHp > 0) {
    const recv = skillFx.receivedMult != null && resolvedAction === "skill" ? skillFx.receivedMult : 1;
    const r = strike(
      { attack: mon.attack, critical: mon.critical, precision: 0 },
      { defense: ca.defense, dodge: ca.dodge }
    );
    if (r.dodged) {
      log.push(`✅ Você desviou do contra-ataque!`);
      events.push({ type: "dodge", target: "player" });
    } else {
      const resistMult = Math.max(0.7, 1 - ca.resistance * 0.0033);
      const taken = Math.max(1, Math.round((defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * recv * resistMult));
      charHp = Math.max(0, charHp - taken);
      log.push(`🗡️ O chefe atacou você! -${taken}${r.crit ? " 💥CRÍTICO!" : ""}`);
      events.push({ type: r.crit ? "crit" : "hit", target: "player", amount: taken });
    }
    // Fênix revive 1x por batalha.
    if (charHp <= 0 && petBuff?.revive && !petRevived) {
      charHp = 1;
      petRevived = true;
      log.push("🔥 Sua Fênix reviveu você! +1 HP");
      events.push({ type: "revive", target: "player", amount: 1 });
    } else if (charHp <= 0) {
      lost = true;
    }
  }

  round += 1;

  // Empate / limite de rodadas.
  if (!won && !lost && round >= BOSS_BATTLE_MAX_ROUNDS) {
    won = charHp >= monHp;
    lost = !won;
  }

  const battle: BossBattleState = {
    seed: Number(state.seed) || 1,
    startedAt,
    monNameKey: state.monNameKey || monster.nameKey,
    monImage: state.monImage || monster.image,
    boss: mon.boss,
    scaled: !!mon.scaled,
    monMaxHp: mon.maxHp,
    monHp,
    monAttack: mon.attack,
    monDefense: mon.defense,
    monSpeed: mon.speed,
    monCritical: mon.critical,
    monDodge: mon.dodge,
    charMaxHp: ca.maxHp,
    charHp,
    charMaxMp: ca.maxMana,
    charMp,
    round,
    petRevived,
  };

  return { battle, log, events, won, lost };
}
