import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { REFINEMENT_LEVELS, REFINEMENT_MATERIALS, getRefinementLevel, refinementCost, attemptRefine } from "@/game/refinement";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    let materials: Record<string, number> = {};
    let refinedItems: Record<string, number> = {};
    if (characterId) {
      const char = await jsonDb.findCharacterById(characterId);
      if (char) {
        materials = (char.refinementMaterials as Record<string, number>) || {};
        refinedItems = (char.refinedItems as Record<string, number>) || {};
      }
    }

    return NextResponse.json({
      materials: REFINEMENT_MATERIALS.map((m) => ({
        ...m,
        count: materials[m.id] || 0,
      })),
      levels: REFINEMENT_LEVELS,
      refinedItems,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action, itemId, targetLevel } = body;

    if (!characterId) {
      return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    if (action === "refine") {
      if (!itemId || !targetLevel) {
        return NextResponse.json({ error: "itemId e targetLevel obrigatorios" }, { status: 400 });
      }

      const level = Number(targetLevel);
      if (level < 1 || level > 10) {
        return NextResponse.json({ error: "Nivel invalido (1-10)" }, { status: 400 });
      }

      const def = getRefinementLevel(level);
      if (!def) {
        return NextResponse.json({ error: "Nivel de refinamento nao encontrado" }, { status: 400 });
      }

      const refinedItems = (char.refinedItems as Record<string, number>) || {};
      const currentLevel = refinedItems[itemId] || 0;

      if (level <= currentLevel) {
        return NextResponse.json({ error: "Nivel ja alcancado" }, { status: 400 });
      }

      // Check materials
      const materials = (char.refinementMaterials as Record<string, number>) || {};
      for (const m of def.materials) {
        if ((materials[m.id] || 0) < m.count) {
          return NextResponse.json({ error: `Material insuficiente: ${m.id} (${materials[m.id] || 0}/${m.count})` }, { status: 400 });
        }
      }

      if ((char.gold || 0) < def.goldCost) {
        return NextResponse.json({ error: `Ouro insuficiente! Necessario: ${def.goldCost.toLocaleString()} 💰` }, { status: 400 });
      }

      // Deduct materials and gold
      const patch: any = {
        gold: (char.gold || 0) - def.goldCost,
        refinementMaterials: { ...materials },
      };

      for (const m of def.materials) {
        patch.refinementMaterials[m.id] = (patch.refinementMaterials[m.id] || 0) - m.count;
      }

      // Attempt refinement
      const result = attemptRefine(currentLevel, level);

      if (result.success) {
        patch.refinedItems = { ...refinedItems, [itemId]: result.newLevel };
      } else {
        // Fail penalty - reduce level
        if (def.failPenalty > 0 && currentLevel > 0) {
          patch.refinedItems = { ...refinedItems, [itemId]: result.newLevel };
        }
      }

      await jsonDb.updateCharacter(characterId, patch);
      const updated = await jsonDb.findCharacterById(char.id);

      const effect = result.success ? `+${def.statBonus}% stats` : (def.failPenalty > 0 ? `Perdeu ${def.failPenalty} nivel(is)` : "Sem penalidade");

      return NextResponse.json({
        success: result.success,
        previousLevel: currentLevel,
        newLevel: result.newLevel,
        effect,
        character: updated,
      });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
