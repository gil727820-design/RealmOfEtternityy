import { NextRequest, NextResponse } from "next/server";
import { participantFromChar, requireOpenEvent } from "../_state";
import jsonDb from "@/db/repo";
import { powerCalc, resolveMaxLevel } from "@/game/constants";
import {
  applyXp,
  computeBossHit,
  computePlayerDamage,
  fmtBig,
  type WorldBossConfig,
  type WorldBossEventState,
} from "@/game/worldBoss";

/** Distribui as recompensas a todos os participantes (proporcional ao dano). */
async function distributeRewards(event: WorldBossEventState, cfg: WorldBossConfig, nowMs: number) {
  const total = Math.max(1, event.totalDamage);
  const granted: Array<{ characterId: string; name: string; gold: number; xp: number; towerCoins: number; levelUp: boolean; newLevel: number }> = [];

  // Nível máximo configurado no painel admin (0 = padrão 999).
  const settings = await jsonDb.getServerSettings();
  const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);

  for (const p of Object.values(event.participants)) {
    try {
      const char = await jsonDb.findCharacterById(p.characterId);
      if (!char) continue;
      const share = p.damageDealt / total;
      const gold = Math.floor(cfg.rewards.gold * share);
      const xp = Math.floor(cfg.rewards.xp * share);
      const coins = Math.floor(cfg.rewards.towerCoins);

      const { patch, newLevel } = applyXp(char, xp, maxLevel);
      const power = powerCalc({
        attack: Number(char.attack) || 0,
        defense: Number(char.defense) || 0,
        hp: Number(char.maxHp) || 0,
        speed: Number(char.speed) || 0,
        critical: Number(char.critical) || 0,
        level: newLevel,
      });

      await jsonDb.updateCharacter(p.characterId, {
        ...patch,
        gold: (Number(char.gold) || 0) + gold,
        towerCoins: (Number(char.towerCoins) || 0) + coins,
        power,
        lastActivity: new Date(nowMs).toISOString(),
      });

      granted.push({
        characterId: p.characterId,
        name: p.name,
        gold,
        xp,
        towerCoins: coins,
        levelUp: newLevel > (Number(char.level) || 1),
        newLevel,
      });
    } catch (e) {
      console.error(`[world-boss] falha ao recompensar ${p.characterId}:`, e);
    }
  }
  return granted;
}

