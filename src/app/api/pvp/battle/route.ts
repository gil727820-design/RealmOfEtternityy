import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { leagueForRating, powerCalc, xpForLevel, classSkillEffect, type ClassName } from "@/game/constants";
import { getSkinClassBuff, skinRarityMult } from "@/game/skinBuffs";
import { xpMultiplier, goldMultiplier } from "@/game/boosts";
import { computePvpDaily, PVP_DAILY_MAX, pvpDateKey } from "@/game/pvp";

const SKILL_COST = 15;
const MAX_ROUNDS = 40;

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

// Golpe: retorna dano, crítico ou esquiva
// Precisão anula esquiva 1:1 (1 ponto de precisão = 1% a menos de esquiva).
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
    const defender = body?.defender as Record<string, any> | null;
    const state = body?.state as any;

    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    if (!defender || !defender.name) {
      return NextResponse.json({ error: "Oponente inválido" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const ca = getCharCombat(char);

    // Buffs ativados pelas Skins equipadas (só os da própria classe)
    const myBuff = getSkinClassBuff(char.classType, char.activeSkinId);
    const myMult = myBuff ? skinRarityMult(char.activeSkinId) : 1;
    const eneBuff = getSkinClassBuff(String(defender.classType || "warrior"), defender.activeSkinId);
    const eneMult = eneBuff ? skinRarityMult(defender.activeSkinId) : 1;

    // Multiplicadores efetivos: player→inimigo (dano do jogador × tank do inimigo);
    // inimigo→player (dano do inimigo × tank do jogador).
    const pm = (myBuff ? myBuff.damageMult * myMult : 1) * (eneBuff ? eneBuff.takenMult : 1);
    const em = (eneBuff ? eneBuff.damageMult * eneMult : 1) * (myBuff ? myBuff.takenMult : 1);
    const myCritAdd = myBuff ? myBuff.critBonus : 0;
    const eneCritAdd = eneBuff ? eneBuff.critBonus : 0;
    const myHeal = myBuff ? myBuff.healPerRound : 0;
    const eneHeal = eneBuff ? eneBuff.healPerRound : 0;

    // Snapshot do oponente (bot ou personagem real) enviado pelo cliente
    const oppMaxHp = Math.max(1, Math.round(Number(defender.maxHp) || Number(defender.hp) || 120));
    const oppAttack = Number(defender.attack) || 10;
    const oppDefense = Number(defender.defense) || 5;
    const oppSpeed = Number(defender.speed) || 3;
    const oppCritical = Math.min(90, Number(defender.critical) || 5);
    const oppDodge = Math.min(50, Number(defender.dodge) || 5);
    const oppPrecision = Number(defender.precision) || 0;
    const oppMaxMp = Math.max(1, Math.round(Number(defender.maxMana) || (defender.isBot ? 60 : 50)));
    const oppName = String(defender.name || "Oponente");
    const oppClass = String(defender.classType || "warrior");
    const oppSex = String(defender.sex || "male");
    const oppLevel = Number(defender.level) || 1;
    const oppPower = Number(defender.power) || 0;
    const oppRating = Math.max(0, Number(defender.pvpRating) || Number(char.pvpRating) || 0);
    const isBot = !!defender.isBot || String(defender.id || "").startsWith("bot_");

    const battlePayload = (b: { charHp: number; charMp: number; oppHp: number; oppMp: number; round: number }) => ({
      oppName,
      oppClass,
      oppSex,
      oppMaxHp,
      oppMaxMp,
      oppAttack,
      oppDefense,
      oppSpeed,
      oppCritical,
      oppDodge,
      oppLevel,
      oppPower,
      oppRating,
      charMaxHp: ca.maxHp,
      charHp: b.charHp,
      charMaxMp: ca.maxMana,
      charMp: b.charMp,
      oppHp: b.oppHp,
      oppMp: b.oppMp,
      round: b.round,
    });

// Limite diário da Arena (mesmo padrão das masmorras): bloqueia novas
    // batalhas quando o personagem já gastou as permitidas hoje.
    const dailyStart = computePvpDaily(char);
    if (action === "start" && dailyStart.used >= PVP_DAILY_MAX) {
      return NextResponse.json(
        {
          error: "Limite diário de batalhas atingido! Volte amanhã.",
          code: "pvp_daily_limit",
          dailyMax: PVP_DAILY_MAX,
          dailyLeft: 0,
        },
        { status: 400 }
      );
    }
    // ---- Iniciar batalha ----
    if (action === "start") {
      return NextResponse.json({
        ok: true,
        action: "start",
        dailyMax: PVP_DAILY_MAX,
        dailyLeft: dailyStart.dailyLeft,
        won: false,
        lost: false,
        log: [],
        events: [],
        battle: battlePayload({ charHp: ca.maxHp, charMp: ca.maxMana, oppHp: oppMaxHp, oppMp: oppMaxMp, round: 0 }),
      });
    }

    if (!state || typeof state.charHp !== "number") {
      return NextResponse.json({ error: "Estado de batalha inválido" }, { status: 400 });
    }

    // Estado atual, garantindo limites (não confiamos cegamente no cliente)
    let charHp = Math.min(ca.maxHp, Math.max(1, Number(state.charHp) || ca.maxHp));
    let charMp = Math.min(ca.maxMana, Math.max(0, Number(state.charMp) || 0));
    let oppHp = Math.min(oppMaxHp, Math.max(0, Number(state.oppHp) || oppMaxHp));
    let oppMp = Math.min(oppMaxMp, Math.max(0, Number(state.oppMp) || 0));
    let round = Math.max(0, Number(state.round) || 0);

    const log: string[] = [];
    const events: any[] = [];
    let defended = false;
    let bleedStack = 0; // sangramento acumulado no inimigo (skin de assassino)
    // Efeito mecânico do golpe especial da CLASSE do personagem.
    const skillFx = classSkillEffect((char.classType as ClassName) || "warrior");
    let skillUsed = false;

    // ---- Ação do jogador (você) ----
    if (action === "defend") {
      defended = true;
      const regen = Math.min(8, ca.maxMana - charMp);
      charMp += regen;
      log.push(`🛡️ Você assume postura de defesa.`);
      events.push({ type: "defend", target: "player" });
    } else if (action === "skill") {
      const cost = skillFx.manaCost ?? SKILL_COST;
      if (charMp < cost) {
        return NextResponse.json({ error: "Mana insuficiente", code: "no_mana" }, { status: 400 });
      }
      charMp -= cost;
      skillUsed = true;
      const pierceDef = oppDefense * (1 - (skillFx.pierce || 0));
      const r = strike(
        { attack: Math.round(ca.attack * (skillFx.dmgMult || 1.8) * pm), critical: ca.critical + (skillFx.critBonus ?? 15) + myCritAdd, precision: ca.precision },
        { defense: pierceDef, dodge: oppDodge }
      );
      if (r.dodged) {
        log.push(`💨 ${oppName} esquivou do golpe especial!`);
        events.push({ type: "dodge", target: "enemy" });
      } else {
        oppHp = Math.max(0, oppHp - r.dmg);
        log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r.crit ? "crit" : "skill", target: "enemy", amount: r.dmg });
        if (myBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * myBuff.bleedPerRound * myMult));
        if (skillFx.doubleStrikeChance && Math.random() * 100 < skillFx.doubleStrikeChance) {
          const d2 = Math.max(1, Math.round(ca.attack * pm - Math.floor(oppDefense * 0.4)));
          oppHp = Math.max(0, oppHp - d2);
          log.push(`⚡ Golpe duplo! -${d2}`);
          events.push({ type: "skill", target: "enemy", amount: d2 });
        }
        if (skillFx.healOnUse) {
          const heal = Math.max(1, Math.round(ca.maxHp * skillFx.healOnUse));
          charHp = Math.min(ca.maxHp, charHp + heal);
          log.push(`✨ Você se cura! +${heal}`);
        }
      }
      if (skillFx.bleedChance && Math.random() * 100 < skillFx.bleedChance) {
        bleedStack += Math.max(1, Math.round(ca.attack * 0.12));
      }
    } else {
      const r = strike(
        { attack: Math.round(ca.attack * pm), critical: ca.critical + myCritAdd, precision: ca.precision },
        { defense: oppDefense, dodge: oppDodge }
      );
      if (r.dodged) {
        log.push(`💨 ${oppName} esquivou do seu ataque!`);
        events.push({ type: "dodge", target: "enemy" });
      } else {
        oppHp = Math.max(0, oppHp - r.dmg);
        log.push(`⚔️ Você ataca ${oppName}! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r.crit ? "crit" : "hit", target: "enemy", amount: r.dmg });
        if (myBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * myBuff.bleedPerRound * myMult));
      }
    }

    // Sangramento da skin (ex.: assassino) atinge o oponente
    if (bleedStack > 0 && oppHp > 0) {
      oppHp = Math.max(0, oppHp - bleedStack);
      log.push(`🩸 ${oppName} sangra! -${bleedStack}`);
      events.push({ type: "bleed", target: "enemy", amount: bleedStack });
    }

    // ---- Resposta do oponente (se ainda vivo) ----
    if (oppHp > 0) {
      // Se você usou o golpe especial, o oponente contra-ataca com o multiplicador
      // de recebimento da sua classe (berserker fica mais frágil, paladino resiste).
      const recv = skillUsed && skillFx.receivedMult != null ? skillFx.receivedMult : 1;
      const useSkill = oppMp >= SKILL_COST && Math.random() < 0.4;
      const useDefend = !useSkill && Math.random() < 0.15;
      if (useSkill) {
        oppMp -= SKILL_COST;
        const r = strike(
          { attack: Math.round(oppAttack * 1.6 * em), critical: oppCritical + 10 + eneCritAdd, precision: oppPrecision },
          { defense: ca.defense, dodge: ca.dodge }
        );
        if (r.dodged) {
          log.push(`✅ Você desviou do golpe especial de ${oppName}!`);
          events.push({ type: "dodge", target: "player" });
        } else {
          const taken = (defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * recv;
          charHp = Math.max(0, charHp - Math.round(taken));
          log.push(`✨ ${oppName} usa a técnica especial! -${Math.round(taken)}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "player", amount: Math.round(taken) });
        }
      } else if (useDefend) {
        const regen = Math.min(8, oppMaxMp - oppMp);
        oppMp += regen;
        log.push(`🛡️ ${oppName} assume postura de defesa.`);
        events.push({ type: "defend", target: "enemy" });
      } else {
        const r = strike(
          { attack: Math.round(oppAttack * em), critical: oppCritical + eneCritAdd, precision: oppPrecision },
          { defense: ca.defense, dodge: ca.dodge }
        );
        if (r.dodged) {
          log.push(`✅ Você desviou do ataque de ${oppName}!`);
          events.push({ type: "dodge", target: "player" });
        } else {
          const taken = (defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * recv;
          charHp = Math.max(0, charHp - Math.round(taken));
          log.push(`🗡️ ${oppName} atacou você! -${Math.round(taken)}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "hit", target: "player", amount: Math.round(taken) });
        }
      }
    }

    let won = false;
    let lost = false;
    if (oppHp <= 0) won = true;
    else if (charHp <= 0) lost = true;

    // Regeneração das skins (ex.: paladino) ao fim da rodada
    if (myHeal && charHp > 0) {
      const heal = Math.max(1, Math.round(ca.maxHp * myHeal));
      charHp = Math.min(ca.maxHp, charHp + heal);
      log.push(`✨ Você se cura! +${heal}`);
    }
    if (eneHeal && oppHp > 0) {
      const heal = Math.max(1, Math.round(oppMaxHp * eneHeal));
      oppHp = Math.min(oppMaxHp, oppHp + heal);
    }

    round += 1;

    // Limite de rodadas (empate decidido por vida restante)
    if (!won && !lost && round >= MAX_ROUNDS) {
      won = charHp >= oppHp;
      lost = !won;
    }

    // ---- Persistir resultado ----
    let ratingChange = 0;
    let xpEarned = 0;
    let goldEarned = 0;
    if (won || lost) {
      const today = pvpDateKey();
      const newUsed = Math.min(PVP_DAILY_MAX, computePvpDaily(char).used + 1);
      ratingChange = won ? 5 : -3;
      const newAtkRating = Math.max(0, (char.pvpRating || 0) + ratingChange);

      // Recompensa: dinheiro (ouro) + XP (ampliada por boost 2x / VIP)
      goldEarned = Math.floor((won ? 8 : 2) * goldMultiplier(char));
      xpEarned = Math.floor((won ? 30 : 8) * xpMultiplier(char));

      let newXp = (char.xp || 0) + xpEarned;
      let newLevel = char.level || 1;
      let newXpToNext = char.xpToNext || xpForLevel(newLevel);
      let newStatPoints = char.unspentStatPoints || 0;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = xpForLevel(newLevel);
        newStatPoints += 3;
      }
      const newGold = (char.gold || 0) + goldEarned;
      const power = powerCalc({
        attack: char.attack,
        defense: char.defense,
        hp: char.maxHp,
        speed: char.speed,
        critical: char.critical,
        level: newLevel,
      });

      await jsonDb.updateCharacter(char.id, {
        pvpRating: newAtkRating,
        pvpLeague: leagueForRating(newAtkRating),
        pvpCoins: (char.pvpCoins || 0) + (won ? 12 : 3),
        pvpDailyDate: today,
        pvpDailyCount: newUsed,
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        gold: newGold,
        unspentStatPoints: newStatPoints,
        power,
      });
      // Oponente real (offline) usa a mesma lógica do agressor, invertida
      if (!isBot && defender.id) {
        const defEntity = await jsonDb.findCharacterById(defender.id);
        if (defEntity) {
          const newDefRating = Math.max(0, (defEntity.pvpRating ?? oppRating) - ratingChange);
          await jsonDb.updateCharacter(defender.id, {
            pvpRating: newDefRating,
            pvpLeague: leagueForRating(newDefRating),
          });
        }
      }

      // Registra no histórico de batalhas do personagem
      await jsonDb.insertBattle({
        characterId,
        opponentName: oppName,
        opponentClass: oppClass,
        opponentLevel: oppLevel,
        isBot,
        won,
        ratingChange,
        goldEarned,
        xpEarned,
        ratingBefore: Number(char.pvpRating) || 0,
      });
    }

    const fresh = await jsonDb.findCharacterById(char.id);

    return NextResponse.json({
      ok: true,
      action,
      won,
      lost,
      log,
      events,
      ratingChange,
      xpEarned,
      goldEarned,
      isBot,
      attacker: fresh,
      dailyMax: PVP_DAILY_MAX,
      dailyLeft: computePvpDaily(fresh).dailyLeft,
      battle: battlePayload({ charHp, charMp, oppHp, oppMp, round }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}