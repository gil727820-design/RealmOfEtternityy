import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier } from "@/game/boosts";
import {
  DUNGEON_DAILY_CAP,
  DUNGEON_DURATIONS_SEC,
  computeDungeonRewards,
  dungeonCapFloor,
  dungeonDateKey,
  dungeonEnergyCost,
} from "@/game/dungeons";

export async function POST(req: NextRequest) {
  try {
    const { characterId, durationSec, attemptFloor } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    // Já há uma expedição em andamento? Rejeita (offline): só uma por vez.
    if (char.dungeonActive && char.dungeonActive.startedAt) {
      return NextResponse.json({ error: "Você já tem uma expedição em andamento!" }, { status: 400 });
    }

    // Valida a duração escolhida contra a lista permitida.
    const duration = DUNGEON_DURATIONS_SEC.find((d) => d.sec === Number(durationSec));
    if (!duration) {
      return NextResponse.json(
        { error: "Duração inválida. Escolha 2h, 4h ou 8h." },
        { status: 400 }
      );
    }
    const hours = duration.hours;

    // Custo de energia escala com a duração escolhida (2h=10, 4h=20, 8h=40).
    const cost = dungeonEnergyCost(hours);

    // Andar tentado dentro do teto permitido pelo nível.
    const cap = dungeonCapFloor(char.level || 1);
    const attempt = Math.max(1, Math.floor(Number(attemptFloor) || 1));
    if (attempt > cap) {
      return NextResponse.json(
        { error: `Você só pode tentar até o andar ${cap} no seu nível!` },
        { status: 400 }
      );
    }

    // Energia infinita ativa globalmente (config do admin) → sem custo de energia.
    const settings = await jsonDb.getServerSettings();
    const infiniteEnergy = !!settings?.infiniteEnergy;

    // Aplica a recarga passiva de energia antes de verificar/gastar.
    const regen = computeEnergyRegen(char, new Date(), energyMultiplier(char));
    if (!infiniteEnergy && regen.energy < cost) {
      return NextResponse.json(
        { error: `Energia insuficiente! Custo: ${cost} ⚡ (${hours}h).` },
        { status: 400 }
      );
    }

    // Limite diário (recurso escasso → mantém os drops competitivos).
    const stats = char.dungeonStats || {};
    const todayKey = dungeonDateKey();
    const usedToday = stats.lastDate === todayKey ? Number(stats.runsToday) || 0 : 0;
    if (usedToday >= DUNGEON_DAILY_CAP) {
      return NextResponse.json(
        { error: `Limite diário atingido (${DUNGEON_DAILY_CAP} masmorras/dia). Volte amanhã!` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Deduz energia (timer de recarga recomeça a partir deste momento).
    // Com energia infinita, a energia é mantida (nunca diminui).
    await jsonDb.updateCharacter(characterId, {
      energy: infiniteEnergy ? Math.max(regen.energy, char.maxEnergy || 100) : regen.energy - cost,
      lastEnergyAt: now.toISOString(),
      lastActivity: now.toISOString(),
    });

    // Registra a expedição ativa.
    await jsonDb.updateCharacter(characterId, {
      dungeonActive: {
        startedAt: now.toISOString(),
        durationSec: duration.sec,
        hours,
        attemptFloor: Math.max(1, attempt),
      },
    });

    // Prévia exibida ao usuário (poder é avaliado na coleta, mas mostra a esperada).
    const preview = computeDungeonRewards(char, attempt, hours);

    return NextResponse.json({
      success: true,
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + duration.sec * 1000).toISOString(),
      durationSec: duration.sec,
      hours,
      attemptFloor: Math.max(1, attempt),
      preview,
      message: "Expedição iniciada! Conclua em:",
    });
  } catch (e: unknown) {
    console.error("Dungeon start error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}