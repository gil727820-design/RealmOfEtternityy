import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getBoosts, boostSummary, type Boosts } from "@/game/boosts";
import { requireCharacterAuth } from "@/game/auth";
import { VIP_TIERS, vipTierById } from "@/game/vip";

/**
 * POST /api/codes/redeem
 * Resgata um código de resgate e aplica o boost (2x XP / 2x Energia) ao personagem.
 * Body: { code, characterId }
 */
export async function POST(req: NextRequest) {
  try {
    const { code, characterId } = await req.json();
    if (!code || !characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode resgatar código no próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const rec = await jsonDb.findCodeByCodeValue(String(code));
    if (!rec) {
      return NextResponse.json({ error: "Código inválido ou inexistente." }, { status: 404 });
    }

    const data = rec && typeof rec === "object" ? rec : {};
    const redeemedBy: string[] = Array.isArray(data.redeemedBy) ? data.redeemedBy : [];

    // Já resgatado por este jogador?
    if (redeemedBy.includes(String(characterId))) {
      return NextResponse.json({ error: "Você já resgatou este código." }, { status: 409 });
    }

    // Limite de usos (0 = ilimitado)
    const maxUses = Number(data.maxUses) || 0;
    if (maxUses > 0 && redeemedBy.length >= maxUses) {
      return NextResponse.json({ error: "Este código atingiu o limite de usos." }, { status: 410 });
    }

    // Validade (expiração)
    if (data.expiresAt) {
      const exp = new Date(data.expiresAt).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) {
        return NextResponse.json({ error: "Este código expirou." }, { status: 410 });
      }
    }

    const xpHours = Number(data.xpHours) || 0;
    const energyHours = Number(data.energyHours) || 0;
    // Recompensas novas: VIP por dias + recursos diretos.
    const vipTierId = String(data.vipTier || "").trim().toLowerCase();
    const vipDays = Math.max(0, Math.floor(Number(data.vipDays) || 0));
    const goldReward = Math.max(0, Math.floor(Number(data.gold) || 0));
    const diamondsReward = Math.max(0, Math.floor(Number(data.diamonds) || 0));
    const crystalsReward = Math.max(0, Math.floor(Number(data.crystals) || 0));
    const codeItems = Array.isArray(data.items) ? data.items : [];
    const tierDef = vipTierById(vipTierId);
    const hasVip = !!tierDef && vipDays > 0;
    if (xpHours <= 0 && energyHours <= 0 && !hasVip && goldReward <= 0 && diamondsReward <= 0 && crystalsReward <= 0 && codeItems.length === 0) {
      return NextResponse.json({ error: "Este código não possui recompensas." }, { status: 400 });
    }

    // Aplica o boost (2x XP / 2x Energia) por N horas, somando ao que já estiver ativo.
    const boosts: Boosts = getBoosts(char);
    const now = Date.now();
    if (xpHours > 0) boosts.xpUntil = new Date(now + xpHours * 3600 * 1000).toISOString();
    if (energyHours > 0) boosts.energyUntil = new Date(now + energyHours * 3600 * 1000).toISOString();

    // Recursos diretos (ouro / diamantes / cristais).
    const patch: Record<string, unknown> = {
      gold: (Number(char.gold) || 0) + goldReward,
      diamonds: (Number(char.diamonds) || 0) + diamondsReward,
      crystals: (Number(char.crystals) || 0) + crystalsReward,
      lastActivity: new Date().toISOString(),
    };

    // VIP: só aplica se o tier do código for MAIOR que o atual (nunca rebaixa).
    if (hasVip && tierDef) {
      const current = char.vipTier ? vipTierById(String(char.vipTier)) : null;
      const currentIdx = current ? VIP_TIERS.indexOf(current) : -1;
      const codeIdx = VIP_TIERS.indexOf(tierDef);
      if (codeIdx > currentIdx) {
        patch.vipTier = tierDef.id;
        patch.vipLevel = codeIdx + 1;
        patch.vipUntil = new Date(now + vipDays * 86400000).toISOString();
      } else if (current && currentIdx >= 0 && new Date(String(char.vipUntil || 0)).getTime() > now) {
        // Tier igual: estende a duração atual em vez de substituir.
        const extra = Math.max(0, Number(char.vipUntil ? new Date(String(char.vipUntil)).getTime() : 0) - now);
        patch.vipUntil = new Date(now + extra + vipDays * 86400000).toISOString();
      }
    }

    const updated = await jsonDb.updateCharacter(String(characterId), { ...patch, boosts });

    // Itens do código → insere no inventário do personagem.
    const grantedItemNames: string[] = [];
    for (const ci of codeItems) {
      const qty = Math.max(1, Math.floor(Number(ci.quantity) || 1));
      for (let i = 0; i < qty; i++) {
        try {
          await jsonDb.insertInventoryItem({
            characterId: String(characterId),
            templateId: ci.templateId,
            level: 1,
            equipped: false,
          });
        } catch { /* ignora item inválido */ }
      }
      grantedItemNames.push(`Item #${ci.templateId} x${qty}`);
    }

    // Marca como resgatado por este jogador.
    await jsonDb.updateCode(rec.id, { redeemedBy: [...redeemedBy, String(characterId)] });

    const granted: string[] = [];
    if (xpHours > 0) granted.push(`2x XP (${xpHours}h)`);
    if (energyHours > 0) granted.push(`2x Energia (${energyHours}h)`);
    if (hasVip && tierDef) granted.push(`VIP ${tierDef.id.charAt(0).toUpperCase() + tierDef.id.slice(1)} (${vipDays}d)`);
    if (goldReward > 0) granted.push(`${goldReward.toLocaleString()} de ouro`);
    if (diamondsReward > 0) granted.push(`${diamondsReward} diamantes`);
    if (crystalsReward > 0) granted.push(`${crystalsReward} cristais`);
    if (grantedItemNames.length > 0) granted.push(grantedItemNames.join(", "));

    return NextResponse.json({
      success: true,
      character: updated,
      boosts: boostSummary(updated),
      granted,
      message: `Código resgatado! Você recebeu: ${granted.join(", ")}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}