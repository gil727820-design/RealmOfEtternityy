import { NextRequest, NextResponse } from "next/server";
import { loadCtx } from "./_state";
import { fmtBig, nextWorldBossOpening, worldBossPhase, type WorldBossMob } from "@/game/worldBoss";
import { randomUUID } from "@/game/worldBoss";
import jsonDb from "@/db/repo";

/**
 * Estado público do Evento Global (Boss Mundial).
 * Sem autenticação obrigatória (igual à loja fantasma): devolve se o evento
 * está acontecendo, dados do boss, squads, convites e o log.
 * `?characterId=...` (opcional) personaliza a resposta: participante, squad e
 * convites recebidos pelo jogador.
 */
export async function GET(req: NextRequest) {
  try {
    const { cfg, status, event } = await loadCtx();
    const characterId = new URL(req.url).searchParams.get("characterId") || null;

    // Foto customizada do admin (server_settings.worldBossImage) tem prioridade;
    // caso contrário o cliente resolve via towerMonsterImage(kind).
    const settings = await jsonDb.getServerSettings();
    const bossImage = cfg.bossImage || settings?.worldBossImage || "";

    // Evento CLOSED se o boss já foi derrotado (não respawna na mesma janela).
    // Nesse caso `nextOpening` aponta para a próxima abertura agendada.
    const won = event?.status === "won";
    const nextOpening = won ? nextWorldBossOpening(cfg) : status.nextOpening;

    // Escudo expirado sozinho: remove e spawna a leva de mobs (mesma regra do
    // ataque) — sem precisar de um jogador atacando para desbloquear.
    const nowMs = Date.now();
    if (event && event.status === "open" && event.shieldActive && (event.shieldExpiresAt ?? 0) <= nowMs) {
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
        event.log.push(`🛡️ O escudo caiu sozinho! O boss conjurou ${mobs.length} criatura(s).`);
      } else {
        event.log.push(`🛡️ O escudo do boss caiu sozinho!`);
      }
      if (event.log.length > 30) event.log = event.log.slice(-30);
      await jsonDb.saveWorldBossEvent(event);
    }

    const squadsPublic = event
      ? event.squads.map((s) => ({
          id: s.id,
          leaderId: s.leaderId,
          inviteCount: s.invites.length,
          members: s.members
            .map((cid) => {
              const p = event.participants[cid];
              return p
                ? { characterId: p.characterId, name: p.name, level: p.level, classType: p.classType, damageDealt: p.damageDealt }
                : { characterId: cid, name: "?", level: 0, classType: "warrior", damageDealt: 0 };
            })
            .filter((m) => !!m.characterId),
        }))
      : [];

    const publicEvent = event
      ? {
          status: event.status,
          bossHp: event.bossHp,
          bossMaxHp: event.bossMaxHp,
          bossHpPct: event.bossMaxHp > 0 ? Math.max(0, Math.min(100, (event.bossHp / event.bossMaxHp) * 100)) : 0,
          phase: worldBossPhase(event.bossMaxHp > 0 ? event.bossHp / event.bossMaxHp : 1),
          totalDamage: event.totalDamage,
          participantsCount: Object.keys(event.participants).length,
          squads: squadsPublic,
          log: event.log.slice(-25),
          shield: {
            active: !!event.shieldActive,
            threshold: event.shieldThreshold ?? null,
            phaseAt: event.shieldPhaseAt ?? null,
            expiresInMs: event.shieldActive && event.shieldExpiresAt ? Math.max(0, event.shieldExpiresAt - Date.now()) : 0,
          },
          mobs: (event.mobs || [])
            .filter((m) => m.hp > 0)
            .map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, maxHp: m.maxHp })),
        }
      : null;

    let me = null;
    let mySquad = null;
    let myInvites: { squadId: string; leaderName: string; leaderLevel: number }[] = [];
    if (characterId && event) {
      me = event.participants[characterId] ?? null;
      mySquad = squadsPublic.find((s) => s.members.some((m) => m.characterId === characterId)) ?? null;
      myInvites = event.squads
        .filter((s) => s.invites.some((i) => i.targetId === characterId))
        .map((s) => {
          const leader = event.participants[s.leaderId];
          return {
            squadId: s.id,
            leaderName: leader?.name ?? "?",
            leaderLevel: leader?.level ?? 0,
          };
        });
    }

    return NextResponse.json({
      enabled: cfg.enabled,
      // Fechado se desativado, fora do horário OU boss derrotado (won).
      open: cfg.enabled && status.open && !won,
      won,
      startsAt: status.startsAt,
      endsAt: status.endsAt,
      nextOpening,
      closingInMs: status.closingInMs,
      schedule: status.schedule,
      durationMinutes: cfg.durationMinutes,
      // Relógio do servidor: o cliente usa para corrigir a contagem regressiva
      // e exibir os horários convertidos pro fuso local do jogador.
      serverTime: new Date().toISOString(),
      serverOffsetMinutes: -new Date().getTimezoneOffset(),
      boss: {
        kind: cfg.boss.kind,
        maxHp: cfg.boss.maxHp,
        attack: cfg.boss.attack,
        defense: cfg.boss.defense,
        speed: cfg.boss.speed,
        critical: cfg.boss.critical,
        maxHpLabel: fmtBig(cfg.boss.maxHp),
      },
      rewards: cfg.rewards,
      maxSquadSize: cfg.maxSquadSize,
      attackCooldownSec: cfg.attackCooldownSec,
      regenSec: cfg.regenSec,
      respawnSec: cfg.respawnSec,
      bossImage,
      shieldConfig: cfg.shield,
      spawnMobs: cfg.spawnMobs,
      event: publicEvent,
      me,
      mySquad,
      myInvites,
    });
  } catch (e) {
    console.error("World boss state error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
