import { NextRequest, NextResponse } from "next/server";
import { participantFromChar, requireOpenEvent } from "../_state";
import jsonDb from "@/db/repo";
import { powerCalc, resolveMaxLevel } from "@/game/constants";
import { seasonPatch } from "@/game/season";
import {
  applyXp,
  computeBossHit,
  computePlayerDamage,
  fmtBig,
  randomUUID,
  worldBossPhase,
  type WorldBossConfig,
  type WorldBossEventState,
  type WorldBossMob,
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

/** Ativa o escudo por fase (75/50/25% restante) quando o HP cruza um threshold ainda não atingido. */
function maybeActivateShield(event: WorldBossEventState, cfg: WorldBossConfig, nowMs: number) {
  if (!cfg.shield.enabled || event.status !== "open" || event.shieldActive) return false;
  const pct = event.bossMaxHp > 0 ? event.bossHp / event.bossMaxHp : 0;
  // Só os thresholds acima do HP atual ainda não disparados; pega o MAIOR (primeiro a ser cruzado).
  const candidates = cfg.shield.thresholds
    .filter((t) => pct <= t && !(event.shieldThresholdsHit || []).includes(t))
    .sort((a, b) => b - a);
  if (!candidates.length) return false;
  const threshold = candidates[0];
  event.shieldActive = true;
  event.shieldThreshold = threshold;
  event.shieldPhaseAt = new Date(nowMs).toISOString();
  event.shieldExpiresAt = nowMs + cfg.shield.durationSec * 1000;
  event.shieldThresholdsHit = [...(event.shieldThresholdsHit || []), threshold];
  event.log.push(`🛡️ O boss ergueu um escudo ao chegar a ${Math.round(threshold * 100)}% de vida! Quebre-o ou ele conjurará criaturas.`);
  return true;
}

/** Remove o escudo e, se configurado, spawna uma nova leva de mobs. */
function deactivateShieldAndSpawnMobs(event: WorldBossEventState, cfg: WorldBossConfig, nowMs: number) {
  event.shieldActive = false;
  event.shieldPhaseAt = null;
  event.shieldThreshold = undefined;
  event.shieldExpiresAt = undefined;

  if (cfg.spawnMobs.enabled && cfg.spawnMobs.count > 0 && cfg.spawnMobs.kinds.length) {
    const mobs: WorldBossMob[] = [];
    for (let i = 0; i < cfg.spawnMobs.count; i++) {
      const kind = cfg.spawnMobs.kinds[Math.floor(Math.random() * cfg.spawnMobs.kinds.length)];
      mobs.push({
        id: randomUUID(),
        kind,
        maxHp: cfg.spawnMobs.hp,
        hp: cfg.spawnMobs.hp,
        damageDone: 0,
        damageBy: {},
        spawnedAt: new Date(nowMs).toISOString(),
        rewardGiven: false,
      });
    }
    event.mobs = [...(event.mobs || []), ...mobs];
    event.mobsSpawnedAt = nowMs;
    event.log.push(`🐉 O boss conjurou ${mobs.length} criatura(s)! Derrote-as para ganhar recompensas.`);
  }
}

/** Recompensa proporcional aos jogadores que causaram dano a um mob morto. */
async function rewardMobKillers(
  mob: WorldBossMob,
  cfg: WorldBossConfig,
  nowMs: number
): Promise<{ characterId: string; name: string; gold: number; xp: number; levelUp: boolean; newLevel: number }[]> {
  const settings = await jsonDb.getServerSettings();
  const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);
  const total = Math.max(1, mob.damageDone);
  const granted: { characterId: string; name: string; gold: number; xp: number; levelUp: boolean; newLevel: number }[] = [];

  for (const [charId, dmg] of Object.entries(mob.damageBy)) {
    try {
      const char = await jsonDb.findCharacterById(charId);
      if (!char) continue;
      const share = dmg / total;
      const gold = Math.floor(cfg.spawnMobs.reward.gold * share);
      const xp = Math.floor(cfg.spawnMobs.reward.xp * share);

      const { patch, newLevel } = applyXp(char, xp, maxLevel);
      const power = powerCalc({
        attack: Number(char.attack) || 0,
        defense: Number(char.defense) || 0,
        hp: Number(char.maxHp) || 0,
        speed: Number(char.speed) || 0,
        critical: Number(char.critical) || 0,
        level: newLevel,
      });

      await jsonDb.updateCharacter(charId, {
        ...patch,
        gold: (Number(char.gold) || 0) + gold,
        power,
        lastActivity: new Date(nowMs).toISOString(),
      });

      granted.push({
        characterId: charId,
        name: String(char.name || "?"),
        gold,
        xp,
        levelUp: newLevel > (Number(char.level) || 1),
        newLevel,
      });
    } catch (e) {
      console.error(`[world-boss] falha ao recompensar killer do mob ${charId}:`, e);
    }
  }
  return granted;
}

