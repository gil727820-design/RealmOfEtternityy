import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  SPECIALIZATIONS,
  specsForClass,
  activeSpecialization,
  SPEC_CHANGE_COST,
  SPEC_MIN_LEVEL,
} from "@/game/specializations";

/** GET — especializações da classe do personagem + a atual. */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const cls = (char.classType as string) || "warrior";
    return NextResponse.json({
      classType: cls,
      specs: specsForClass(cls),
      active: activeSpecialization(char),
      changeCost: SPEC_CHANGE_COST,
      minLevel: SPEC_MIN_LEVEL,
      gold: char.gold || 0,
      level: char.level || 1,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — escolher/trocar de especialização (nível mínimo + ouro). */
export async function POST(req: NextRequest) {
  try {
    const { characterId, specId } = await req.json();
    if (!characterId || !specId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const def = SPECIALIZATIONS.find((s) => s.id === specId);
    if (!def) return NextResponse.json({ error: "Especialização inválida" }, { status: 400 });
    if (def.cls !== (char.classType || "warrior")) {
      return NextResponse.json({ error: "Esta especialização não pertence à sua classe" }, { status: 400 });
    }

    const current = activeSpecialization(char);
    // Primeira escolha é grátis; troca custa ouro + nível mínimo.
    if (current && current.id !== def.id) {
      if ((char.level || 1) < SPEC_MIN_LEVEL) {
        return NextResponse.json({ error: `Requer nível ${SPEC_MIN_LEVEL}+ para trocar de especialização` }, { status: 400 });
      }
      if ((char.gold || 0) < SPEC_CHANGE_COST) {
        return NextResponse.json({ error: `Ouro insuficiente (${SPEC_CHANGE_COST.toLocaleString()} 🪙)` }, { status: 400 });
      }
      await jsonDb.updateCharacter(char.id, {
        gold: (char.gold || 0) - SPEC_CHANGE_COST,
        specialization: { id: def.id, chosenAt: new Date().toISOString() },
      });
    } else if (!current) {
      await jsonDb.updateCharacter(char.id, {
        specialization: { id: def.id, chosenAt: new Date().toISOString() },
      });
    } else {
      return NextResponse.json({ error: "Você já está nesta especialização" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      specialization: def,
      character: await jsonDb.findCharacterById(char.id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Specialization error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
