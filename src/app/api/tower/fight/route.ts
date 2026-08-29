import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import {
  xpForLevel,
  powerCalc,
  towerMonsterForFloor,
  towerMonsterImage,
  isTowerMonsterKind,
  TOWER_MONSTER_NAMES,
  resolveMaxLevel,
  type TowerMonsterKind,
  type TowerBossKind,
} from "@/game/constants";
import { getSkinClassBuff, skinRarityMult } from "@/game/skinBuffs";
import { xpMultiplier, goldMultiplier } from "@/game/boosts";
import { classSkillEffect, type ClassName } from "@/game/constants";
import { skillTreeDebuff, DEBUFF_LOG } from "@/game/skillTree";
import { masteryBuff } from "@/game/mastery";
import { rollBossEnchant, isBossEnchant, equipmentBonus } from "@/game/forge";
import { requireCharacterAuth } from "@/game/auth";
import { trackProgress } from "@/game/dailyMissions";
import { checkRateLimit } from "@/game/rateLimit";
import {
  sanitizeAutoBattleSettings,
  shouldUsePotion,
  decideAutoAction,
} from "@/game/autoBattle";
import { petCombatBuff, getActivePet, grantPetXp } from "@/game/pets";
import { totalSetBonus } from "@/game/sets";
import { grantGuildActivityXp } from "@/game/guildActivity";
import { bestiaryDamageBonus, registerDefeat } from "@/game/bestiary";
import { applyRelicCombat } from "@/game/relics";
import { applySpecializationCombat } from "@/game/specializations";
import { applyAdvancedClassCombat, advSkillDmgMult } from "@/game/advancedClasses";
import { applyAscensionCombat } from "@/game/ascension";
import { seasonPatch } from "@/game/season";

const SKILL_COST = 15;
const MAX_ROUNDS = 40;

// Anti-burla "abandonar batalha": se o jogador inicia uma luta na torre e
// troca de página (ou some por mais de 2 min), a batalha EXPIRA no servidor —
// voltar não continua a luta antiga, ela recomeça do andar atual do zero.
// Antes dava pra começar, sair, voltar e a batalha seguia sozinha no auto.
const BATTLE_TTL_MS = 2 * 60 * 1000;

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
  // Progressão SUAVE: os monstros ficam mais fortes gradualmente.
  // Curva leve que permite subir dezenas de andares por sessão no início,
  // ficando desafiador apenas nos andares altos (100+).
  //
  // BALANCEAMENTO: crescimento QUASE LINEAR com leve aceleração.
  // HP ~ f*12, ataque ~ f*1.8, defesa ~ f*1.1 — progressão justa.
  const bossMult = boss ? 1.5 : 1;
  return {
    kind,
    image: towerMonsterImage(kind),
    nameKey: TOWER_MONSTER_NAMES[kind],
    maxHp: Math.max(40, Math.round((20 + f * 12 + f * f * 0.02) * bossMult)),
    attack: Math.max(3, Math.round((4 + f * 1.8 + f * f * 0.012) * bossMult)),
    defense: Math.max(1, Math.round((1 + f * 1.1 + f * f * 0.008) * bossMult)),
    speed: Math.max(1, Math.round((1 + f * 0.04) * 100) / 100),
    critical: Math.min(30, Math.round(1 + f * 0.18)),
    dodge: Math.min(15, Math.round((0.5 + f * 0.08) * 10) / 10),
    goldReward: boss ? 150 + f * 35 : 40 + f * 25,
    // XP escala com a CURVA DE NÍVEL — recompensa generosa para subir rápido.
    // Chefe paga o triplo (desafio maior = recompensa maior).
    xpReward: Math.max(30, Math.floor(xpForLevel(lv) * (0.02 + floorBoost * 0.003)) * (boss ? 3 : 1)),
    coinsReward: boss ? 40 + Math.floor(f / 8) : 6 + Math.floor(f / 10),
    boss,
  };
}

