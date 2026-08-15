import jsonDb from "@/db/repo";
import {
  ensureWorldBossEvent,
  sanitizeWorldBossConfig,
  type WorldBossConfig,
  type WorldBossEventState,
  type WorldBossParticipant,
} from "@/game/worldBoss";
import type { NextRequest } from "next/server";
import { requireCharacterAuth } from "@/game/auth";
import { NextResponse } from "next/server";

/** Carrega config + estado do evento, resetando automaticamente se a janela mudou. */
export async function loadCtx(now = new Date()) {
  const settings = await jsonDb.getServerSettings();
  const cfg: WorldBossConfig = sanitizeWorldBossConfig(settings?.worldBoss);
  const saved = await jsonDb.getWorldBossEvent();
  const { status, event, reset } = ensureWorldBossEvent(cfg, saved, now);
  if (event && reset) await jsonDb.saveWorldBossEvent(event);
  return { cfg, status, event };
}

/** Cria o registro de participante de um personagem (HP cheio). */
export function participantFromChar(char: any): WorldBossParticipant {
  const maxHp = Math.max(1, Number(char.maxHp) || 100);
  return {
    characterId: char.id,
    name: String(char.name || "Player"),
    level: Number(char.level) || 1,
    classType: String(char.classType || "warrior"),
    damageDealt: 0,
    hits: 0,
    hp: maxHp,
    maxHp,
    lastAttackAt: 0,
    joinedAt: new Date().toISOString(),
  };
}

/** Exige sessão + janela aberta; devolve resposta de erro pronta se fechado. */
export async function requireOpenEvent(req: NextRequest, characterId: string, now = new Date()) {
  const auth = await requireCharacterAuth(req, characterId);
  if (!auth.ok) return { ok: false as const, auth: null as never, ctx: null as never, response: auth.response };
  const ctx = await loadCtx(now);
  if (!ctx.cfg.enabled || !ctx.status.open || !ctx.event) {
    return {
      ok: false as const,
      auth: null as never,
      ctx: null as never,
      response: NextResponse.json({ error: "O Evento Global não está acontecendo no momento." }, { status: 400 }),
    };
  }
  return { ok: true as const, auth, ctx, response: null as never };
}
