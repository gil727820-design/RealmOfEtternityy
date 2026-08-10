import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

const SHOP_ITEMS: Record<string, { price: number; currency: "gold"|"diamonds"; type: string; value: number; value2?: number; value3?: string }> = {
  // Baús
  common: { price: 500, currency: "gold", type: "chest", value: 2, value2: 2, value3: "uncommon" },
  uncommon: { price: 1000, currency: "gold", type: "chest", value: 3, value2: 3, value3: "rare" },
  rare: { price: 2000, currency: "gold", type: "chest", value: 3, value2: 4, value3: "epic" },
  epic: { price: 100, currency: "diamonds", type: "chest", value: 3, value2: 4, value3: "epic" },
  legendary: { price: 300, currency: "diamonds", type: "chest", value: 4, value2: 5, value3: "legendary" },
  mythic: { price: 600, currency: "diamonds", type: "chest", value: 4, value2: 6, value3: "mythic" },
  divine: { price: 1200, currency: "diamonds", type: "chest", value: 5, value2: 7, value3: "divine" },
  secret: { price: 2500, currency: "diamonds", type: "chest", value: 5, value2: 8, value3: "supreme" },
  // Poções
  vida: { price: 100, currency: "gold", type: "potion", value: 100 },
  mana: { price: 100, currency: "gold", type: "potion", value: 100 },
  energia: { price: 150, currency: "gold", type: "potion", value: 50 },
  forca: { price: 200, currency: "gold", type: "potion", value: 10 },
  velocidade: { price: 200, currency: "gold", type: "potion", value: 10 },
  vigor: { price: 250, currency: "gold", type: "potion", value: 20 },
  experiencia: { price: 300, currency: "diamonds", type: "potion", value: 50 },
  antidoto: { price: 150, currency: "gold", type: "potion", value: 50 },
  // VIP
  vip1: { price: 500, currency: "diamonds", type: "vip", value: 1, value2: 7 },
};

const RARITY_ORDER = ["common","uncommon","rare","epic","legendary","mythic","divine","ancestral","supreme"];

export async function POST(req: NextRequest) {
  try {
    const { characterId, itemId, costType, costValue } = await req.json();
    if (!characterId || !itemId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    
    const shopItem = SHOP_ITEMS[itemId];
    if (!shopItem) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    // Manutenção da loja (assim como a forja): baús, poções E VIP bloqueados.
    if (shopItem.type === "chest" || shopItem.type === "potion" || shopItem.type === "vip") {
      return NextResponse.json({ error: "Esta seção da loja está em manutenção" }, { status: 400 });
    }
    
    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    
    // Validação de saldo (server-side)
    if (shopItem.currency === "gold" && (char.gold || 0) < shopItem.price) {
      return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
    }
    if (shopItem.currency === "diamonds" && (char.diamonds || 0) < shopItem.price) {
      return NextResponse.json({ error: "Diamantes insuficientes" }, { status: 400 });
    }
    
    if (shopItem.currency === "gold") {
      await jsonDb.updateCharacter(characterId, { gold: (char.gold || 0) - shopItem.price });
    } else {
      await jsonDb.updateCharacter(characterId, { diamonds: (char.diamonds || 0) - shopItem.price });
    }
    
    if (shopItem.type === "chest") {
      const count = shopItem.value;
      const maxRarityIdx = Math.max(0, RARITY_ORDER.indexOf(shopItem.value3 ?? "rare"));
      const allItems = await jsonDb.getAllItemTemplates();
      const eligible = allItems.filter((it: any) => {
        const idx = RARITY_ORDER.indexOf(it.rarity || "common");
        return idx >= 0 && idx <= maxRarityIdx;
      });
      
      const rolled: Array<Record<string,unknown>> = [];
      for (let i = 0; i < count; i++) {
        if (eligible.length > 0) {
          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          // grantItem empilha consumíveis no inventário
          await jsonDb.grantItem(characterId, pick.id, 1);
          rolled.push(pick);
        }
      }
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({ success: true, type: "chest", items: rolled, character: updated });
    }
    
    if (shopItem.type === "potion") {
      // Poções principais passaram a ser itens de inventário (consumíveis empilháveis).
      // Se o template ainda não existir no banco (seed não rodado), mantém o efeito instantâneo antigo.
      const POTION_TEMPLATES: Record<string, string> = {
        vida: "item.hp_potion",
        mana: "item.mana_potion",
        energia: "item.energy_potion",
        experiencia: "item.elixir_xp",
      };
      const templateKey = POTION_TEMPLATES[itemId];
      const template = templateKey ? await jsonDb.getItemTemplateByNameKey(templateKey) : null;
      if (template) {
        await jsonDb.grantItem(characterId, template.id, 1);
        const updated = await jsonDb.findCharacterById(characterId);
        return NextResponse.json({ success: true, type: "potion", granted: template, character: updated });
      }

      if (itemId === "vida") {
        await jsonDb.updateCharacter(characterId, { hp: char.maxHp });
      } else if (itemId === "mana") {
        await jsonDb.updateCharacter(characterId, { mana: char.maxMana });
      } else if (itemId === "energia") {
        const newEnergy = Math.min(char.maxEnergy || 100, (char.energy || 0) + (shopItem.value || 0));
        await jsonDb.updateCharacter(characterId, { energy: newEnergy });
      } else if (itemId === "forca") {
        await jsonDb.updateCharacter(characterId, { strength: (char.strength || 0) + (shopItem.value || 0) });
      } else if (itemId === "velocidade") {
        await jsonDb.updateCharacter(characterId, { speed: (char.speed || 0) + (shopItem.value || 0) });
      } else if (itemId === "vigor") {
        await jsonDb.updateCharacter(characterId, { vitality: (char.vitality || 0) + (shopItem.value || 0) });
      } else if (itemId === "experiencia") {
        await jsonDb.updateCharacter(characterId, { xp: (char.xp || 0) + (shopItem.value || 0) });
      } else if (itemId === "antidoto") {
        await jsonDb.updateCharacter(characterId, { status: "normal" });
      }
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({ success: true, type: "potion", character: updated });
    }
    
    if (shopItem.type === "vip") {
      await jsonDb.updateCharacter(characterId, { vipLevel: shopItem.value });
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({ success: true, type: "vip", vipLevel: shopItem.value, duration: shopItem.value2, character: updated });
    }
    
    const updated = await jsonDb.findCharacterById(characterId);
    return NextResponse.json({ success: true, type: shopItem.type, character: updated });
  } catch (e: unknown) {
    console.error("Shop error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}