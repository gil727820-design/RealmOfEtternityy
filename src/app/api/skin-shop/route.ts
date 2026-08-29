import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getSkinShopItems, canBuySkin } from "@/game/skinShop";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    let playerClass: string | undefined;
    let ownedSkins: string[] = [];

    if (characterId) {
      const char = await jsonDb.findCharacterById(characterId);
      if (char) {
        playerClass = char.classType || char.className;
        ownedSkins = Array.isArray(char.skins) ? char.skins : [];
      }
    }

    const settings = await jsonDb.getServerSettings();
    const skinPrices = (settings as any)?.skinPrices || {};
    const items = getSkinShopItems(playerClass as any, skinPrices);
    const result = items.map((item) => ({
      id: item.skin.id,
      className: item.skin.className,
      nameKey: item.skin.nameKey,
      rarity: item.skin.rarity,
      image: item.skin.image,
      diamondPrice: item.diamondPrice,
      classDiscount: item.classDiscount,
      owned: ownedSkins.includes(item.skin.id),
    }));

    return NextResponse.json({ items: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, skinId, paymentType } = body;

    if (!characterId || !skinId) {
      return NextResponse.json({ error: "characterId e skinId obrigatorios" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const playerClass = char.classType || char.className;
    const ownedSkins = Array.isArray(char.skins) ? char.skins : [];
    const items = getSkinShopItems(playerClass);
    const item = items.find((i) => i.skin.id === skinId);

    if (!item) {
      return NextResponse.json({ error: "Skin nao encontrada" }, { status: 404 });
    }

    const check = canBuySkin(item, char.diamonds || 0, ownedSkins);

    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const patch: any = { skins: [...ownedSkins, skinId], diamonds: (char.diamonds || 0) - item.diamondPrice };

    await jsonDb.updateCharacter(characterId, patch);
    const updated = await jsonDb.findCharacterById(characterId);

    return NextResponse.json({
      success: true,
      skin: item.skin,
      paid: item.diamondPrice,
      paymentType: "diamonds",
      character: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
