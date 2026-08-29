import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { leagueForRating, PVP_LEAGUES, powerCalc, xpForLevel, resolveMaxLevel, classSkillEffect, type ClassName } from "@/game/constants";
import { getSkinClassBuff, skinRarityMult } from "@/game/skinBuffs";
import { xpMultiplier, goldMultiplier } from "@/game/boosts";
import { computePvpDaily, PVP_DAILY_MAX, pvpDateKey } from "@/game/pvp";
import { skillTreeDebuff, DEBUFF_LOG } from "@/game/skillTree";
import { decideEnemyAction } from "@/game/battleAI";
import { masteryBuff } from "@/game/mastery";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { pvpSeasonInfo, trackSeasonBest } from "@/game/pvpSeason";
import { applyAdvancedClassCombat, advSkillDmgMult } from "@/game/advancedClasses";
import { applyAscensionCombat } from "@/game/ascension";
import { seasonPatch as globalSeasonPatch } from "@/game/season";

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

    // Só o dono pode lutar na arena com o próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const ca = getCharCombat(char);
    // Buffs da CLASSE AVANÇADA (evolução nível 50+, passivos permanentes).
    applyAdvancedClassCombat(char, ca);
    // Buffs da ASCENSÃO (patamares divinos a cada 100 níveis: dano/HP/velocidade).
    applyAscensionCombat(char, ca);

    // Buffs ativados pelas Skins equipadas (só os da própria classe)
    const myBuff = getSkinClassBuff(char.classType, char.activeSkinId);
    const myMult = myBuff ? skinRarityMult(char.activeSkinId) : 1;
    const eneBuff = getSkinClassBuff(String(defender.classType || "warrior"), defender.activeSkinId);
    const eneMult = eneBuff ? skinRarityMult(defender.activeSkinId) : 1;
    // Buff de MAESTRIA da árvore de habilidades (30 pontos = árvore completa).
    // Vale para os DOIS lados: o agressor usa a dele e o oponente (se tiver a
    // árvore completa) também — multiplica junto com a skin.
    const myMastery = masteryBuff(char);
    const eneMastery = masteryBuff(defender);

    // Multiplicadores efetivos: player→inimigo (dano do jogador × tank do inimigo);
    // inimigo→player (dano do inimigo × tank do jogador). Skin e Maestria somam.
    const pm =
      (myBuff ? myBuff.damageMult * myMult : 1) * (myMastery ? myMastery.damageMult : 1) *
      (eneBuff ? eneBuff.takenMult : 1) * (eneMastery ? eneMastery.takenMult : 1);
    const em =
      (eneBuff ? eneBuff.damageMult * eneMult : 1) * (eneMastery ? eneMastery.damageMult : 1) *
      (myBuff ? myBuff.takenMult : 1) * (myMastery ? myMastery.takenMult : 1);
    const myCritAdd = (myBuff ? myBuff.critBonus : 0) + (myMastery ? myMastery.critBonus : 0);
    const eneCritAdd = (eneBuff ? eneBuff.critBonus : 0) + (eneMastery ? eneMastery.critBonus : 0);

    // RESISTÊNCIA: reduz o dano recebido em % (até ~30% no cap da classe).
    // Cada lado usa a própria resistência para reduzir o dano que recebe.
    // (O takenMult da Maestria já entra via pm/em — aqui fica só a resistência.)
    const myResistMult = Math.max(0.7, 1 - (Number(char.resistance) || 0) * 0.0033);
    const eneResistMult = Math.max(0.7, 1 - (Number(defender.resistance) || 0) * 0.0033);
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
    // Defesa do OPONENTE: igual à do jogador, ela reduz o próximo golpe que ele
    // recebe pela metade (sem isso a IA defender era só desperdiçar o turno).
    let oppDefended = false;

    const log: string[] = [];
    const events: any[] = [];
    let defended = false;
    let bleedStack = 0; // sangramento acumulado no inimigo (skin de assassino)
    // Efeito mecânico do golpe especial da CLASSE do personagem.
    const skillFx = classSkillEffect((char.classType as ClassName) || "warrior");
    let skillUsed = false;
    // Debuffs da árvore de habilidades aplicados no contra-ataque do oponente.
    let oppAttackMult = 1; // weaken/slow: -% de dano do oponente
    let oppCritReduction = 0; // blind: -pontos de crítico do oponente

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
      // Classe avançada: turbina o golpe poderoso (multiplica o dmgMult da classe).
      const advSkillMult = advSkillDmgMult(char);
      const r = strike(
        { attack: Math.round(ca.attack * (skillFx.dmgMult || 1.8) * pm * advSkillMult), critical: ca.critical + (skillFx.critBonus ?? 15) + myCritAdd, precision: ca.precision },
        { defense: pierceDef, dodge: oppDodge }
      );
      if (r.dodged) {
        log.push(`💨 ${oppName} esquivou do golpe especial!`);
        events.push({ type: "dodge", target: "enemy" });
      } else {
        // Debuff da ÁRVORE DE HABILIDADES: aplica no golpe especial.
        const treeDebuff = skillTreeDebuff(char);
        let skillDmg = r.dmg;
        if (treeDebuff) {
          const { type, value } = treeDebuff;
          // sunder/curse aumentam o dano do próprio golpe.
          if (type === "sunder" || type === "curse") skillDmg = Math.max(1, Math.round(skillDmg * (1 + value / 100)));
          oppHp = Math.max(0, oppHp - Math.round(skillDmg * eneResistMult * (oppDefended ? 0.5 : 1)));
          oppDefended = false;
          log.push(`✨ ${DEBUFF_LOG[type]}! -${skillDmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "enemy", amount: skillDmg });
          // bleed/burn/poison: dano extra imediato (% do ataque).
          if (type === "bleed" || type === "burn" || type === "poison") {
            const dot = Math.max(1, Math.round(ca.attack * (value / 100)));
            oppHp = Math.max(0, oppHp - dot);
            log.push(`🩸 ${DEBUFF_LOG[type]} causa +${dot} de dano!`);
            events.push({ type: "bleed", target: "enemy", amount: dot });
          }
          // weaken/slow: reduz o contra-ataque do oponente neste turno.
          if (type === "weaken" || type === "slow") oppAttackMult = 1 - value / 100;
          // blind: reduz o crítico do oponente neste turno.
          if (type === "blind") oppCritReduction = Math.min(30, value);
        } else {
          oppHp = Math.max(0, oppHp - Math.round(skillDmg * eneResistMult * (oppDefended ? 0.5 : 1)));
          oppDefended = false;
          log.push(`✨ Golpe Poderoso! -${skillDmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "enemy", amount: skillDmg });
        }
        if (myBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * myBuff.bleedPerRound * myMult));
        if (skillFx.doubleStrikeChance && Math.random() * 100 < skillFx.doubleStrikeChance) {
          const d2 = Math.max(1, Math.round(ca.attack * pm - Math.floor(oppDefense * 0.4)));
          oppHp = Math.max(0, oppHp - Math.round(d2 * eneResistMult * (oppDefended ? 0.5 : 1)));
          oppDefended = false;
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
        oppHp = Math.max(0, oppHp - Math.round(r.dmg * eneResistMult * (oppDefended ? 0.5 : 1)));
        oppDefended = false;
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

    // VELOCIDADE: chance de um ATAQUE EXTRA por rodada — quanto maior a
    // diferença de velocidade contra o oponente, maior a chance (até 50%).
    // Não acontece se você defendeu ou se o oponente já caiu.
    if (!defended && oppHp > 0) {
      const speedChance = Math.min(50, Math.max(0, (ca.speed - oppSpeed) * 0.5));
      if (Math.random() * 100 < speedChance) {
        const r2 = strike(
          { attack: Math.round(ca.attack * pm), critical: ca.critical + myCritAdd, precision: ca.precision },
          { defense: oppDefense, dodge: oppDodge }
        );
        if (r2.dodged) {
          log.push(`💨 ${oppName} esquivou do ataque extra!`);
          events.push({ type: "dodge", target: "enemy" });
        } else {
          oppHp = Math.max(0, oppHp - Math.round(r2.dmg * eneResistMult * (oppDefended ? 0.5 : 1)));
          oppDefended = false;
          log.push(`⚡ Velocidade! Ataque extra! -${r2.dmg}${r2.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r2.crit ? "crit" : "hit", target: "enemy", amount: r2.dmg });
          if (myBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * myBuff.bleedPerRound * myMult));
        }
      }
    }

    // ---- Resposta do oponente (se ainda vivo) ----
    if (oppHp > 0) {
      // Se você usou o golpe especial, o oponente contra-ataca com o multiplicador
      // de recebimento da sua classe (berserker fica mais frágil, paladino resiste).
      const recv = skillUsed && skillFx.receivedMult != null ? skillFx.receivedMult : 1;
      // IA do oponente: decide a ação olhando o contexto (vidas, mana, rodada e
      // rating da liga) em vez de sorteio puro — batalha menos repetitiva.
      const aiAction = decideEnemyAction({
        myHp: oppHp,
        myMaxHp: oppMaxHp,
        myMp: oppMp,
        myMaxMp: oppMaxMp,
        enemyHp: charHp,
        enemyMaxHp: ca.maxHp,
        round,
        skillCost: SKILL_COST,
        savvy: Math.min(1, 0.4 + oppRating / 3000),
      });
      const useSkill = aiAction === "skill";
      const useDefend = aiAction === "defend";
      if (useSkill) {
        oppMp -= SKILL_COST;
        const r = strike(
          { attack: Math.round(oppAttack * 1.6 * em * oppAttackMult), critical: Math.max(0, oppCritical + 10 + eneCritAdd - oppCritReduction), precision: oppPrecision },
          { defense: ca.defense, dodge: ca.dodge }
        );
        if (r.dodged) {
          log.push(`✅ Você desviou do golpe especial de ${oppName}!`);
          events.push({ type: "dodge", target: "player" });
        } else {
          const taken = (defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * recv * myResistMult;
          charHp = Math.max(0, charHp - Math.round(taken));
          log.push(`✨ ${oppName} usa a técnica especial! -${Math.round(taken)}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "skill", target: "player", amount: Math.round(taken) });
        }
      } else if (useDefend) {
        oppDefended = true; // próximo golpe do jogador causa metade do dano
        const regen = Math.min(8, oppMaxMp - oppMp);
        oppMp += regen;
        log.push(`🛡️ ${oppName} assume postura de defesa!`);
        events.push({ type: "defend", target: "enemy" });
      } else {
        const r = strike(
          { attack: Math.round(oppAttack * em * oppAttackMult), critical: Math.max(0, oppCritical + eneCritAdd - oppCritReduction), precision: oppPrecision },
          { defense: ca.defense, dodge: ca.dodge }
        );
        if (r.dodged) {
          log.push(`✅ Você desviou do ataque de ${oppName}!`);
          events.push({ type: "dodge", target: "player" });
        } else {
          const taken = (defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * recv * myResistMult;
          charHp = Math.max(0, charHp - Math.round(taken));
          log.push(`🗡️ ${oppName} atacou você! -${Math.round(taken)}${r.crit ? " 💥CRÍTICO!" : ""}`);
          events.push({ type: r.crit ? "crit" : "hit", target: "player", amount: Math.round(taken) });
        }
      }

      // VELOCIDADE do oponente: chance de um ATAQUE EXTRA (mesma regra do
      // jogador — sem isso a velocidade só beneficiava um lado da luta).
      if (!useDefend && charHp > 0) {
        const speedChance = Math.min(50, Math.max(0, (oppSpeed - ca.speed) * 0.5));
        if (Math.random() * 100 < speedChance) {
          const r2 = strike(
            { attack: Math.round(oppAttack * em), critical: Math.max(0, oppCritical + eneCritAdd - oppCritReduction), precision: oppPrecision },
            { defense: ca.defense, dodge: ca.dodge }
          );
          if (r2.dodged) {
            log.push(`✅ Você desviou do ataque extra de ${oppName}!`);
            events.push({ type: "dodge", target: "player" });
          } else {
            const taken2 = Math.max(1, Math.round(r2.dmg * recv * myResistMult));
            charHp = Math.max(0, charHp - taken2);
            log.push(`⚡ ${oppName} usa a velocidade! Ataque extra! -${taken2}${r2.crit ? " 💥CRÍTICO!" : ""}`);
            events.push({ type: r2.crit ? "crit" : "hit", target: "player", amount: taken2 });
          }
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
      const leagueIndex = PVP_LEAGUES.findIndex((l) => l.id === leagueForRating(newAtkRating));

      // Recompensa: dinheiro (ouro) + XP (ampliada por boost 2x / VIP) — generoso!
      goldEarned = Math.floor((won ? 25 : 8) * goldMultiplier(char));
      xpEarned = Math.floor((won ? 60 : 20) * xpMultiplier(char));

      let newXp = (char.xp || 0) + xpEarned;
      let newLevel = char.level || 1;
      let newXpToNext = char.xpToNext || xpForLevel(newLevel);
      let newStatPoints = char.unspentStatPoints || 0;
      let newSkillPoints = char.skillPoints || 0;
      // Nível máximo configurado no painel admin (0 = padrão 999) — mesma
      // regra das outras fontes de XP (missões, torre, masmorra, AFK...).
      const settings = await jsonDb.getServerSettings();
      const pvpMaxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);
      while (newLevel < pvpMaxLevel && newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = xpForLevel(newLevel);
        newStatPoints += 3;
        if (newLevel % 3 === 0) newSkillPoints += 1;
      }
      // Cap no nível máximo: não acumula XP além do necessário.
      if (newLevel >= pvpMaxLevel) {
        newXp = 0;
        newXpToNext = 0;
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

      // Temporada da Arena: atualiza o melhor rating da temporada atual.
      const seasonInfo = pvpSeasonInfo();
      const seasonPatch = won ? trackSeasonBest({ ...char, pvpRating: newAtkRating }, seasonInfo.seasonId) : {};
      // Temporada GLOBAL: vitória no PvP dá pontos de temporada.
      const gSeasonPatch = won ? globalSeasonPatch(char, "pvp") : {};

      await jsonDb.updateCharacter(char.id, {
        pvpRating: newAtkRating,
        pvpLeague: leagueForRating(newAtkRating),
        pvpCoins: (char.pvpCoins || 0) + (won ? Math.floor(18 * (1 + leagueIndex * 0.3)) : Math.floor(5 * (1 + leagueIndex * 0.2))),
        pvpDailyDate: today,
        pvpDailyCount: newUsed,
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        gold: newGold,
        unspentStatPoints: newStatPoints,
        skillPoints: newSkillPoints,
        power,
        // Missões diárias/semanais: progresso de PvP (vitórias).
        ...(won ? trackProgress(char, "pvp", 1) : {}),
        ...seasonPatch,
        ...gSeasonPatch,
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