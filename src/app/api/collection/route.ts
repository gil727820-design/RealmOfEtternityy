import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { collectionProgress, collectionBonus, claimCollectionReward } from "@/game/collection";

/** GET — progresso da coleção (total, por categoria, bônus passivo). */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const templates = await jsonDb.getAllItemTemplates();
    const progress = collectionProgress(char, templates);
    const bonus = collectionBonus(char, templates);

    // Atualiza o snapshot do bônus no personagem (aplicado em boosts.ts).
    if (char.collectionBonus?.xpPct !== bonus.xpPct || char.collectionBonus?.goldPct !== bonus.goldPct) {
      await jsonDb.updateCharacter(char.id, { collectionBonus: { xpPct: bonus.xpPct, goldPct: bonus.goldPct } });
    }

    return NextResponse.json({ progress, bonus });
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

    const templates = await jsonDb.getAllItemTemplates();
    const res = claimCollectionReward(char, templates, String(category));
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    // Recalcula e grava o novo snapshot do bônus (novas categorias completas).
    const newTemplates = await jsonDb.getAllItemTemplates();
    const newBonus = collectionBonus({ ...char, ...res.patch }, newTemplates);
    const updated = await jsonDb.updateCharacter(char.id, {
      ...res.patch,
      collectionBonus: { xpPct: newBonus.xpPct, goldPct: newBonus.goldPct },
    });
    return NextResponse.json({
      success: true,
      reward: res.reward,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Collection error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
