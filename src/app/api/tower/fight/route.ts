import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import {
  xpForLevel,
  powerCalc,
  towerMonsterForFloor,
  towerMonsterImage,
  isTowerMonsterKind,
  TOWER_MONSTER_NAMES,
  type TowerMonsterKind,
  type TowerBossKind,
} from "@/game/constants";
import { getSkinClassBuff, skinRarityMult } from "@/game/skinBuffs";
import { xpMultiplier, goldMultiplier } from "@/game/boosts";
import { classSkillEffect, type ClassName } from "@/game/constants";
import { skillTreeDebuff, DEBUFF_LOG } from "@/game/skillTree";
import { masteryBuff } from "@/game/mastery";
import { requireCharacterAuth } from "@/game/auth";

const SKILL_COST = 15;
const MAX_ROUNDS = 40;

// PRNG determinístico por semente (mesmo monstro mantém stats entre rodadas)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getCharCombat(char: any) {
  return {
    attack: Number(char.attack) || 0,
    defense: Number(char.defense) || 0,
    speed: Number(char.speed) || 0,
    critical: Math.min(90, Number(char.critical) || 0),
    dodge: Math.min(50, Number(char.dodge) || 0),
    precision: Number(char.precision) || 0,
    maxHp: Number(char.maxHp) || 100,
    maxMana: Number(char.maxMana) || 50,
  };
}

function floorMonster(char: any, floor: number, kind: TowerMonsterKind | TowerBossKind, seed: number) {
  const rng = mulberry32(seed);
  rng();
  rng();
  const boss = floor % 10 === 0;
  const f = Math.max(1, Number(floor) || 1);
  const lv = Number(char.level) || 1;
  const floorBoost = Math.min(120, f);
  // Dificuldade FIXA por andar (NÃO espelha o poder/inventário do jogador):
  // os monstros ficam mais fortes gradualmente a cada andar. Assim um jogador
  // de nível baixo não consegue quebrar o ranking global só por ser fraco —
  // ele bate no teto dele e quem sobe é quem realmente é forte.
  const bossMult = boss ? 1.4 : 1;
  return {
    kind,
    image: towerMonsterImage(kind),
    nameKey: TOWER_MONSTER_NAMES[kind],
    maxHp: Math.max(50, Math.round((40 + f * 16) * bossMult)),
    attack: Math.max(4, Math.round((6 + f * 2.2) * bossMult)),
    defense: Math.max(1, Math.round((1 + f * 1.1) * bossMult)),
    speed: Math.max(1, Math.round((1 + f * 0.04) * 100) / 100),
    critical: Math.min(30, Math.round(1 + f * 0.18)),
    dodge: Math.min(15, Math.round((0.5 + f * 0.1) * 10) / 10),
    goldReward: boss ? 120 + f * 30 : 30 + f * 20,
    // XP escala com a CURVA DE NÍVEL (mesmo conceito das missões): a recompensa
    // acompanha o quanto você precisa para subir, então nunca vira "2k de XP
    // pra quem precisa de 1M". Chefe paga o dobro de XP.
    xpReward: Math.max(30, Math.floor(xpForLevel(lv) * (0.015 + floorBoost * 0.002)) * (boss ? 2 : 1)),
    coinsReward: boss ? 30 + Math.floor(f / 10) : 4 + Math.floor(f / 12),
    boss,
  };
}

