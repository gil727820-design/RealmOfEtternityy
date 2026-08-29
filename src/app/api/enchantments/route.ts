import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { ENCHANTMENTS, getEnchantmentById, enchantmentCost, attemptEnchant } from "@/game/enchantments";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    let currentEnchantments: Record<string, number> = {};
    if (characterId) {
      const char = await jsonDb.findCharacterById(characterId);
      if (char) {
        currentEnchantments = (char.enchantments as Record<string, number>) || {};
      }
    }

    const items = ENCHANTMENTS.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      icon: e.icon,
      slot: e.slot,
      maxLevel: e.maxLevel,
      costPerLevel: e.costPerLevel,
      effects: e.effects,
      successChance: e.successChance,
      currentLevel: currentEnchantments[e.id] || 0,
    }));

    return NextResponse.json({ enchantments: items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, enchantmentId, targetLevel } = body;

    if (!characterId || !enchantmentId) {
      return NextResponse.json({ error: "characterId e enchantmentId obrigatorios" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const def = getEnchantmentById(enchantmentId);
    if (!def) {
      return NextResponse.json({ error: "Encantamento nao encontrado" }, { status: 404 });
    }

    const currentLevel = (char.enchantments as Record<string, number>)?.[enchantmentId] || 0;
    const level = Math.min(Number(targetLevel) || currentLevel + 1, def.maxLevel);

    if (level <= currentLevel) {
      return NextResponse.json({ error: "Nivel ja alcancado" }, { status: 400 });
    }

    const cost = enchantmentCost(def, level);
    const currentGold = char.gold || 0;
    const currentCrystals = char.crystals || 0;

    // Check infinite energy setting
    const settings = await jsonDb.getServerSettings();

    if (currentGold < cost.gold) {
      return NextResponse.json({ error: `Ouro insuficiente! Necessario: ${cost.gold.toLocaleString()} 💰` }, { status: 400 });
    }
    if (currentCrystals < cost.crystals) {
      return NextResponse.json({ error: `Cristais insuficientes! Necessario: ${cost.crystals} 🔮` }, { status: 400 });
    }

    // Attempt enchantment
    const result = attemptEnchant(def, currentLevel, level);

    // Deduct cost regardless of success
    const patch: any = {
      gold: currentGold - cost.gold,
      crystals: currentCrystals - cost.crystals,
    };

    if (result.success) {
      const enchantments = { ...(char.enchantments as Record<string, number> || {}), [enchantmentId]: result.newLevel };
      patch.enchantments = enchantments;
    }

    await jsonDb.updateCharacter(characterId, patch);
    const updated = await jsonDb.findCharacterById(characterId);

    const effect = def.effects.find((e) => e.level === result.newLevel);

    return NextResponse.json({
      success: result.success,
      previousLevel: currentLevel,
      newLevel: result.newLevel,
      cost,
      effect: effect?.label || null,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
