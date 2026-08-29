import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { inheritanceCost, canInheritItem, INHERITANCE_DAILY_LIMIT } from "@/game/inheritance";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;
    const userId = char.userId;
    const allChars = await jsonDb.getCharactersByUserId(userId);
    const characters = allChars.map((c: any) => ({ id: c.id, name: c.name, classType: c.classType || "warrior", level: c.level || 1, sex: c.sex || "male" }));
    const inventory = await jsonDb.getInventoryForCharacter(characterId);
    const items = inventory.map((inv: any) => ({
      id: inv.item.id, templateId: inv.item.templateId, name: inv.template?.name || `Item #${inv.item.templateId}`,
      icon: inv.template?.icon || "\u{1F4E6}", rarity: inv.template?.rarity || "common", quantity: inv.quantity || 1,
      equipped: inv.item.equipped || false, sellPrice: inv.template?.sellPrice || 0, slot: inv.template?.slot || "",
      questItem: inv.item.questItem || false,
    }));
    const stats = (char.inheritanceStats as any) || {};
    const today = new Date().toDateString();
    const transferredToday = stats.lastDate === today ? (stats.transferredToday || 0) : 0;
    return NextResponse.json({ characters, items, transferredToday, dailyLimit: INHERITANCE_DAILY_LIMIT, remaining: Math.max(0, INHERITANCE_DAILY_LIMIT - transferredToday) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action, itemId, targetCharacterId } = body;
    if (!characterId || !itemId || !targetCharacterId) return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
    if (itemId === targetCharacterId) return NextResponse.json({ error: "Nao pode transferir para si mesmo!" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;
    const stats = (char.inheritanceStats as any) || {};
    const today = new Date().toDateString();
    const transferredToday = stats.lastDate === today ? (stats.transferredToday || 0) : 0;
    if (transferredToday >= INHERITANCE_DAILY_LIMIT) return NextResponse.json({ error: "Limite diario atingido" }, { status: 400 });
    const targetChar = await jsonDb.findCharacterById(targetCharacterId);
    if (!targetChar) return NextResponse.json({ error: "Personagem alvo nao encontrado" }, { status: 404 });
    if (targetChar.userId !== char.userId) return NextResponse.json({ error: "Mesma conta necessaria" }, { status: 400 });
    const invItem = await jsonDb.getInventoryItemById(itemId);
    if (!invItem) return NextResponse.json({ error: "Item nao encontrado" }, { status: 404 });
    if (invItem.item.characterId !== characterId) return NextResponse.json({ error: "Item nao e seu" }, { status: 400 });
    const inheritCheck = canInheritItem(invItem.item);
    if (!inheritCheck.ok) return NextResponse.json({ error: inheritCheck.reason }, { status: 400 });
    const cost = inheritanceCost(invItem.template?.rarity || "common", invItem.template?.sellPrice || 0);
    if ((char.gold || 0) < cost.gold) return NextResponse.json({ error: `Ouro insuficiente: ${cost.gold.toLocaleString()}` }, { status: 400 });
    if (cost.diamonds > 0 && (char.diamonds || 0) < cost.diamonds) return NextResponse.json({ error: `Diamantes insuficientes: ${cost.diamonds}` }, { status: 400 });
    await jsonDb.removeInventoryItem(itemId);
    await jsonDb.grantItem(targetCharacterId, invItem.item.templateId, invItem.quantity || 1);
    const patch: any = { gold: (char.gold || 0) - cost.gold, inheritanceStats: { lastDate: today, transferredToday: transferredToday + 1, totalTransferred: (stats.totalTransferred || 0) + 1 } };
    if (cost.diamonds > 0) patch.diamonds = (char.diamonds || 0) - cost.diamonds;
    await jsonDb.updateCharacter(characterId, patch);
    const updated = await jsonDb.findCharacterById(characterId);
    return NextResponse.json({ success: true, item: { id: invItem.item.id, name: invItem.template?.name || "Item", rarity: invItem.template?.rarity || "common" }, target: { id: targetChar.id, name: targetChar.name }, cost, character: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
