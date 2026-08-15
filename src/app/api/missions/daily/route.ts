import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { dailyList, weeklyList, claimMission, type MissionKind } from "@/game/dailyMissions";
import { requireCharacterAuth } from "@/game/auth";

/** Lista as missões diárias + semanais com progresso. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    return NextResponse.json({
      daily: dailyList(char),
      weekly: weeklyList(char),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Coleta a recompensa de uma missão diária ou semanal. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, kind, list } = body;
    if (!characterId || !kind) {
      return NextResponse.json({ error: "Dados necessários" }, { status: 400 });
    }
    if (list !== "daily" && list !== "weekly") {
      return NextResponse.json({ error: "Lista inválida" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const res = claimMission(char, kind as MissionKind, list);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

    // Aplica a recompensa (ouro, cristais, moedas da torre) e persiste o progresso.
    const rw = res.reward!;
    const patch: Record<string, unknown> = {
      gold: (Number(char.gold) || 0) + rw.gold,
      crystals: (Number(char.crystals) || 0) + rw.crystals,
      towerCoins: (Number(char.towerCoins) || 0) + rw.towerCoins,
      ...res.patch,
      lastActivity: new Date().toISOString(),
    };
    const updated = await jsonDb.updateCharacter(String(characterId), patch);

    return NextResponse.json({
      success: true,
      reward: rw,
      character: updated,
      message: `🎁 Recompensa coletada: ${rw.gold} 🪙, ${rw.crystals} 🔮, ${rw.towerCoins} 🗼`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