// Golpe: retorna dano, crítico ou esquiva
// Precisão anula esquiva 1:1 (1 ponto de precisão = 1% a menos de esquiva),
// assim "maxar esquiva" deixa de ser a única build viável.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId;
    const action = body?.action as string;
    const state = body?.state as any;

    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    // Só o dono pode lutar na torre com o próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const ca = getCharCombat(char);
    // Buff ativado pela skin equipada (só ativa se for da própria classe)
    const skinBuff = getSkinClassBuff(char.classType, char.activeSkinId);
    const skinMult = skinBuff ? skinRarityMult(char.activeSkinId) : 1;
    // Buff de MAESTRIA da árvore (30 pontos = árvore completa): multiplica junto
    // com a skin — os dois podem estar ativos ao mesmo tempo.
    const mastery = masteryBuff(char);
    const atkFactor = (skinBuff ? skinBuff.damageMult * skinMult : 1) * (mastery ? mastery.damageMult : 1);
    const critAdd = (skinBuff ? skinBuff.critBonus : 0) + (mastery ? mastery.critBonus : 0);
    const takenFactor = (skinBuff ? skinBuff.takenMult : 1) * (mastery ? mastery.takenMult : 1);
    const floor = Number(char.towerFloor) || 1;

    // ---- Iniciar batalha (spawn do NPC) ----
    if (action === "start") {
      const kind = towerMonsterForFloor(floor);
      const seed = Math.floor(Math.random() * 1e9);
      const mon = floorMonster(char, floor, kind, seed);
      return NextResponse.json({
        ok: true,
        action,
        floor,
        battle: {
          seed,
          floor,
          kind,
          monNameKey: mon.nameKey,
          monImage: mon.image,
          boss: mon.boss,
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
        },
        log: [],
        events: [],
        won: false,
        lost: false,
      });
    }

    // ---- Ações de combate (estado vem do cliente; servidor valida) ----
    if (!state || typeof state.seed !== "number" || typeof state.monHp !== "number") {
      return NextResponse.json({ error: "Estado de batalha inválido" }, { status: 400 });
    }

    const seed = Number(state.seed) || 1;
    const kind = isTowerMonsterKind(state.kind) ? (state.kind as TowerMonsterKind | TowerBossKind) : "slime";
    const mon = floorMonster(char, state.floor || floor, kind, seed);

    // Estado atual, garantindo limites (não confiamos cegamente no cliente)
    let charHp = Math.min(ca.maxHp, Math.max(1, Number(state.charHp) || ca.maxHp));
    let charMp = Math.min(ca.maxMana, Math.max(0, Number(state.charMp) || ca.maxMana));
    let monHp = Math.min(mon.maxHp, Math.max(0, Number(state.monHp) || mon.maxHp));
    let round = Math.max(0, Number(state.round) || 0);

    const log: string[] = [];
    const events: any[] = [];
    let defended = false;
    let bleedStack = 0; // sangramento acumulado no inimigo (skin de assassino)
    // Efeito mecânico do golpe especial da CLASSE do personagem.
    const skillFx = classSkillEffect((char.classType as ClassName) || "warrior");
    let skillUsed = false;
    // Debuffs da árvore de habilidades aplicados no contra-ataque do inimigo.
    let monAttackMult = 1; // weaken/slow: -% de dano do inimigo
    let monCritReduction = 0; // blind: -pontos de crítico do inimigo

    // ---- Ação do personagem ----
    if (action === "defend") {
      defended = true;
      const regen = Math.min(8, ca.maxMana - charMp);
      charMp += regen;
      log.push("🛡️ Você assume postura de defesa.");
      events.push({ type: "defend", target: "player" });
    } else if (action === "skill") {
      const cost = skillFx.manaCost ?? SKILL_COST;
      if (charMp < cost) {
        return NextResponse.json({ error: "Mana insuficiente", code: "no_mana" }, { status: 400 });
      }
      charMp -= cost;
      skillUsed = true;
      const pierceDef = mon.defense * (1 - (skillFx.pierce || 0));
      const r = strike(
        { attack: Math.round(ca.attack * (skillFx.dmgMult || 1.8) * atkFactor), critical: ca.critical + (skillFx.critBonus ?? 15) + critAdd, precision: ca.precision },
        { defense: pierceDef, dodge: mon.dodge }
      );
      if (r.dodged) {
        log.push(`💨 O inimigo desviou do golpe poderoso!`);
        events.push({ type: "dodge", target: "monster" });
      } else {
        // Debuff da ÁRVORE DE HABILIDADES: aplica no golpe especial.
        const treeDebuff = skillTreeDebuff(char);
        let skillDmg = r.dmg;
        if (treeDebuff) {
          const { type, value } = treeDebuff;
          // sunders/curse aumentam o dano do próprio golpe.
          if (type === "sunder") skillDmg = Math.max(1, Math.round(skillDmg * (1 + value / 100)));
          if (type === "curse") skillDmg = Math.max(1, Math.round(skillDmg * (1 + value / 100)));
          monHp = Math.max(0, monHp - skillDmg);
          log.push(`✨ ${DEBUFF_LOG[type]}! -${skillDmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "monster", amount: skillDmg });
          // bleed/burn/poison: dano extra imediato (% do ataque).
          if (type === "bleed" || type === "burn" || type === "poison") {
            const dot = Math.max(1, Math.round(ca.attack * (value / 100)));
            monHp = Math.max(0, monHp - dot);
            log.push(`🩸 ${DEBUFF_LOG[type]} causa +${dot} de dano!`);
            events.push({ type: "bleed", target: "monster", amount: dot });
          }
          // weaken/slow: reduz o contra-ataque do inimigo neste turno.
          if (type === "weaken" || type === "slow") {
            monAttackMult = 1 - value / 100;
          }
          // blind: reduz o crítico do inimigo neste turno.
          if (type === "blind") {
            monCritReduction = Math.min(30, value);
          }
        } else {
          monHp = Math.max(0, monHp - skillDmg);
          log.push(`✨ Golpe Poderoso! -${skillDmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "monster", amount: skillDmg });
        }
        if (skinBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * skinBuff.bleedPerRound * skinMult));
        // Double strike (assassino): 1 ataque básico extra sem crítico
        if (skillFx.doubleStrikeChance && Math.random() * 100 < skillFx.doubleStrikeChance) {
          const d2 = Math.max(1, Math.round(ca.attack * atkFactor - Math.floor(mon.defense * 0.4)));
          monHp = Math.max(0, monHp - d2);
          log.push(`⚡ Golpe duplo! -${d2}`);
          events.push({ type: "skill", target: "monster", amount: d2 });
        }
        // Cura ao usar (paladino/templário)
        if (skillFx.healOnUse) {
          const heal = Math.max(1, Math.round(ca.maxHp * skillFx.healOnUse));
          charHp = Math.min(ca.maxHp, charHp + heal);
          log.push(`✨ Você se cura! +${heal}`);
        }
      }
      // Sangramento do golpe (necromante/summoner)
      if (skillFx.bleedChance && Math.random() * 100 < skillFx.bleedChance) {
        const bleedDmg = Math.max(1, Math.round(ca.attack * 0.12));
        bleedStack += bleedDmg;
      }
    } else {
      const r = strike(
        { attack: Math.round(ca.attack * atkFactor), critical: ca.critical + critAdd, precision: ca.precision },
        { defense: mon.defense, dodge: mon.dodge }
      );
      if (r.dodged) {
        log.push(`💨 O inimigo esquivou!`);
        events.push({ type: "dodge", target: "monster" });
      } else {
        monHp = Math.max(0, monHp - r.dmg);
        log.push(`⚔️ Você ataca! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r.crit ? "crit" : "hit", target: "monster", amount: r.dmg });
        if (skinBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * skinBuff.bleedPerRound * skinMult));
      }
    }

    // Sangramento (skin + golpe da classe) atinge o inimigo
    if (bleedStack > 0 && monHp > 0) {
      monHp = Math.max(0, monHp - bleedStack);
      log.push(`🩸 O inimigo sangra! -${bleedStack}`);
      events.push({ type: "bleed", target: "monster", amount: bleedStack });
    }

    // VELOCIDADE: chance de um ATAQUE EXTRA por rodada — quanto maior a
    // diferença de velocidade contra o inimigo, maior a chance (até 50%).
    // Não acontece se você defendeu ou se o inimigo já caiu.
    if (!defended && monHp > 0) {
      const speedChance = Math.min(50, Math.max(0, (ca.speed - mon.speed) * 0.5));
      if (Math.random() * 100 < speedChance) {
        const r2 = strike(
          { attack: Math.round(ca.attack * atkFactor), critical: ca.critical + critAdd, precision: ca.precision },
          { defense: mon.defense, dodge: mon.dodge }
        );
        if (r2.dodged) {
          log.push(`💨 O inimigo esquivou do ataque extra!`);
          events.push({ type: "dodge", target: "monster" });
        } else {
          monHp = Math.max(0, monHp - r2.dmg);
          log.push(`⚡ Velocidade! Ataque extra! -${r2.dmg}${r2.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r2.crit ? "crit" : "hit", target: "monster", amount: r2.dmg });
          if (skinBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * skinBuff.bleedPerRound * skinMult));
        }
      }
    }

    let won = false;
    let lost = false;

    // ---- Resposta do monstro (se ainda vivo) ----
    if (monHp <= 0) {
      won = true;
    } else {
      // Classes que gastam o golpe (berserker) ou são suportes (paladino/cavaleiro)
      // recebem mais/menos dano do inimigo logo após o golpe.
      const recv = (skillUsed && skillFx.receivedMult != null) ? skillFx.receivedMult : 1;
      const r = strike(
        { attack: Math.round(mon.attack * monAttackMult), critical: Math.max(0, mon.critical - monCritReduction), precision: 0 },
        { defense: ca.defense, dodge: ca.dodge }
      );
      if (r.dodged) {
        log.push(`✅ Você desviou do contra-ataque!`);
        events.push({ type: "dodge", target: "player" });
      } else {
        // RESISTÊNCIA: reduz o dano recebido em % (até ~30% no cap da classe).
        // A Maestria entra aqui também: o multiplicador takenMult da classe é
        // multiplicado junto com a skin (cavaleiro tanka até -14% a mais).
        const resistMult = Math.max(0.7, 1 - (Number(char.resistance) || 0) * 0.0033);
        const taken = Math.max(1, Math.round((defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * takenFactor * recv * resistMult));
        charHp = Math.max(0, charHp - taken);
        log.push(`🗡️ O inimigo atacou você! -${taken}${r.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r.crit ? "crit" : "hit", target: "player", amount: taken });
      }
      if (charHp <= 0) lost = true;
    }

    // Cura da skin (ex.: paladino) a cada rodada
    if (skinBuff?.healPerRound && !won && charHp > 0) {
      const heal = Math.max(1, Math.round(ca.maxHp * skinBuff.healPerRound * skinMult));
      charHp = Math.min(ca.maxHp, charHp + heal);
      log.push(`✨ Você se cura! +${heal}`);
    }

    round += 1;

    // Empate / limite de rodadas
    if (!won && !lost && round >= MAX_ROUNDS) {
      won = charHp >= monHp;
      lost = !won;
    }

    // ---- Persistir resultado (apenas no fim) ----
    let rewards: any;
    if (won || lost) {
      if (won) {
        const xpEarned = mon.xpReward * xpMultiplier(char);
        let newXp = (char.xp || 0) + xpEarned;
        let newLevel = char.level || 1;
        let newXpToNext = char.xpToNext || 100;
        let newStatPoints = char.unspentStatPoints || 0;
        let newSkillPoints = char.skillPoints || 0;
        while (newXp >= newXpToNext) {
          newXp -= newXpToNext;
          newLevel++;
          newXpToNext = xpForLevel(newLevel);
          newStatPoints += 3;
          if (newLevel % 3 === 0) newSkillPoints += 1;
        }
        const newGold = (char.gold || 0) + Math.floor(mon.goldReward * goldMultiplier(char));
        const newCoins = (char.towerCoins || 0) + mon.coinsReward;
        const newTowerFloor = floor + 1;
        const power = powerCalc({
          attack: ca.attack,
          defense: ca.defense,
          hp: ca.maxHp,
          speed: ca.speed,
          critical: ca.critical,
          level: newLevel,
        });
        await jsonDb.updateCharacter(char.id, {
          xp: newXp,
          level: newLevel,
          xpToNext: newXpToNext,
          gold: newGold,
          towerCoins: newCoins,
          towerFloor: newTowerFloor,
          unspentStatPoints: newStatPoints,
          skillPoints: newSkillPoints,
          power,
          lastActivity: new Date().toISOString(),
        });
        rewards = {
          gold: mon.goldReward,
          xp: xpEarned,
          coins: mon.coinsReward,
          levelUp: newLevel > (char.level || 0),
          newLevel,
          newFloor: newTowerFloor,
        };
      } else {
        // Derrota → NÃO reseta: o jogador permanece no andar em que perdeu e
        // pode tentar de novo (o progresso da torre é mantido no andar atual).
        await jsonDb.updateCharacter(char.id, {
          lastActivity: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      floor,
      round,
      won,
      lost,
      log,
      events,
      rewards,
      battle: {
        seed,
        floor: state.floor || floor,
        kind,
        charMaxHp: ca.maxHp,
        charHp,
        charMaxMp: ca.maxMana,
        charMp,
        monMaxHp: mon.maxHp,
        monHp,
        monAttack: mon.attack,
        monDefense: mon.defense,
        monSpeed: mon.speed,
        monCritical: mon.critical,
        monDodge: mon.dodge,
        monImage: mon.image,
        monNameKey: mon.nameKey,
        boss: mon.boss,
        round,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}