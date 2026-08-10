import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { REGIONS } from "@/game/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body.characterId;
    // Aceita tanto `region` (contrato antigo) quanto `regionId` (enviado pelo MapPanel)
    const regionId = body.region || body.regionId;

    if (!characterId || !regionId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) {
      return NextResponse.json({ error: "Região inexistente" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const level = typeof char.level === "number" ? char.level : 1;
    if (level < region.minLevel) {
      return NextResponse.json(
        { error: `Nível mínimo para esta ilha: Lv. ${region.minLevel}` },
        { status: 400 }
      );
    }

    await jsonDb.updateCharacter(characterId, { currentRegion: regionId });

    return NextResponse.json({ success: true, region: regionId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}