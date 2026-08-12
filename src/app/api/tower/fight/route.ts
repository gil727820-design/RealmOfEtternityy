import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import {
  xpForLevel,
  powerCalc,
  towerMonsterForFloor,
  towerMonsterImage,
  TOWER_MONSTER_NAMES,
  type TowerMonsterKind,
} from "@/game/constants";
import { getSkinClassBuff, skinRarityMult } from "@/game/skinBuffs";
import { xpMultiplier } from "@/game/boosts";

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
    critical: Number(char.critical) || 0,
    dodge: Number(char.dodge) || 0,
    precision: Number(char.precision) || 0,
    maxHp: Number(char.maxHp) || 100,
    maxMana: Number(char.maxMana) || 50,
  };
}

function floorMonster(floor: number, kind: TowerMonsterKind, seed: number) {
  const rng = mulberry32(seed);
  rng();
  rng();
  const boss = floor % 10 === 0;
  const mult = boss ? 2.0 : 1;
  // Bônus extras do chefe para torná-lo bem mais forte (vida, força, defesa, crítico)
  const bHp = boss ? Math.round(floor * 25 + 80) : 0;
  const bAtk = boss ? Math.round(floor * 2 + 8) : 0;
  const bDef = boss ? Math.round(floor + 2) : 0;
  return {
    kind,
    image: towerMonsterImage(kind),
    nameKey: TOWER_MONSTER_NAMES[kind],
    maxHp: Math.round((60 + floor * 20) * mult) + bHp,
    attack: (6 + floor * 4) * mult + bAtk,
    defense: (3 + floor * 2) * mult + bDef,
    speed: 2 + floor * 0.9,
    critical: Math.min(40, (2 + floor * 0.4) * (boss ? 1.5 : 1)),
    dodge: Math.min(20, 1 + floor * 0.35),
    goldReward: boss ? 60 + floor * 30 : 20 + floor * 15,
    xpReward: boss ? 40 + floor * 25 : 15 + floor * 12,
    coinsReward: boss ? 35 : 5,
    boss,
  };
}

// Golpe: retorna dano, crítico ou esquiva
function strike(
  att: { attack: number; critical: number; precision: number },
  def: { defense: number; dodge: number }
) {
  const dodge = Math.max(0, def.dodge - (att.precision || 0) * 0.15);
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

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const ca = getCharCombat(char);
    // Buff ativado pela skin equipada (só ativa se for da própria classe)
    const skinBuff = getSkinClassBuff(char.classType, char.activeSkinId);
    const skinMult = skinBuff ? skinRarityMult(char.activeSkinId) : 1;
    const atkFactor = skinBuff ? skinBuff.damageMult * skinMult : 1;
    const critAdd = skinBuff ? skinBuff.critBonus : 0;
    const takenFactor = skinBuff ? skinBuff.takenMult : 1;
    const floor = Number(char.towerFloor) || 1;

    // ---- Iniciar batalha (spawn do NPC) ----
    if (action === "start") {
      const kind = towerMonsterForFloor(floor);
      const seed = Math.floor(Math.random() * 1e9);
      const mon = floorMonster(floor, kind, seed);
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
    const kinds = ["slime", "lobo", "aranha", "esqueleto", "golem", "minotauro", "espectro", "dragao"] as TowerMonsterKind[];
    const kind = kinds.includes(state.kind) ? (state.kind as TowerMonsterKind) : "slime";
    const mon = floorMonster(state.floor || floor, kind, seed);

    // Estado atual, garantindo limites (não confiamos cegamente no cliente)
    let charHp = Math.min(ca.maxHp, Math.max(1, Number(state.charHp) || ca.maxHp));
    let charMp = Math.min(ca.maxMana, Math.max(0, Number(state.charMp) || ca.maxMana));
    let monHp = Math.min(mon.maxHp, Math.max(0, Number(state.monHp) || mon.maxHp));
    let round = Math.max(0, Number(state.round) || 0);

    const log: string[] = [];
    const events: any[] = [];
    let defended = false;
    let bleedStack = 0; // sangramento acumulado no inimigo (skin de assassino)

    // ---- Ação do personagem ----
    if (action === "defend") {
      defended = true;
      const regen = Math.min(8, ca.maxMana - charMp);
      charMp += regen;
      log.push("🛡️ Você assume postura de defesa.");
      events.push({ type: "defend", target: "player" });
    } else if (action === "skill") {
      if (charMp < SKILL_COST) {
        return NextResponse.json({ error: "Mana insuficiente", code: "no_mana" }, { status: 400 });
      }
      charMp -= SKILL_COST;
      const r = strike(
        { attack: Math.round(ca.attack * 1.8 * atkFactor), critical: ca.critical + 15 + critAdd, precision: ca.precision },
        { defense: mon.defense, dodge: mon.dodge }
      );
      if (r.dodged) {
        log.push(`💨 O inimigo desviou do golpe poderoso!`);
        events.push({ type: "dodge", target: "monster" });
      } else {
        monHp = Math.max(0, monHp - r.dmg);
        log.push(`✨ Golpe Poderoso! -${r.dmg}${r.crit ? " 💥CRÍTICO!" : ""}`);
        events.push({ type: r.crit ? "crit" : "skill", target: "monster", amount: r.dmg });
        if (skinBuff?.bleedPerRound) bleedStack += Math.max(1, Math.round(ca.attack * skinBuff.bleedPerRound * skinMult));
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

    // Sangramento da skin (ex.: assassino) atinge o inimigo
    if (bleedStack > 0 && monHp > 0) {
      monHp = Math.max(0, monHp - bleedStack);
      log.push(`🩸 O inimigo sangra! -${bleedStack}`);
      events.push({ type: "bleed", target: "monster", amount: bleedStack });
    }

    let won = false;
    let lost = false;

    // ---- Resposta do monstro (se ainda vivo) ----
    if (monHp <= 0) {
      won = true;
    } else {
      const r = strike(
        { attack: mon.attack, critical: mon.critical, precision: 0 },
        { defense: ca.defense, dodge: ca.dodge }
      );
      if (r.dodged) {
        log.push(`✅ Você desviou do contra-ataque!`);
        events.push({ type: "dodge", target: "player" });
      } else {
        const taken = Math.max(1, Math.round((defended ? Math.max(1, Math.round(r.dmg * 0.5)) : r.dmg) * takenFactor));
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
        while (newXp >= newXpToNext) {
          newXp -= newXpToNext;
          newLevel++;
          newXpToNext = xpForLevel(newLevel);
          newStatPoints += 3;
        }
        const newGold = (char.gold || 0) + mon.goldReward;
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