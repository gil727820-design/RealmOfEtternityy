import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { applyBoostPatch, xpMultiplier, energyMultiplier, type Boosts } from "@/game/boosts";
import { xpForLevel, resolveMaxLevel } from "@/game/constants";
import { effectiveMaxEnergy } from "@/game/energy";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Usa um item consumível (ex.: poções). Efeitos em `template.effect`:
 * { hp, mana, energy, xp } — aplicados ao personagem; também suporta boosts
 * { boostXpHours, boostEnergyHours } que concedem 2x XP / 2x Energia.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemId = body.inventoryItemId ?? body.itemId;
    const characterId = body.characterId;
    if (!itemId || !characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode usar itens do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Nível máximo configurado no painel admin (0 = padrão 999).
    const settings = await jsonDb.getServerSettings();
    const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);

    const entry = await jsonDb.getInventoryItemById(itemId);
    if (!entry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (entry.item.characterId !== characterId) {
      return NextResponse.json({ error: "Item não pertence a este personagem" }, { status: 403 });
    }
    if (entry.item.equipped) {
      return NextResponse.json({ error: "Item equipado não pode ser usado." }, { status: 400 });
    }
    if (entry.item.listed) {
      return NextResponse.json({ error: "Cancele o anúncio no mercado antes de usar." }, { status: 400 });
    }
    if (entry.item.reservedFor) {
      return NextResponse.json({ error: "Este item está reservado em uma troca pendente." }, { status: 400 });
    }

    const template = entry.template || {};
    if (template.type !== "consumable") {
      return NextResponse.json({ error: "Este item não é consumível." }, { status: 400 });
    }
    const effect = template.effect || {};
    const hasEffect = Object.entries(effect).some(
      ([k, v]) => ["hp", "mana", "energy", "xp", "boostXpHours", "boostEnergyHours"].includes(k) && Number(v) > 0
    );
    if (!hasEffect) {
      return NextResponse.json({ error: "Este item não possui efeito definido." }, { status: 400 });
    }

    // Bloqueia o uso se a manutenção/evento etc. — mantido simples: segue normal.
    const maxHp = char.maxHp || char.hp || 1;
    const maxMana = char.maxMana || char.mana || 1;
    const maxEnergy = effectiveMaxEnergy(char);

    const hp = char.hp ?? 0;
    const mana = char.mana ?? 0;
    const energy = char.energy ?? 0;
    let xp = char.xp ?? 0;
    let level = char.level ?? 1;
    let xpToNext = char.xpToNext ?? xpForLevel(level);

    // Boost ativo do personagem amplia efeitos de XP e Energia (2x).
    const multXp = xpMultiplier(char);
    const multEnergy = energyMultiplier(char);

    const newHp = Math.min(maxHp, hp + Number(effect.hp || 0));
    const newMana = Math.min(maxMana, mana + Number(effect.mana || 0));
    const newEnergy = Math.min(maxEnergy, energy + Number(effect.energy || 0) * multEnergy);
    const newXp = xp + Number(effect.xp || 0) * multXp;

    // Poções de BOOST (2x XP / 2x Energia por N horas)
    let boosts: Boosts | null = null;
    const xpH = Number(effect.boostXpHours || 0);
    const energyH = Number(effect.boostEnergyHours || 0);
    if (xpH > 0 && energyH > 0) boosts = applyBoostPatch(char, "both", xpH);
    else if (xpH > 0) boosts = applyBoostPatch(char, "xp", xpH);
    else if (energyH > 0) boosts = applyBoostPatch(char, "energy", energyH);

    const changes: Record<string, number> = {};
    if (newHp !== hp) changes.hp = newHp - hp;
    if (newMana !== mana) changes.mana = newMana - mana;
    if (newEnergy !== energy) changes.energy = newEnergy - energy;
    if (Number(effect.xp || 0) * multXp > 0) changes.xp = Number(effect.xp || 0) * multXp;

    let leveledUp = 0;
    xp = newXp;
    while (level < maxLevel && xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      leveledUp += 1;
      xpToNext = xpForLevel(level);
    }

    await jsonDb.decrementInventoryItem(itemId, 1);

    const updated = await jsonDb.updateCharacter(characterId, {
      hp: newHp,
      mana: newMana,
      energy: newEnergy,
      xp,
      level,
      xpToNext,
      ...(boosts ? { boosts } : {}),
    });

    return NextResponse.json({
      success: true,
      used: 1,
      changes,
      leveledUp,
      boosts,
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}