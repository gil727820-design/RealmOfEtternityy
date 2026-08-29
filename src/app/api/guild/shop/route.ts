import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { guildShopForLevel } from "@/game/guildShop";

/** GET: retorna itens da loja da guilda. */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const guildId = char.guildId;
    if (!guildId) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 400 });

    const guild = await jsonDb.findGuildById(String(guildId));
    if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

    const guildLevel = Number((guild as any).level) || 1;
    const guildCoins = Number((guild as any).guildCoins) || 0;
    const purchases = (guild as any).shopPurchases || {};

    const items = guildShopForLevel(guildLevel).map((item) => ({
      ...item,
      purchased: purchases[`${characterId}_${item.id}`] || 0,
      canBuy: guildCoins >= item.cost && (item.purchaseLimit === 0 || (purchases[`${characterId}_${item.id}`] || 0) < item.purchaseLimit),
    }));

    return NextResponse.json({ items, guildCoins, guildLevel });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST: compra um item da loja da guilda. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, itemId } = await req.json();
    if (!characterId || !itemId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const guildId = char.guildId;
    if (!guildId) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 400 });

    const guild = await jsonDb.findGuildById(String(guildId));
    if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

    const guildLevel = Number((guild as any).level) || 1;
    const shopItems = guildShopForLevel(guildLevel);
    const item = shopItems.find((i) => i.id === itemId);
    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    const guildCoins = Number((guild as any).guildCoins) || 0;
    if (guildCoins < item.cost) {
      return NextResponse.json({ error: `Moedas insuficientes (${guildCoins}/${item.cost})` }, { status: 400 });
    }

    const purchases = (guild as any).shopPurchases || {};
    const purchaseKey = `${characterId}_${item.id}`;
    const currentPurchases = purchases[purchaseKey] || 0;
    if (item.purchaseLimit > 0 && currentPurchases >= item.purchaseLimit) {
      return NextResponse.json({ error: "Limite de compras atingido" }, { status: 400 });
    }

    // Aplica a recompensa
    const charPatch: Record<string, unknown> = {};
    switch (item.rewardType) {
      case "gold":
        charPatch.gold = (Number(char.gold) || 0) + item.rewardAmount;
        break;
      case "diamonds":
        charPatch.diamonds = (Number(char.diamonds) || 0) + item.rewardAmount;
        break;
      case "crystals":
        charPatch.crystals = (Number(char.crystals) || 0) + item.rewardAmount;
        break;
      case "towerCoins":
        charPatch.towerCoins = (Number(char.towerCoins) || 0) + item.rewardAmount;
        break;
      case "energyRefill":
        charPatch.energy = Number(char.maxEnergy) || 100;
        break;
      case "statReset":
        charPatch.unspentStatPoints = (Number(char.unspentStatPoints) || 0) + (Number(char.level) || 1) * 3;
        break;
      case "xpBoost": {
        const until = new Date(Date.now() + item.rewardAmount).toISOString();
        charPatch.boostXpUntil = until;
        break;
      }
      case "goldBoost": {
        const until = new Date(Date.now() + item.rewardAmount).toISOString();
        charPatch.boostGoldUntil = until;
        break;
      }
      case "skinTicket": {
        // Concede um cristal como fallback (skin real precisa de mais lógica)
        charPatch.crystals = (Number(char.crystals) || 0) + 50;
        break;
      }
    }

    // Atualiza personagem
    await jsonDb.updateCharacter(char.id, charPatch);

    // Deduz moedas da guilda e registra compra
    const newPurchases = { ...purchases, [purchaseKey]: currentPurchases + 1 };
    await jsonDb.updateGuild(String(guildId), {
      guildCoins: guildCoins - item.cost,
      shopPurchases: newPurchases,
    });

    return NextResponse.json({
      success: true,
      message: `${item.icon} ${item.nameKey} comprado!`,
      itemId,
      guildCoins: guildCoins - item.cost,
      character: await jsonDb.findCharacterById(char.id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
