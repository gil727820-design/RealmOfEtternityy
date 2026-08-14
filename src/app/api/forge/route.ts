import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { MAX_ENHANCE, ENCHANT_POOL, enhanceCost, enhanceChance, equipmentBonus } from "@/game/forge";
import { powerCalc } from "@/game/constants";

/** Soma os bônus de todos os itens equipados (forja + encanto). */
function sumEquippedBonuses(entries: any[]) {
  const total = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
  for (const e of entries) {
    if (e.template?.type === "consumable") continue;
    const b = equipmentBonus(e.template, e.item);
    total.attack += b.attack;
    total.defense += b.defense;
    total.maxHp += b.maxHp;
    total.speed += b.speed;
    total.critical += b.critical;
  }
  return total;
}

/**
 * Recalcula os atributos do personagem a partir dos itens equipados.
 * Preserva os pontos investidos (baseStats) e soma os bônus atuais.
 * Chamado após aprimorar/encantar um item que está equipado.
 * @param prevBonus Bônus do item ANTES da forja.
 * @param newItemBonus Bônus do item APÓS a forja (como está no inventário agora).
 */
async function recalcFromEquipped(
  characterId: string,
  prevBonus: Record<string, number> = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 },
  newItemBonus: Record<string, number> = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 }
) {
  const char = await jsonDb.findCharacterById(characterId);
  if (!char) return null;

  const inv = await jsonDb.getInventoryForCharacter(characterId);
  const bonus = sumEquippedBonuses(inv.filter((e: any) => e.item?.equipped));

  // Bônus que o personagem reflete hoje = total novo - (novo item) + (item antigo).
  const currentBonus = {
    attack: bonus.attack - newItemBonus.attack + prevBonus.attack,
    defense: bonus.defense - newItemBonus.defense + prevBonus.defense,
    maxHp: bonus.maxHp - newItemBonus.maxHp + prevBonus.maxHp,
    speed: bonus.speed - newItemBonus.speed + prevBonus.speed,
    critical: bonus.critical - newItemBonus.critical + prevBonus.critical,
  };

  // Base real (pontos investidos) = total atual - bônus atualmente refletido.
  const base = {
    attack: Math.max(0, (Number(char.attack) || 0) - currentBonus.attack),
    defense: Math.max(0, (Number(char.defense) || 0) - currentBonus.defense),
    maxHp: Math.max(0, (Number(char.maxHp) || 0) - currentBonus.maxHp),
    speed: Math.max(0, (Number(char.speed) || 0) - currentBonus.speed),
    critical: Math.max(0, (Number(char.critical) || 0) - currentBonus.critical),
  };

  const attack = base.attack + bonus.attack;
  const defense = base.defense + bonus.defense;
  const maxHp = base.maxHp + bonus.maxHp;
  const speed = base.speed + bonus.speed;
  const critical = base.critical + bonus.critical;

  return jsonDb.updateCharacter(characterId, {
    attack,
    defense,
    maxHp,
    hp: Math.min(Number(char.hp) || maxHp, maxHp),
    speed,
    critical,
    power: powerCalc({ attack, defense, hp: maxHp, speed, critical, level: char.level || 1 }),
    lastActivity: new Date().toISOString(),
  });
}

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

      // Se o item está equipado, recalcula os atributos do personagem.
      let updatedChar = char;
      if (item.equipped) {
        updatedChar = (await recalcFromEquipped(
          char.id,
          equipmentBonus(template, { ...item, enhanceLevel: level }),
          equipmentBonus(template, { ...item, enhanceLevel: newLevel })
        )) ?? char;
      }

      return NextResponse.json({
        success: true,
        enhanced: success,
        newLevel,
        cost,
        chance,
        character: updatedChar,
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

      // Se o item está equipado, recalcula os atributos do personagem.
      let updatedCharEnchant = char;
      if (item.equipped) {
        updatedCharEnchant = (await recalcFromEquipped(
          char.id,
          equipmentBonus(template, { ...item, enchant: undefined }),
          equipmentBonus(template, { ...item, enchant: roll.id })
        )) ?? char;
      }

      return NextResponse.json({
        success: true,
        enchanted: roll,
        cost,
        character: updatedCharEnchant,
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