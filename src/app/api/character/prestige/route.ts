import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { canPrestige, prestigePatch, PRESTIGE_MIN_LEVEL } from "@/game/prestige";
import { equipmentBonus } from "@/game/forge";
import { requireCharacterAuth } from "@/game/auth";
import { totalSetBonus } from "@/game/sets";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const check = canPrestige(char);
    return NextResponse.json({
      canPrestige: check.ok,
      reason: check.reason || null,
      minLevel: PRESTIGE_MIN_LEVEL,
      prestige: Number(char.prestige) || 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    // Só o dono pode prestigiar o próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const check = canPrestige(char);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    // Soma os bônus atuais dos itens equipados (forja + encanto + sets).
    const inv = await jsonDb.getInventoryForCharacter(String(characterId));
    const bonus = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
    for (const e of inv) {
      if (!e.item?.equipped || e.template?.type === "consumable") continue;
      const b = equipmentBonus(e.template, e.item);
      bonus.attack += b.attack;
      bonus.defense += b.defense;
      bonus.maxHp += b.maxHp;
      bonus.speed += b.speed;
      bonus.critical += b.critical;
    }
    const setBonus = totalSetBonus(inv.filter((e: any) => e.item?.equipped), char.level || 1);
    bonus.attack += setBonus.attack;
    bonus.defense += setBonus.defense;
    bonus.maxHp += setBonus.maxHp;
    bonus.critical += setBonus.critical;

    const patch = prestigePatch(char, bonus);
    const updated = await jsonDb.updateCharacter(String(characterId), patch);
    if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    return NextResponse.json({
      success: true,
      character: updated,
      prestige: updated.prestige,
      message: `🌟 Renasceu! Agora com prestígio ${updated.prestige} (+1% de atributos base por prestígio).`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
