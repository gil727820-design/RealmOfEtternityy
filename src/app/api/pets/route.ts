import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  PET_DEFS,
  PET_RARITY_ORDER,
  PET_MAX_LEVEL,
  petById,
  petBuffAtLevel,
  petXpForLevel,
  petStars,
  petNextEvolutionLevel,
  getPets,
  addPetToCharacter,
} from "@/game/pets";

/** Detalhes completos de um pet para a UI (def + nível + buffs + evolução). */
function petDetail(char: any, def: any, level: number, xp: number) {
  const buffs = petBuffAtLevel(def, level);
  const nextLv = petNextEvolutionLevel(level);
  return {
    id: def.id,
    nameKey: def.nameKey,
    icon: def.icon,
    image: def.image,
    rarity: def.rarity,
    rarityIdx: PET_RARITY_ORDER.indexOf(def.rarity),
    desc: def.desc,
    level,
    xp,
    xpToNext: level >= PET_MAX_LEVEL ? 0 : petXpForLevel(level),
    stars: petStars(level),
    nextEvolutionLevel: nextLv,
    buffs,
  };
}

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const pets = getPets(char);
    const activeId = char.activePetId ? String(char.activePetId) : null;

    return NextResponse.json({
      activePetId: activeId,
      pets: pets.map((p) => {
        const def = petById(p.id);
        if (!def) return null;
        return petDetail(char, def, p.level, p.xp);
      }).filter(Boolean),
      catalog: PET_DEFS.map((def) => ({
        id: def.id,
        nameKey: def.nameKey,
        icon: def.icon,
        image: def.image,
        rarity: def.rarity,
        rarityIdx: PET_RARITY_ORDER.indexOf(def.rarity),
        desc: def.desc,
        owned: pets.some((p) => p.id === def.id),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action, petId } = body;
    if (!characterId || !petId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const def = petById(String(petId));
    if (!def) {
      return NextResponse.json({ error: "Pet não encontrado" }, { status: 404 });
    }

    // Só pode equipar/descartar pets que o personagem possui.
    const owned = getPets(char).some((p) => p.id === def.id);
    if (!owned) {
      return NextResponse.json({ error: "Você não possui este pet." }, { status: 400 });
    }

    if (action === "equip") {
      const updated = await jsonDb.updateCharacter(characterId, { activePetId: def.id });
      return NextResponse.json({ success: true, activePetId: def.id, character: updated });
    }

    if (action === "unequip") {
      const updated = await jsonDb.updateCharacter(characterId, { activePetId: null });
      return NextResponse.json({ success: true, activePetId: null, character: updated });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Rotina de nascimento: todo personagem novo ganha o pet inicial. */
export async function grantStarterPet(characterId: string, char: any) {
  if (!char) return;
  const has = getPets(char).some((p) => p.id === "lobo_sombrio");
  if (has) return;
  const pets = addPetToCharacter(char, "lobo_sombrio");
  await jsonDb.updateCharacter(characterId, {
    pets,
    activePetId: char.activePetId ? String(char.activePetId) : "lobo_sombrio",
  });
}
