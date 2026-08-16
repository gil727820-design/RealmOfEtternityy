import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { RECIPES, hasRecipeMaterials, recipeMaterialEntries } from "@/game/materials";
import { RPG_ITEMS } from "@/game/rpgItems.gen";

/**
 * CRAFT 🧪 — consome materiais (+ ouro) para criar um equipamento.
 *
 * O servidor valida: personagem autenticado → receita existe → tem os materiais
 * (por templateId no inventário) → tem o ouro. Só então consome e concede um
 * equipamento aleatório do catálogo com a raridade da receita.
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId, recipeId } = await req.json();
    if (!characterId || !recipeId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return NextResponse.json({ error: "Receita inválida" }, { status: 400 });

    const inventory = await jsonDb.getInventoryForCharacter(String(characterId));
    if (!hasRecipeMaterials(recipe.costs, inventory as any)) {
      return NextResponse.json({ error: "Materiais insuficientes" }, { status: 400 });
    }
    if ((char.gold || 0) < recipe.goldCost) {
      return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
    }

    // Escolhe um equipamento do catálogo com a raridade da receita.
    const pool = (RPG_ITEMS as any[]).filter((t) => t.rarity === recipe.resultRarity && t.slot);
    if (pool.length === 0) {
      return NextResponse.json({ error: "Nenhum item disponível para esta receita" }, { status: 400 });
    }
    const resultTemplate = pool[Math.floor(Math.random() * pool.length)];

    // Consome materiais (uma linha de inventário por material).
    const entries = recipeMaterialEntries(recipe.costs, inventory as any);
    for (const e of entries) {
      await jsonDb.decrementInventoryItem(e.itemId, e.amount);
    }
    // Consome o ouro.
    await jsonDb.updateCharacter(char.id, { gold: (char.gold || 0) - recipe.goldCost });

    // Concede o equipamento criado.
    const granted = await jsonDb.grantItem(char.id, resultTemplate.id, 1, false);

    return NextResponse.json({
      success: true,
      recipeId: recipe.id,
      crafted: granted,
      character: await jsonDb.findCharacterById(char.id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Craft error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Lista receitas + materiais disponíveis do personagem (para a UI). */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ recipes: RECIPES, materials: [] });
    }
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;

    const inventory = await jsonDb.getInventoryForCharacter(String(characterId));
    const materials = inventory
      .filter((e: any) => e.template?.type === "material" || e.template?.stackable === true)
      .map((e: any) => ({
        templateId: e.item.templateId,
        nameKey: e.template?.nameKey,
        icon: e.template?.icon,
        rarity: e.template?.rarity,
        quantity: e.item.quantity || 1,
      }));

    const recipes = RECIPES.map((r) => ({
      ...r,
      affordable: hasRecipeMaterials(r.costs, inventory as any) && (auth.char.gold || 0) >= r.goldCost,
    }));

    return NextResponse.json({ recipes, materials, gold: auth.char.gold || 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
