import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";
import { requireCharacterAuth } from "@/game/auth";

/** Soma os bônus de todos os itens equipados em uma lista do inventário. */
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

/** Peso de um bônus para comparar itens (mesma fórmula do poder). */
function bonusPower(b: Record<string, number>) {
  return (b.attack || 0) * 2 + (b.defense || 0) * 1.5 + (b.maxHp || 0) * 0.5 + (b.speed || 0) * 1.2 + (b.critical || 0) * 1.8;
}

/** Valida requisitos do template contra o personagem. */
function requirementsOk(char: any, template: any) {
  if ((template?.minLevel || 1) > (char?.level || 1)) return false;
  if (template?.classReq && template.classReq !== char?.classType) return false;
  return true;
}

/**
 * Equipa AUTOMATICAMENTE o melhor item de cada slot (por bônus de forja).
 * - Pula itens listados no mercado ou reservados em troca.
 * - Respeita requisitos (nível/classe).
 * - Recalcula os atributos uma única vez no final (preservando baseStats).
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const inv = await jsonDb.getInventoryForCharacter(String(characterId));
    const oldBonus = sumEquippedBonuses(inv.filter((e: any) => e.item?.equipped));

    // Agrupa por slot os itens disponíveis (não equipados, não listados/reservados).
    const bySlot = new Map<string, any[]>();
    for (const e of inv) {
      const it = e.item;
      const tpl = e.template || {};
      if (tpl.type === "consumable" || !tpl.slot) continue;
      if (it.equipped || it.listed || it.reservedFor) continue;
      if (!requirementsOk(char, tpl)) continue;
      const arr = bySlot.get(tpl.slot) || [];
      arr.push(e);
      bySlot.set(tpl.slot, arr);
    }

    // Escolhe o melhor item de cada slot (maior bônus de forja).
    let changed = 0;
    for (const [slot, items] of bySlot) {
      let best: any = null;
      let bestScore = -1;
      for (const e of items) {
        const b = equipmentBonus(e.template, e.item);
        const score = bonusPower(b);
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      if (!best) continue;

      const currentlyEquipped = inv.filter(
        (e: any) => e.item?.equipped && e.template?.slot === slot && e.item.id !== best.item.id
      );
      const alreadyBest = currentlyEquipped.some((e: any) => {
        const b = equipmentBonus(e.template, e.item);
        return bonusPower(b) >= bestScore;
      });
      if (alreadyBest) continue;

      for (const s of currentlyEquipped) {
        await jsonDb.updateInventoryItem(s.item.id, { equipped: false });
      }
      await jsonDb.updateInventoryItem(best.item.id, { equipped: true });
      changed++;
    }

    if (changed === 0) {
      return NextResponse.json({
        success: true,
        changed: 0,
        character: char,
        message: "⚔️ Seu equipamento já está no melhor estado!",
      });
    }

    // Recalcula os atributos uma única vez (base = atual - bônus antigo).
    const freshInv = await jsonDb.getInventoryForCharacter(String(characterId));
    const newBonus = sumEquippedBonuses(freshInv.filter((e: any) => e.item?.equipped));
    const base = {
      attack: Math.max(0, (Number(char.attack) || 0) - oldBonus.attack),
      defense: Math.max(0, (Number(char.defense) || 0) - oldBonus.defense),
      maxHp: Math.max(0, (Number(char.maxHp) || 0) - oldBonus.maxHp),
      speed: Math.max(0, (Number(char.speed) || 0) - oldBonus.speed),
      critical: Math.max(0, (Number(char.critical) || 0) - oldBonus.critical),
    };
    const attack = base.attack + newBonus.attack;
    const defense = base.defense + newBonus.defense;
    const maxHp = base.maxHp + newBonus.maxHp;
    const speed = base.speed + newBonus.speed;
    const critical = base.critical + newBonus.critical;

    const updated = await jsonDb.updateCharacter(String(characterId), {
      baseStats: base,
      attack,
      defense,
      maxHp,
      hp: Math.min(Number(char.hp) || maxHp, maxHp),
      speed,
      critical,
      power: powerCalc({ attack, defense, hp: maxHp, speed, critical, level: Number(char.level) || 1 }),
    });

    return NextResponse.json({
      success: true,
      changed,
      character: updated,
      inventory: freshInv,
      message: `⚔️ ${changed} item(ns) equipado(s) automaticamente!`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
