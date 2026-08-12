import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";

// Soma os bônus de todos os itens equipados em uma lista do inventário (forja + encanto).
function sumEquippedBonuses(entries: any[]) {
  const total = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
  for (const e of entries) {
    if (e.template?.type === "consumable") continue; // consumíveis nunca dão bônus passivos
    const b = equipmentBonus(e.template, e.item);
    total.attack += b.attack;
    total.defense += b.defense;
    total.maxHp += b.maxHp;
    total.speed += b.speed;
    total.critical += b.critical;
  }
  return total;
}

/** Valida requisitos do template contra o personagem (nível e classe). */
function requirementsOk(char: any, template: any): { ok: boolean; reason?: string } {
  if ((template?.minLevel || 1) > (char?.level || 1)) {
    return { ok: false, reason: "Requer nível " + template.minLevel };
  }
  if (template?.classReq && template.classReq !== char?.classType) {
    return { ok: false, reason: "Apenas para " + template.classReq };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemId = body.inventoryItemId ?? body.itemId;
    const characterId = body.characterId;
    const unequip = !!body.unequip;
    if (!itemId || !characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const entry = await jsonDb.getInventoryItemById(itemId);
    if (!entry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }

    const template = entry.template || {};
    if (template.type === "consumable") {
      return NextResponse.json({ error: "Este item não pode ser equipado" }, { status: 400 });
    }
    if (!template.slot) {
      return NextResponse.json({ error: "Este item não possui slot de equipamento" }, { status: 400 });
    }

    // Bônus dos itens equipados ANTES desta mudança (para preservar os status investidos).
    const oldInv = await jsonDb.getInventoryForCharacter(characterId);
    const oldEquipped = oldInv.filter((e: any) => e.item.equipped);
    const oldBonus = sumEquippedBonuses(oldEquipped);

    if (unequip) {
      await jsonDb.updateInventoryItem(itemId, { equipped: false });
    } else {
      // Validação de requisitos no servidor (nível + classe)
      const check = requirementsOk(char, template);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }
      // Já está equipado? nada a fazer
      if (entry.item.equipped) {
        return NextResponse.json({ success: true, equipped: true, character: char });
      }
      // Desequipa qualquer outro item já equipado no mesmo slot
      const sameSlot = oldInv.filter(
        (e: any) => e.item.equipped && e.template?.slot === template.slot && e.item.id !== itemId
      );
      for (const s of sameSlot) {
        await jsonDb.updateInventoryItem(s.item.id, { equipped: false });
      }
      await jsonDb.updateInventoryItem(itemId, { equipped: true });
    }

    // Bônus dos itens equipados DEPOIS da mudança.
    const freshInv = await jsonDb.getInventoryForCharacter(characterId);
    const newBonus = sumEquippedBonuses(freshInv.filter((e: any) => e.item.equipped));

    // Base real = status atuais MENOS os bônus que estavam equipados antes da mudança.
    // Assim os pontos investidos (alocação de status, reset de atributos, level up,
    // edição pelo admin) NUNCA são perdidos nem sobrescritos ao equipar/trocar itens.
    const base = {
      attack: Math.max(0, (Number(char.attack) || 0) - oldBonus.attack),
      defense: Math.max(0, (Number(char.defense) || 0) - oldBonus.defense),
      maxHp: Math.max(0, (Number(char.maxHp) || 0) - oldBonus.maxHp),
      speed: Math.max(0, (Number(char.speed) || 0) - oldBonus.speed),
      critical: Math.max(0, (Number(char.critical) || 0) - oldBonus.critical),
    };

    const totalAttack = base.attack + newBonus.attack;
    const totalDefense = base.defense + newBonus.defense;
    const totalMaxHp = base.maxHp + newBonus.maxHp;
    const totalSpeed = base.speed + newBonus.speed;
    const totalCritical = base.critical + newBonus.critical;

    const power = powerCalc({
      attack: totalAttack,
      defense: totalDefense,
      hp: totalMaxHp,
      speed: totalSpeed,
      critical: totalCritical,
      level: char.level || 1,
    });

    const updated = await jsonDb.updateCharacter(characterId, {
      baseStats: base,
      attack: totalAttack,
      defense: totalDefense,
      maxHp: totalMaxHp,
      hp: Math.min(char.hp ?? totalMaxHp, totalMaxHp),
      speed: totalSpeed,
      critical: totalCritical,
      power,
    });

    return NextResponse.json({
      success: true,
      equipped: unequip ? false : true,
      character: updated,
      inventory: freshInv,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}