import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { dailyList, weeklyList, claimMission, weeklyAllDone, claimWeeklyBonus, weeklyBonusReward, type MissionKind } from "@/game/dailyMissions";
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

    const weeklyBonus = {
      done: weeklyAllDone(char),
      claimed: !!char.weeklyMissions?.bonusClaimed,
      reward: weeklyBonusReward(Number(char.level) || 1),
    };
    return NextResponse.json({
      daily: dailyList(char),
      weekly: weeklyList(char),
      weeklyBonus,
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
    // Bônus semanal (completou todas as semanais da semana).
    if (kind === "weekly_bonus") {
      const authB = await requireCharacterAuth(req, String(characterId));
      if (!authB.ok) return authB.response;
      const charB = authB.char;
      const resB = claimWeeklyBonus(charB);
      if (resB.error) return NextResponse.json({ error: resB.error }, { status: 400 });
      const rwB = resB.reward!;
      const patchB: Record<string, unknown> = {
        gold: (Number(charB.gold) || 0) + rwB.gold,
        diamonds: (Number(charB.diamonds) || 0) + rwB.diamonds,
        towerCoins: (Number(charB.towerCoins) || 0) + rwB.towerCoins,
        ...resB.patch,
        lastActivity: new Date().toISOString(),
      };
      const updatedB = await jsonDb.updateCharacter(String(characterId), patchB);
      return NextResponse.json({
        success: true,
        reward: rwB,
        character: updatedB,
        message: `🏆 Bônus semanal coletado: ${rwB.gold} 🪙, ${rwB.diamonds} 💎, ${rwB.towerCoins} 🗼`,
      });
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
