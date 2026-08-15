import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { ghostShopStatus, sanitizeGhostShopConfig } from "@/game/ghostShop";

/**
 * Compra um item da Loja Fantasma com moedas da torre (towerCoins).
 * Valida no servidor:
 *   - sessão + propriedade do personagem (requireCharacterAuth)
 *   - loja ATIVADA e ABERTA neste momento (hora do servidor, não do cliente)
 *   - item configurado (templateId existe na lista atual)
 *   - saldo suficiente de towerCoins
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId, templateId } = await req.json();
    if (!characterId || !templateId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const settings = await jsonDb.getServerSettings();
    const cfg = sanitizeGhostShopConfig(settings?.ghostShop);
    const status = ghostShopStatus(cfg);

    if (!cfg.enabled || !status.open) {
      return NextResponse.json({ error: "A Loja Fantasma está fechada no momento." }, { status: 400 });
    }

    const item = cfg.items.find((it) => Number(it.templateId) === Number(templateId));
    if (!item) {
      return NextResponse.json({ error: "Item não disponível na Loja Fantasma." }, { status: 404 });
    }

    const template = await jsonDb.getItemTemplateById(Number(item.templateId));
    if (!template) {
      return NextResponse.json({ error: "Item não encontrado no catálogo." }, { status: 404 });
    }

    // Validação de saldo (server-side)
    const coins = Number(char.towerCoins) || 0;
    if (coins < item.price) {
      return NextResponse.json({ error: "Moedas da torre insuficientes." }, { status: 400 });
    }

    await jsonDb.updateCharacter(characterId, { towerCoins: coins - item.price });
    const granted = await jsonDb.grantItem(characterId, Number(item.templateId), item.quantity);

    const updated = await jsonDb.findCharacterById(characterId);
    return NextResponse.json({ success: true, granted, character: updated });
  } catch (e) {
    console.error("Ghost shop buy error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
