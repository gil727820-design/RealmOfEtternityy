import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { MAX_ENHANCE, ENCHANT_POOL, enhanceCost, enhanceChance } from "@/game/forge";

export async function POST(req: NextRequest) {
  try {
    const { action, characterId, itemId } = await req.json();
    if (!characterId || !itemId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(String(characterId));
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const entry = await jsonDb.getInventoryItemById(String(itemId));
    if (!entry || !entry.template) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }

    const template = entry.template;
    const item = entry.item;
    if (template.type === "consumable" || !template.slot) {
      return NextResponse.json({ error: "Apenas itens de equipamento podem ser forjados" }, { status: 400 });
    }

    const currentGold = char.gold || 0;

    // ---- APRIMORAR (+1 nível) ----
    if (action === "enhance") {
      const level = item.enhanceLevel || 0;
      if (level >= MAX_ENHANCE) {
        return NextResponse.json({ error: "Este item já atingiu +20" }, { status: 400 });
      }
      if (item.enchant) {
        return NextResponse.json({ error: "Itens encantados não podem ser aprimorados novamente" }, { status: 400 });
      }
      const cost = enhanceCost(level);
      if (currentGold < cost) {
        return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
      }
      const chance = enhanceChance(level);
      const success = Math.random() * 100 < chance;

      // Consome o ouro sempre que a tentativa é feita
      await jsonDb.updateCharacter(char.id, { gold: currentGold - cost });

      let newLevel = level;
      if (success) {
        newLevel = level + 1;
        await jsonDb.updateInventoryItem(String(itemId), { enhanceLevel: newLevel });
      }

      return NextResponse.json({
        success: true,
        enhanced: success,
        newLevel,
        cost,
        chance,
        character: await jsonDb.findCharacterById(char.id),
        item: await jsonDb.getInventoryItemById(String(itemId)),
      });
    }

    // ---- ENCANTAR (aplica um encantamento aleatório) ----
    if (action === "enchant") {
      if (item.enchant) {
        return NextResponse.json({ error: "Este item já está encantado" }, { status: 400 });
      }
      const cost = 3000;
      if (currentGold < cost) {
        return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
      }
      const roll = ENCHANT_POOL[Math.floor(Math.random() * ENCHANT_POOL.length)];
      await jsonDb.updateCharacter(char.id, { gold: currentGold - cost });
      await jsonDb.updateInventoryItem(String(item.id), { enchant: roll.id });

      return NextResponse.json({
        success: true,
        enchanted: roll,
        cost,
        character: await jsonDb.findCharacterById(char.id),
        item: await jsonDb.getInventoryItemById(String(item.id)),
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Forge error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}