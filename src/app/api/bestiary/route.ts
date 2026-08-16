import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  bestiaryState,
  bestiaryProgress,
  bestiaryCategories,
  entriesForCategory,
  claimCategoryReward,
  BESTIARY_ENTRIES,
} from "@/game/bestiary";

/** GET — estado do bestiário do personagem (derrotados + recompensas). */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const st = bestiaryState(char);
    const progress = bestiaryProgress(char);
    const categories = bestiaryCategories().map((cat) => {
      const entries = entriesForCategory(cat);
      const defeatedCount = entries.filter((e) => (st.defeated[e.id] || 0) > 0).length;
      return {
        category: cat,
        total: entries.length,
        defeated: defeatedCount,
        complete: defeatedCount === entries.length,
        claimed: st.claimed.includes(cat),
        entries: entries.map((e) => ({
          id: e.id,
          nameKey: e.nameKey,
          icon: e.icon,
          image: e.image,
          tier: e.tier,
          kills: st.defeated[e.id] || 0,
          defeated: (st.defeated[e.id] || 0) > 0,
        })),
      };
    });

    return NextResponse.json({ progress, categories, totalEntries: BESTIARY_ENTRIES.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — coletar recompensa de categoria completa. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, category } = await req.json();
    if (!characterId || !category) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const res = claimCategoryReward(char, String(category));
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const updated = await jsonDb.updateCharacter(char.id, res.patch);
    return NextResponse.json({
      success: true,
      reward: res.reward,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Bestiary error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
