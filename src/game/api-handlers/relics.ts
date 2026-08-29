import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { RELICS } from "@/game/relics";

/** GET — relíquias do personagem (inventário) + equipada. */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const inventory = await jsonDb.getInventoryForCharacter(characterId);
    const relics = inventory
      .filter((e: any) => e.template?.relic === true || RELICS.some((r) => r.id === String(e.template?.nameKey) || r.id === String(e.template?.relicId)))
      .map((e: any) => {
        const def = RELICS.find((r) => r.id === String(e.template?.relicId) || r.id === String(e.template?.nameKey));
        return {
          itemId: e.item.id,
          equipped: !!e.item.equipped,
          quantity: e.item.quantity || 1,
          def: def || null,
        };
      });

    return NextResponse.json({ relics, activeRelicId: char.activeRelicId || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — equipar/desequipar relíquia. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, itemId, action } = await req.json();
    if (!characterId || !itemId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const entry = await jsonDb.getInventoryItemById(String(itemId));
    if (!entry || !entry.template) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }

    // Identifica a relíquia pela definição (relicId no template ou nameKey).
    const relicId = String(entry.template.relicId || entry.template.nameKey || "");
    const def = RELICS.find((r) => r.id === relicId);
    if (!def) {
      return NextResponse.json({ error: "Este item não é uma relíquia" }, { status: 400 });
    }

    if (action === "equip") {
      // Desequipa a atual e equipa a nova (slot único).
      const inv = await jsonDb.getInventoryForCharacter(String(characterId));
      for (const e of inv) {
        if (e.item.equipped && RELICS.some((r) => r.id === String(e.template?.relicId || e.template?.nameKey))) {
          await jsonDb.updateInventoryItem(String(e.item.id), { equipped: false });
        }
      }
      await jsonDb.updateInventoryItem(String(itemId), { equipped: true });
      await jsonDb.updateCharacter(char.id, { activeRelicId: def.id });
    } else if (action === "unequip") {
      await jsonDb.updateInventoryItem(String(itemId), { equipped: false });
      await jsonDb.updateCharacter(char.id, { activeRelicId: null });
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      activeRelicId: action === "equip" ? def.id : null,
      character: await jsonDb.findCharacterById(char.id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Relics error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
