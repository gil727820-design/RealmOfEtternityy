import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  ADVANCED_CLASSES,
  ADVANCED_MIN_LEVEL,
  activeAdvancedClass,
  advancedClassForClass,
  evolveAdvancedClass,
} from "@/game/advancedClasses";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const cls = String(char.classType || "warrior");
    const def = advancedClassForClass(cls);
    const current = activeAdvancedClass(char);

    return NextResponse.json({
      classType: cls,
      level: char.level || 1,
      minLevel: ADVANCED_MIN_LEVEL,
      canEvolve: (Number(char.level) || 0) >= (def?.minLevel ?? ADVANCED_MIN_LEVEL),
      definition: def
        ? {
            ...def,
            locked: !current,
            unlocked: !!current,
          }
        : null,
      current,
      catalog: ADVANCED_CLASSES.map((a) => ({
        ...a,
        mine: current?.id === a.id,
      })),
      gold: char.gold || 0,
      diamonds: char.diamonds || 0,
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

    if (activeAdvancedClass(char)) {
      return NextResponse.json({ error: "Sua classe já foi evoluída" }, { status: 400 });
    }

    const result = evolveAdvancedClass(char);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const updated = await jsonDb.updateCharacter(String(characterId), result.patch);
    const def = activeAdvancedClass(updated);
    return NextResponse.json({
      success: true,
      message: `🌟 Classe evoluída para ${def?.nameKey || "?"}!`,
      advancedClass: def,
      gold: updated.gold,
      diamonds: updated.diamonds,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
