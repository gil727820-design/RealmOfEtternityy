import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";

// Estatísticas-base usadas para calcular os bônus de equipamento.
// Se o personagem nunca guardou baseStats (personagens antigos), usa os valores atuais
// do save — que neste sistema ainda não tinham sido modificados por equipamento.
function resolveBase(char: any) {
  if (char.baseStats) return char.baseStats;
  return {
    attack: char.attack || 0,
    defense: char.defense || 0,
    maxHp: char.maxHp || char.hp || 0,
    speed: char.speed || 0,
    critical: char.critical || 0,
  };
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
      const inventory = await jsonDb.getInventoryForCharacter(characterId);
      const sameSlot = inventory.filter(
        (e: any) => e.item.equipped && e.template?.slot === template.slot && e.item.id !== itemId
      );
      for (const s of sameSlot) {
        await jsonDb.updateInventoryItem(s.item.id, { equipped: false });
      }
      await jsonDb.updateInventoryItem(itemId, { equipped: true });
    }

    // Recalcula bônus de todos os itens equipados após a mudança
    // (considerando APRIMORAMENTO da forja e ENCANTAMENTO).
    const freshInv = await jsonDb.getInventoryForCharacter(characterId);
    const equipped = freshInv.filter((e: any) => e.item.equipped);
    let bonusAtk = 0, bonusDef = 0, bonusHp = 0, bonusSpd = 0, bonusCrit = 0;
    for (const e of equipped) {
      if (e.template?.type === "consumable") continue; // consumíveis nunca dão bônus passivos
      const b = equipmentBonus(e.template, e.item);
      bonusAtk += b.attack;
      bonusDef += b.defense;
      bonusHp += b.maxHp;
      bonusSpd += b.speed;
      bonusCrit += b.critical;
    }

    const base = resolveBase(char);
    const totalAttack = base.attack + bonusAtk;
    const totalDefense = base.defense + bonusDef;
    const totalMaxHp = base.maxHp + bonusHp;
    const totalSpeed = base.speed + bonusSpd;
    const totalCritical = base.critical + bonusCrit;

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