import { NextRequest, NextResponse } from "next/server";
import { loadCtx } from "./_state";
import { fmtBig } from "@/game/worldBoss";

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

    const bossImage = ""; // resolvido no cliente via towerMonsterImage(kind)

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
          totalDamage: event.totalDamage,
          participantsCount: Object.keys(event.participants).length,
          squads: squadsPublic,
          log: event.log.slice(-25),
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
      // Fechado se desativado OU fora do horário — desativar no admin esconde
      // o evento da sidebar dos jogadores na hora (status.open ignora enabled).
      open: cfg.enabled && status.open,
      startsAt: status.startsAt,
      endsAt: status.endsAt,
      nextOpening: status.nextOpening,
      closingInMs: status.closingInMs,
      schedule: status.schedule,
      durationMinutes: cfg.durationMinutes,
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
      bossImage,
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