/**
 * Anti-one-shot da torre: se o dano máximo do jogador num único golpe já
 * mataria o monstro (hitkill), ele é escalado na hora para virar uma batalha
 * de verdade — HP alto o bastante pra sobreviver vários golpes e ataque forte
 * o bastante pra derrubar o jogador (chance real dos dois lados).
 *
 * Antes só chefes eram escalados — um jogador forte passava os andares comuns
 * no 1-hit e subia milhares de andares. Agora vale para TODO monstro: mob
 * comum vira uma luta de ~3 golpes e chefe uma batalha épica de ~8. Só loga
 * hitkill de chefe (mob comum escalado a cada andar encheria o painel).
 */
function antiOneShot(char: any, mon: any, ca: any, atkFactor: number, floor: number) {
  const playerMaxHit = Math.round(ca.attack * Math.max(1, atkFactor) * 1.7);
  if (playerMaxHit < mon.maxHp) return mon;
  const hpMult = mon.boss ? 8 : 3;
  const atkMult = mon.boss ? 0.22 : 0.16;
  const hp = Math.max(mon.maxHp, Math.round(playerMaxHit * hpMult));
  const atk = Math.max(mon.attack, Math.round(ca.maxHp * atkMult));
  if (mon.boss) {
    console.log(
      `[hitkill] ${char.name || "?"} causaria ~${playerMaxHit} de dano e o chefe tem ${mon.maxHp} HP — chefe escalado para batalha justa.`
    );
    // Registra no painel admin (aba Logs) para o admin acompanhar os hitkills.
    jsonDb.addAdminLog("hitkill", {
      source: "tower",
      characterId: char.id,
      characterName: char.name || "?",
      floor: Math.max(1, Number(floor) || 1),
      playerMaxHit,
      bossHp: mon.maxHp,
      scaledHp: hp,
      scaledAttack: atk,
      message: `${char.name || "?"} causaria ~${playerMaxHit} de dano e o chefe tem ${mon.maxHp} HP — chefe escalado para batalha justa.`,
    });
  }
  return { ...mon, maxHp: hp, attack: atk, scaled: true };
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
    // Preferências do Auto Battle (modo/auto-skill/auto-poção) — o servidor
    // decide a ação usando estas preferências; o cliente NÃO manda a ação.
    const autoSettings = sanitizeAutoBattleSettings(body?.auto);

    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    // Só o dono pode lutar na torre com o próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Limites/balanceamento configurados no painel admin (server_settings).
    const settings = await jsonDb.getServerSettings();
    // Multiplicador de XP da torre (ex.: 0.3 = só 30% do XP — "torre apelona").
    const towerXpMult = Math.max(0.01, Number(settings?.towerXpMult) || 1);
    // Andar máximo da torre (0 = sem limite).
    const maxTowerFloor = Math.max(0, Number(settings?.maxTowerFloor) || 0);
    // Nível máximo que o personagem pode alcançar (0 = padrão 999).
    const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);

    const ca = getCharCombat(char);
    // Bônus do BESTIÁRIO: +5% de dano por categoria completa.
    const bestiaryBonus = bestiaryDamageBonus(char);
    if (bestiaryBonus) ca.attack = Math.round(ca.attack * (1 + bestiaryBonus / 100));
    // Buffs da RELÍQUIA equipada (ataque/defesa/HP/velocidade/crítico %).
    applyRelicCombat(char, ca);
    // Buffs da ESPECIALIZAÇÃO de classe (passivos permanentes).
    applySpecializationCombat(char, ca);
    // Buffs da CLASSE AVANÇADA (evolução nível 50+, passivos permanentes).
    applyAdvancedClassCombat(char, ca);
    // Buffs da ASCENSÃO (patamares divinos a cada 100 níveis: dano/HP/velocidade).
    applyAscensionCombat(char, ca);
    // Buffs da GUILDA (snapshot gravado ao entrar/melhorar): HP máx % e dano %.
    const guildBuff = (char.guildBuffs && typeof char.guildBuffs === "object" ? char.guildBuffs : {}) as Record<string, number>;
    if (guildBuff.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + (Number(guildBuff.maxHpPct) || 0) / 100));
    if (guildBuff.damagePct) ca.attack = Math.round(ca.attack * (1 + (Number(guildBuff.damagePct) || 0) / 100));
    // Buff do PET equipado: dano %, defesa %, HP máx % e crítico %.
    const petBuff = petCombatBuff(char);
    if (petBuff) {
      if (petBuff.damagePct) ca.attack = Math.round(ca.attack * (1 + petBuff.damagePct / 100));
      if (petBuff.defensePct) ca.defense = Math.round(ca.defense * (1 + petBuff.defensePct / 100));
      if (petBuff.maxHpPct) ca.maxHp = Math.round(ca.maxHp * (1 + petBuff.maxHpPct / 100));
      if (petBuff.critPct) ca.critical = Math.min(90, ca.critical + petBuff.critPct);
    }
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
    // Andar REAL da batalha em andamento: no "start" é o andar atual do
    // personagem; nas ações de combate é o andar do próprio estado da batalha.
    // Usar o andar da batalha (e não o valor do banco no momento da requisição)
    // garante que uma vitória avance exatamente 1 andar, mesmo se duas batalhas
    // do mesmo andar chegarem ao fim concorrentemente (evita pular de 2 em 2).
    const battleFloor = action === "start" ? floor : Math.max(1, Number(state?.floor) || floor);

    // ---- Iniciar batalha (spawn do NPC) ----
    if (action === "start") {
      const kind = towerMonsterForFloor(floor);
      const seed = Math.floor(Math.random() * 1e9);
      const mon = antiOneShot(char, floorMonster(char, floor, kind, seed), ca, atkFactor, floor);
      return NextResponse.json({
        ok: true,
        action,
        floor,
        battle: {
          seed,
          startedAt: Date.now(),
          floor,
          kind,
          monNameKey: mon.nameKey,
          monImage: mon.image,
          boss: mon.boss,
          scaled: mon.scaled,
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

    // Batalha abandonada (saiu da página / ficou parado demais) → expira.
    const startedAt = Number(state.startedAt) || 0;
    if (startedAt > 0 && Date.now() - startedAt > BATTLE_TTL_MS) {
      return NextResponse.json(
        { error: "Batalha expirada — você ficou fora tempo demais. Recomece!", code: "battle_expired" },
        { status: 410 }
      );
    }

    const seed = Number(state.seed) || 1;
    const kind = isTowerMonsterKind(state.kind) ? (state.kind as TowerMonsterKind | TowerBossKind) : "slime";
    const mon = antiOneShot(char, floorMonster(char, state.floor || floor, kind, seed), ca, atkFactor, state.floor || floor);

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

    // ---- AUTO BATTLE: o servidor decide a ação (anti-cheat) ----
    // Usa poção de HP do inventário se a vida estiver abaixo do limite e
    // escolhe a ação conforme o modo (agressivo/equilibrado/defensivo).
    let resolvedAction = action;
    if (action === "auto") {
      if (shouldUsePotion(charHp, ca.maxHp, autoSettings)) {
        const inv = await jsonDb.getInventoryForCharacter(char.id);
        const potion = inv.find(
          (e: any) =>
            e.template?.type === "consumable" &&
            Number(e.template?.effect?.hp || 0) > 0 &&
            !e.item?.equipped &&
            !e.item?.listed &&
            !e.item?.reservedFor &&
            (Number(e.quantity) || 1) > 0
        );
        if (potion) {
          const heal = Math.min(
            ca.maxHp - charHp,
            Math.round(Number(potion.template.effect.hp) || 0)
          );
          if (heal > 0) {
            await jsonDb.decrementInventoryItem(String(potion.item.id), 1);
            charHp = Math.min(ca.maxHp, charHp + heal);
            log.push(`🧪 Você bebeu uma poção de vida! +${heal} HP`);
            events.push({ type: "heal", target: "player", amount: heal });
          }
        }
      }
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

    // ---- Ação do personagem (definida pelo jogador OU pelo Auto Battle) ----
    if (resolvedAction === "defend") {
      defended = true;
      const regen = Math.min(8, ca.maxMana - charMp);
      charMp += regen;
      log.push("🛡️ Você assume postura de defesa.");
      events.push({ type: "defend", target: "player" });
    } else if (resolvedAction === "skill") {
      const cost = skillFx.manaCost ?? SKILL_COST;
      if (charMp < cost) {
        return NextResponse.json({ error: "Mana insuficiente", code: "no_mana" }, { status: 400 });
      }
      charMp -= cost;
      skillUsed = true;
      const pierceDef = mon.defense * (1 - (skillFx.pierce || 0));
      // Classe avançada: turbina o golpe poderoso (multiplica o dmgMult da classe).
      const advSkillMult = advSkillDmgMult(char);
      const r = strike(
        { attack: Math.round(ca.attack * (skillFx.dmgMult || 1.8) * atkFactor * advSkillMult), critical: ca.critical + (skillFx.critBonus ?? 15) + critAdd, precision: ca.precision },
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
      // PET FÊNIX: revive 1x por batalha — ao invés de morrer, volta com 1 HP.
      // O servidor controla o uso (state.petRevived) e nunca deixa reviver 2x.
      if (charHp <= 0 && petBuff?.revive && !state.petRevived) {
        charHp = 1;
        state.petRevived = true;
        log.push("🔥 Sua Fênix reviveu você! +1 HP");
        events.push({ type: "revive", target: "player", amount: 1 });
      } else if (charHp <= 0) {
        lost = true;
      }
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

    // ---- Anti-cheat: limite de vitórias por janela (loga no painel admin) ----
    if (won) {
      const ok = checkRateLimit(`tower_${char.id}`, Date.now(), (msg) => {
        jsonDb.addAdminLog("anticheat", {
          source: "tower",
          characterId: char.id,
          characterName: char.name || "?",
          message: msg,
        });
      });
      if (!ok) {
        return NextResponse.json(
          { error: "Ação muito rápida — aguarde alguns segundos.", code: "rate_limited" },
          { status: 429 }
        );
      }
    }

    // ---- Persistir resultado (apenas no fim) ----
    let rewards: any;
    if (won || lost) {
      if (won) {
        const xpEarned = mon.xpReward * xpMultiplier(char) * towerXpMult;
        let newXp = (char.xp || 0) + xpEarned;
        let newLevel = char.level || 1;
        let newXpToNext = char.xpToNext || 100;
        let newStatPoints = char.unspentStatPoints || 0;
        let newSkillPoints = char.skillPoints || 0;
        while (newLevel < maxLevel && newXp >= newXpToNext) {
                  newXp -= newXpToNext;
                  newLevel++;
                  newXpToNext = xpForLevel(newLevel);
                  newStatPoints += 3;
                  if (newLevel % 3 === 0) newSkillPoints += 1;
                }
                // Cap no nível máximo: não acumula XP além do necessário.
                if (newLevel >= maxLevel) {
                  newXp = 0;
                  newXpToNext = 0;
                }
        const newGold = (char.gold || 0) + Math.floor(mon.goldReward * goldMultiplier(char));
        const newCoins = (char.towerCoins || 0) + mon.coinsReward;
        // O PET equipado ganha XP junto com o herói (escala com o andar).
        const petXpGain = Math.max(5, Math.floor(mon.xpReward * 0.08));
        const pet = grantPetXp(char, petXpGain);
        // Guilda evolutiva: vitória na torre dá XP para a guilda.
        const guildXp = await grantGuildActivityXp(char.id, "tower");
        // Avança 1 andar por vitória, respeitando o limite configurado no admin.
        const newTowerFloor = maxTowerFloor > 0 ? Math.min(maxTowerFloor, battleFloor + 1) : battleFloor + 1;
        const power = powerCalc({
          attack: ca.attack,
          defense: ca.defense,
          hp: ca.maxHp,
          speed: ca.speed,
          critical: ca.critical,
          level: newLevel,
        });
        // ---- Encanto EXCLUSIVO DE CHEFE: vencer um chefe (andar múltiplo de
        // 10) encanta GRATUITAMENTE a arma equipada com um encanto forte que
        // só existe aqui (não sai na forja). Se a arma já tem encanto de chefe,
        // não substitui (acumula apenas o primeiro). ----
        let bossEnchant = null;
        if (mon.boss && won) {
          const inv = await jsonDb.getInventoryForCharacter(char.id);
          const weapon = inv.find(
            (e: any) => e.item?.equipped && e.template?.slot === "weapon" && e.template?.type !== "consumable"
          );
          if (weapon) {
            const cur = String(weapon.item.enchant || "");
            if (!isBossEnchant(cur)) {
              const ench = rollBossEnchant();
              await jsonDb.updateInventoryItem(String(weapon.item.id), { enchant: ench.id });
              bossEnchant = ench;
              // Se a arma está equipada, recalcula os atributos (bônus novo).
              const freshInv = await jsonDb.getInventoryForCharacter(char.id);
              let total = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
              for (const e of freshInv) {
                if (!e.item?.equipped || e.template?.type === "consumable") continue;
                const b = equipmentBonus(e.template, e.item);
                total.attack += b.attack;
                total.defense += b.defense;
                total.maxHp += b.maxHp;
                total.speed += b.speed;
                total.critical += b.critical;
              }
              // Bônus de SETS (peças equipadas da mesma raridade) também entram.
              const setBonus = totalSetBonus(freshInv.filter((e: any) => e.item?.equipped), newLevel);
              total.attack += setBonus.attack;
              total.defense += setBonus.defense;
              total.maxHp += setBonus.maxHp;
              total.critical += setBonus.critical;
              const base = (char.baseStats && typeof char.baseStats === "object" ? char.baseStats : {}) as Record<string, number>;
              const patchStats = {
                attack: Math.max(0, (Number(base.attack) || 0) + total.attack),
                defense: Math.max(0, (Number(base.defense) || 0) + total.defense),
                maxHp: Math.max(1, (Number(base.maxHp) || 0) + total.maxHp),
                speed: Math.max(0, (Number(base.speed) || 0) + total.speed),
                critical: Math.max(0, (Number(base.critical) || 0) + total.critical),
              };
              await jsonDb.updateCharacter(char.id, {
                ...patchStats,
                hp: Math.min(Number(char.hp) || patchStats.maxHp, patchStats.maxHp),
                power: powerCalc({ ...patchStats, hp: patchStats.maxHp, level: newLevel }),
              });
            }
          }
        }

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
          pets: pet.pets,
          // Missões diárias/semanais: progresso de torre.
          ...trackProgress(char, "tower", 1),
          // Temporada global: andar vencido dá pontos de temporada.
          ...seasonPatch(char, "tower"),
          lastActivity: new Date().toISOString(),
        });
        rewards = {
          gold: mon.goldReward,
          xp: xpEarned,
          coins: mon.coinsReward,
          levelUp: newLevel > (char.level || 0),
          newLevel,
          newFloor: newTowerFloor,
          guildXp,
          petXp: petXpGain,
          petLeveledUp: pet.leveledUp,
          activePet: getActivePet(char) ? { id: getActivePet(char)!.def.id, nameKey: getActivePet(char)!.def.nameKey, level: getActivePet(char)!.level } : null,
          bossEnchant: bossEnchant ? { id: bossEnchant.id, icon: bossEnchant.icon, stat: bossEnchant.stat, amount: bossEnchant.amount } : null,
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
      floor: battleFloor,
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
        scaled: mon.scaled,
        petRevived: !!state.petRevived,
        round,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}