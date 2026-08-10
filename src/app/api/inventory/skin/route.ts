import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { skinById } from "@/game/skins";
import { skinBuffDesc } from "@/game/skinBuffs";

/**
 * Equipa / desequipa uma SKIN no personagem.
 *
 * - Só é possível equipar skin da PRÓPRIA classe do personagem.
 * - Skin equipada fica em `character.activeSkinId` e ativa o buff de combate
 *   daquela classe (assassino sangra, tanque tanka, paladino cura etc.).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = body?.characterId as string | undefined;
    const skinId = body?.skinId as string | undefined;
    const unequip = !!body?.unequip;

    if (!characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const owned: string[] = Array.isArray(char.skins) ? (char.skins as string[]) : [];

    // Desequipa
    if (unequip || !skinId) {
      const updated = await jsonDb.updateCharacter(characterId, { activeSkinId: null });
      return NextResponse.json({ success: true, equipped: false, character: updated });
    }

    // Valida a skin
    const skin = skinById(skinId);
    if (!skin) return NextResponse.json({ error: "Skin não encontrada" }, { status: 404 });
    if (!owned.includes(skinId)) {
      return NextResponse.json({ error: "Você não possui esta skin" }, { status: 403 });
    }
    if (skin.className !== char.classType) {
      return NextResponse.json({ error: "Esta skin é de outra classe" }, { status: 400 });
    }

    const updated = await jsonDb.updateCharacter(characterId, { activeSkinId: skinId });
    return NextResponse.json({
      success: true,
      equipped: true,
      skin: skin.id,
      buff: skinBuffDesc(skin.id, "pt"),
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}