import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getBoosts, boostSummary, type Boosts } from "@/game/boosts";

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

    const char = await jsonDb.findCharacterById(String(characterId));
    if (!char) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

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
    if (xpHours <= 0 && energyHours <= 0) {
      return NextResponse.json({ error: "Este código não possui recompensas." }, { status: 400 });
    }

    // Aplica o boost (2x XP / 2x Energia) por N horas, somando ao que já estiver ativo.
    const boosts: Boosts = getBoosts(char);
    const now = Date.now();
    if (xpHours > 0) boosts.xpUntil = new Date(now + xpHours * 3600 * 1000).toISOString();
    if (energyHours > 0) boosts.energyUntil = new Date(now + energyHours * 3600 * 1000).toISOString();

    const updated = await jsonDb.updateCharacter(String(characterId), {
      boosts,
      lastActivity: new Date().toISOString(),
    });

    // Marca como resgatado por este jogador.
    await jsonDb.updateCode(rec.id, { redeemedBy: [...redeemedBy, String(characterId)] });

    return NextResponse.json({
      success: true,
      character: updated,
      boosts: boostSummary(updated),
      message: "Código resgatado com sucesso!",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}