/** Ataque ao boss: dano ao HP compartilhado + revide do boss + cooldown por jogador. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId } = body;
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

    // ─── ATAQUE A MOB (target adicional durante o escudo) ────────────────
    const mobId = typeof body.mobId === "string" ? body.mobId : null;
    if (mobId) {
      event.mobs = event.mobs || [];
      const idx = event.mobs.findIndex((m) => m.id === mobId);
      const mob = idx >= 0 ? event.mobs[idx] : null;
      if (!mob || mob.hp <= 0 || mob.rewardGiven) {
        return NextResponse.json({ error: "Esta criatura já foi derrotada." }, { status: 400 });
      }

      let { damage, crit } = computePlayerDamage(auth.char, cfg);
      // Cap suave (máx 50% do HP do mob por golpe) para não matar instantaneamente.
      const mobCap = Math.max(1, Math.floor(mob.maxHp * 0.5));
      if (damage > mobCap) damage = mobCap;

      me.lastAttackAt = now;
      me.damageDealt += damage; // conta também como participação no evento
      me.hits += 1;

      mob.damageDone += damage;
      mob.hp = Math.max(0, mob.hp - damage);
      mob.damageBy[auth.char.id] = (mob.damageBy[auth.char.id] || 0) + damage;
      event.totalDamage += Math.min(damage, mob.maxHp);
      event.participants[auth.char.id] = me;

      let mobRewards: unknown = null;
      if (mob.hp <= 0 && !mob.rewardGiven) {
        mob.rewardGiven = true;
        mob.killerName = me.name;
        mobRewards = await rewardMobKillers(mob, cfg, now);
        event.log.push(`💀 ${me.name} abateu uma criatura! ${(mobRewards as any[])?.length || 0} participante(s) receberam recompensa.`);
      } else {
        event.log.push(`${crit ? "💥" : "🐉"} ${me.name} causou ${fmtBig(damage)} de dano numa criatura${crit ? " (CRÍTICO!)" : ""}.`);
      }
      if (event.log.length > 30) event.log = event.log.slice(-30);

      await jsonDb.saveWorldBossEvent(event);
      return NextResponse.json({
        success: true,
        mobId,
        damage,
        crit,
        mobHp: mob.hp,
        mobMaxHp: mob.maxHp,
        mobAlive: mob.hp > 0,
        mobRewards,
        playerHp: me.hp,
        playerMaxHp: me.maxHp,
        playerDead: me.deadAt != null,
        cooldownMs,
        shieldActive: event.shieldActive,
        mobs: event.mobs.map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, maxHp: m.maxHp })),
      });
    }

    // ─── ATAQUE AO BOSS ──────────────────────────────────────────────────
    // Escudo: se o boss está protegido, o jogador NÃO causa dano (fica imune)
    // e precisa comprar um quebra-escudo (ou esperar expirar).
    if (event.shieldActive) {
      const expiresAt = event.shieldExpiresAt ?? 0;
      if (expiresAt > now) {
        // Registrar cooldown usado para evitar spam de erro.
        me.lastAttackAt = now;
        event.participants[auth.char.id] = me;
        await jsonDb.saveWorldBossEvent(event);
        return NextResponse.json(
          {
            error: `O boss está protegido por um escudo! Compre um quebra-escudo para removê-lo.`,
            shieldActive: true,
            shieldExpiresInMs: expiresAt - now,
            shieldThreshold: event.shieldThreshold,
            cooldownMs,
          },
          { status: 400 }
        );
      }
      // Escudo EXPIRADO sozinho: some e spawna mobs.
      deactivateShieldAndSpawnMobs(event, cfg, now);
      await jsonDb.saveWorldBossEvent(event);
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

    // Revide do boss no jogador (somente se o boss está "atacável").
    // FASE DE ENFURECIMENTO: o boss fica mais forte a cada 25% de HP perdido
    // (+dano, +velocidade, +crítico) — a batalha esquenta no final.
    const hpPct = cur.bossMaxHp > 0 ? cur.bossHp / cur.bossMaxHp : 0;
    const phase = worldBossPhase(hpPct);
    const bossHit = computeBossHit(cfg, { defense: Number(auth.char.defense) || 0, maxHp: me.maxHp });
    bossHit.damage = Math.max(1, Math.round(bossHit.damage * phase.attackMult));
    me.hp = Math.max(0, Math.round(me.hp - bossHit.damage));
    if (me.hp <= 0) me.deadAt = now;
    else me.deadAt = null;

    cur.totalDamage += damage;
    cur.participants[auth.char.id] = me;

    const bossAlive = cur.bossHp > 0;
    cur.log.push(`${crit ? "💥" : "⚔️"} ${me.name} causou ${fmtBig(damage)} de dano${crit ? " (CRÍTICO!)" : ""}!`);
    cur.log.push(`👹 O boss revidou em ${me.name} por ${fmtBig(bossHit.damage)}${bossHit.crit ? " (crítico)" : ""} (fase ${phase.phase}).`);
    if (cur.log.length > 40) cur.log = cur.log.slice(-40);

    // O dano pode ter levado o HP do boss até um threshold → ativa o escudo.
    const shieldActivated = maybeActivateShield(cur, cfg, now);

    // Temporada global: cada ataque ao Boss Mundial dá pontos de temporada.
    await jsonDb.updateCharacter(auth.char.id, seasonPatch(auth.char, "worldboss"));

    let rewards: unknown = null;
    if (!bossAlive && !cur.rewardsGiven) {
      cur.status = "won";
      cur.rewardsGiven = true;
      rewards = await distributeRewards(cur, cfg, now);
      cur.log.push(`🏆 O BOSS MUNDIAL FOI DERROTADO! Todos os participantes receberam recompensas!`);

      // Log administrativo do RESULTADO do Boss Mundial: ranking top3 (dano).
      const ranked = Object.values(cur.participants)
        .map((p) => ({ name: p.name, characterId: p.characterId, damageDealt: p.damageDealt }))
        .sort((a, b) => b.damageDealt - a.damageDealt)
        .slice(0, 3);
      jsonDb.addAdminLog("worldboss_result", {
        source: "world-boss",
        message: `🏆 Boss Mundial DERROTADO! 1º ${ranked[0]?.name ?? "?"} (${fmtBig(ranked[0]?.damageDealt ?? 0)}), 2º ${ranked[1]?.name ?? "?"} (${fmtBig(ranked[1]?.damageDealt ?? 0)}), 3º ${ranked[2]?.name ?? "?"} (${fmtBig(ranked[2]?.damageDealt ?? 0)}). Participantes: ${Object.keys(cur.participants).length}.`,
        top1: ranked[0] ?? null,
        top2: ranked[1] ?? null,
        top3: ranked[2] ?? null,
        participants: Object.keys(cur.participants).length,
        totalDamage: cur.totalDamage,
      });
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
      shieldActivated,
      shieldActive: cur.shieldActive,
      shieldThreshold: cur.shieldThreshold,
      shieldExpiresInMs: cur.shieldActive ? (cur.shieldExpiresAt ?? now) - now : 0,
      breakShieldCost: cfg.shield.breakCost,
      phase: { phase: phase.phase, nameKey: phase.nameKey, attackMult: phase.attackMult },
      mobs: (cur.mobs || []).map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, maxHp: m.maxHp })),
      rewards,
    });
  } catch (e: unknown) {
    console.error("World boss attack error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}