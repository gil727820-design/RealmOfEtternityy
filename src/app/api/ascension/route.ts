import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  ASCENSION_MAX,
  ASCENSION_LEVEL_STEP,
  ascensionLevel,
  ascensionBuffs,
  ascendPatch,
  ascensionGoldCost,
  ascensionCrystalCost,
  ascensionNextLevel,
  ascensionNameKey,
} from "@/game/ascension";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const lv = ascensionLevel(char);
    const nextLevel = ascensionNextLevel(lv);

    return NextResponse.json({
      ascension: lv,
      max: ASCENSION_MAX,
      nameKey: ascensionNameKey(lv),
      level: char.level || 1,
      nextLevel,
      levelStep: ASCENSION_LEVEL_STEP,
      canAscend: nextLevel > 0 && (Number(char.level) || 1) >= nextLevel,
      maxed: lv >= ASCENSION_MAX,
      buffs: ascensionBuffs(char),
      nextCost: nextLevel > 0 ? { gold: ascensionGoldCost(lv), crystals: ascensionCrystalCost(lv) } : null,
      gold: char.gold || 0,
      crystals: char.crystals || 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId } = body;
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const result = ascendPatch(char);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const updated = await jsonDb.updateCharacter(String(characterId), result.patch);
    const newLv = ascensionLevel(updated);
    return NextResponse.json({
      success: true,
      message: `🌌 Ascensão ${newLv} alcançada!`,
      ascension: newLv,
      nameKey: ascensionNameKey(newLv),
      buffs: ascensionBuffs(updated),
      gold: updated.gold,
      crystals: updated.crystals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
