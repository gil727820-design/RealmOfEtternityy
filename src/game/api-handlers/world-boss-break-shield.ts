import { NextRequest, NextResponse } from "next/server";
import { requireOpenEvent } from "./world-boss-state";
import jsonDb from "@/db/repo";
import type { WorldBossMob } from "@/game/worldBoss";
import { randomUUID } from "@/game/worldBoss";

/**
 * Compra um quebra-escudo: remove o escudo do boss por um custo configurado
 * (ouro ou diamantes). Ao quebrar, o boss spawna uma leva de mobs.
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const open = await requireOpenEvent(req, characterId);
    if (!open.ok) return open.response;
    const { ctx, auth } = open;
    const { cfg, event } = ctx;
    if (!event) return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });

    if (event.status !== "open") {
      return NextResponse.json({ error: "O evento não está aberto." }, { status: 400 });
    }
    if (!event.shieldActive) {
      return NextResponse.json({ error: "O boss não está com escudo ativo." }, { status: 400 });
    }
    if (!cfg.shield.enabled) {
      return NextResponse.json({ error: "O escudo está desativado." }, { status: 400 });
    }

    const cost = cfg.shield.breakCost;
    const char = auth.char;
    const balance = cost.currency === "diamonds" ? Number(char.diamonds) || 0 : Number(char.gold) || 0;
    if (balance < cost.amount) {
      return NextResponse.json(
        {
          error: `Você precisa de ${cost.amount.toLocaleString("pt-BR")} ${cost.currency === "diamonds" ? "💎 diamantes" : "🪙 ouro"} para comprar o quebra-escudo.`,
          balance,
          cost,
        },
        { status: 400 }
      );
    }

    // Cobra o custo.
    if (cost.currency === "diamonds") {
      await jsonDb.updateCharacter(char.id, { diamonds: balance - cost.amount });
    } else {
      await jsonDb.updateCharacter(char.id, { gold: balance - cost.amount });
    }

    // Remove o escudo e spawna mobs.
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
          spawnedAt: new Date().toISOString(),
          rewardGiven: false,
        });
      }
      event.mobs = [...(event.mobs || []), ...mobs];
      event.mobsSpawnedAt = Date.now();
      event.log.push(`🔨 ${auth.char.name || "?"} quebrou o escudo com um QUEBRA-ESCUDO! O boss conjurou ${mobs.length} criatura(s).`);
    } else {
      event.log.push(`🔨 ${auth.char.name || "?"} quebrou o escudo do boss com um QUEBRA-ESCUDO!`);
    }

    event.shieldActive = false;
    event.shieldPhaseAt = null;
    event.shieldThreshold = undefined;
    event.shieldExpiresAt = undefined;
    if (event.log.length > 30) event.log = event.log.slice(-30);

    await jsonDb.saveWorldBossEvent(event);

    return NextResponse.json({
      success: true,
      message: `Escudo quebrado! O boss está vulnerável.`,
      shieldActive: false,
      bossHp: event.bossHp,
      bossMaxHp: event.bossMaxHp,
      mobs: (event.mobs || []).map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, maxHp: m.maxHp })),
      newBalance: cost.currency === "diamonds" ? balance - cost.amount : undefined,
      newGold: cost.currency === "gold" ? balance - cost.amount : undefined,
    });
  } catch (e: unknown) {
    console.error("World boss break-shield error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}