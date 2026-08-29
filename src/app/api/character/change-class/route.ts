import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { CLASS_BASE_STATS, powerCalc, type ClassName } from "@/game/constants";
import { requireCharacterAuth } from "@/game/auth";

/** Custo base para trocar de classe. */
const BASE_COST = 5000;
/** Custo adicional por nível do personagem. */
const COST_PER_LEVEL = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, newClassType } = body;
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }
    if (!newClassType) {
      return NextResponse.json({ error: "Nova classe obrigatória" }, { status: 400 });
    }

    // Só o dono pode trocar a classe do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const validClasses: readonly string[] = [
      "warrior", "paladin", "berserker", "mage", "necromancer", "assassin",
      "hunter", "monk", "samurai", "knight", "summoner", "templar", "archer",
    ];
    if (!validClasses.includes(String(newClassType))) {
      return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
    }
    if (char.classType === newClassType) {
      return NextResponse.json({ error: "Você já é dessa classe!" }, { status: 400 });
    }

    // Calcular custo
    const level = Math.max(1, Number(char.level) || 1);
    const cost = BASE_COST + level * COST_PER_LEVEL;
    const currentGold = Number(char.gold) || 0;

    if (currentGold < cost) {
      return NextResponse.json({
        error: `Ouro insuficiente! Necessário: ${cost.toLocaleString("pt-BR")} 💰 (você tem ${currentGold.toLocaleString("pt-BR")})`,
        cost,
        currentGold,
      }, { status: 400 });
    }

    // Stats base da nova classe
    const base = CLASS_BASE_STATS[(newClassType as ClassName)] ?? CLASS_BASE_STATS.warrior;
    const newPower = powerCalc({
      attack: base.attack,
      defense: base.defense,
      hp: base.hp,
      speed: base.speed,
      critical: base.critical,
      level,
    });

    // Aplicar mudança
    const updated = await jsonDb.updateCharacter(String(characterId), {
      classType: newClassType,
      gold: currentGold - cost,
      // Stats base da nova classe (mantém level e XP)
      hp: base.hp,
      maxHp: base.hp,
      attack: base.attack,
      defense: base.defense,
      speed: base.speed,
      critical: base.critical,
      mana: base.mana,
      maxMana: base.mana,
      power: newPower,
      // Remove classe avançada (não é da nova classe)
      advancedClass: null,
      // Reseta atributos investidos (pontos devolvidos = nível × 3)
      unspentStatPoints: level * 3,
      lastActivity: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      character: updated,
      cost,
      message: `🔄 Você trocou de ${char.classType} para ${newClassType}! Custo: ${cost.toLocaleString("pt-BR")} 💰`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