/** Ataque ao boss: dano ao HP compartilhado + revide do boss + cooldown por jogador. */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const open = await requireOpenEvent(req, characterId);
    if (!open.ok) return open.response;
    const { ctx, auth } = open;
    const { cfg, event } = ctx;
    if (!event) return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });

    const now = Date.now();

    if (event.status !== "open") {
      const msg = event.status === "won"
        ? "O boss já foi derrotado! As recompensas foram distribuídas. Aguarde o próximo evento."
        : "O evento terminou.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Participante (entra automaticamente no primeiro ataque).
    let me = event.participants[auth.char.id] ?? participantFromChar(auth.char);

    // Respawn: jogador morto espera `respawnSec` segundos e volta com HP cheio.
    if (me.deadAt != null) {
      const respawnInMs = me.deadAt + cfg.respawnSec * 1000 - now;
      if (respawnInMs > 0) {
        return NextResponse.json(
          { error: `Você morreu! Renascerá em ${Math.ceil(respawnInMs / 1000)}s.`, respawnInMs },
          { status: 400 }
        );
      }
      me.hp = me.maxHp;
      me.deadAt = null;
      me.lastAttackAt = 0;
      me.joinedAt = new Date(now).toISOString();
      // Persiste o respawn ANTES do decrement atômico, para o estado recarregado
      // (`cur`) já refletir o jogador vivo de volta na batalha.
      await jsonDb.saveWorldBossEvent(event);
    }

    // Cooldown entre ataques do mesmo jogador.
    const cooldownMs = cfg.attackCooldownSec * 1000;
    const sinceLast = now - (me.lastAttackAt || 0);
    if (sinceLast < cooldownMs) {
      return NextResponse.json(
        { error: `Aguarde ${Math.ceil((cooldownMs - sinceLast) / 1000)}s para atacar novamente.`, cooldownMs: cooldownMs - sinceLast },
        { status: 429 }
      );
    }

    // Regeneração passiva de HP (100% a cada `regenSec` segundos).
    if (me.lastAttackAt > 0 && sinceLast > 0) {
      me.hp = Math.min(me.maxHp, me.hp + (me.maxHp * sinceLast) / (cfg.regenSec * 1000));
    }
    if (me.hp <= 0) {
      me.deadAt = now;
      event.participants[auth.char.id] = me;
      await jsonDb.saveWorldBossEvent(event);
      return NextResponse.json(
        { error: "Você foi derrotado pelo boss! Você renascerá logo.", deadAt: now, respawnInMs: cfg.respawnSec * 1000 },
        { status: 400 }
      );
    }

    let { damage, crit } = computePlayerDamage(auth.char, cfg);

    // Anti-one-shot: um único golpe NUNCA derruba o boss de uma vez (máx ~12%
    // do HP total por ataque). Assim um jogador muito forte não mata o evento
    // sozinho num hitkill — a batalha fica normal e todos têm chance de
    // contribuir/ganhar. Loga no console do servidor quando o cap é aplicado.
    const maxPerHit = Math.max(1, Math.floor(cfg.boss.maxHp * 0.12));
    if (damage > maxPerHit) {
      console.log(
        `[hitkill] ${auth.char.name || "?"} causaria ${damage} de dano (cap ${maxPerHit}) no Boss Mundial — dano limitado.`
      );
      // Registra no painel admin (aba Logs) para o admin acompanhar os hitkills.
      jsonDb.addAdminLog("hitkill", {
        source: "world-boss",
        characterId: auth.char.id,
        characterName: auth.char.name || "?",
        damage,
        cappedDamage: maxPerHit,
        bossHp: cfg.boss.maxHp,
        message: `${auth.char.name || "?"} causaria ${damage} de dano (cap ${maxPerHit}) no Boss Mundial — dano limitado.`,
      });
      damage = maxPerHit;
    }

    // Aplica o dano ao boss de forma ATÔMICA e usa o estado mais recente como base.
    const after = await jsonDb.decrementWorldBossHp(damage);
    const cur: WorldBossEventState = after ?? event;
    me = cur.participants[auth.char.id] ?? me;

    me.damageDealt += damage;
    me.hits += 1;
    me.lastAttackAt = now;

    // Revide do boss no jogador.
    const bossHit = computeBossHit(cfg, { defense: Number(auth.char.defense) || 0, maxHp: me.maxHp });
    me.hp = Math.max(0, Math.round(me.hp - bossHit.damage));
    if (me.hp <= 0) me.deadAt = now;
    else me.deadAt = null;

    cur.totalDamage += damage;
    cur.participants[auth.char.id] = me;

    const bossAlive = cur.bossHp > 0;
    cur.log.push(`${crit ? "💥" : "⚔️"} ${me.name} causou ${fmtBig(damage)} de dano${crit ? " (CRÍTICO!)" : ""}!`);
    cur.log.push(`👹 O boss revidou em ${me.name} por ${fmtBig(bossHit.damage)}${bossHit.crit ? " (crítico)" : ""}.`);
    if (cur.log.length > 40) cur.log = cur.log.slice(-40);

    let rewards: unknown = null;
    if (!bossAlive && !cur.rewardsGiven) {
      cur.status = "won";
      cur.rewardsGiven = true;
      rewards = await distributeRewards(cur, cfg, now);
      cur.log.push(`🏆 O BOSS MUNDIAL FOI DERROTADO! Todos os participantes receberam recompensas!`);
    }
    if (cur.log.length > 30) cur.log = cur.log.slice(-30);

    await jsonDb.saveWorldBossEvent(cur);

    return NextResponse.json({
      success: true,
      damage,
      crit,
      bossHit: bossHit.damage,
      bossHp: cur.bossHp,
      bossMaxHp: cur.bossMaxHp,
      bossAlive,
      playerHp: me.hp,
      playerMaxHp: me.maxHp,
      eventStatus: cur.status,
      cooldownMs,
      playerDead: me.deadAt != null,
      respawnSec: cfg.respawnSec,
      rewards,
    });
  } catch (e: unknown) {
    console.error("World boss attack error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
