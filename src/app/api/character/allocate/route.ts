import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc } from "@/game/constants";

// Configuração de cada status: quanto vale 1 ponto investido
const STAT_CONFIG: Record<string, { field: string; perPoint: number }> = {
  attack: { field: "attack", perPoint: 2 },
  defense: { field: "defense", perPoint: 2 },
  speed: { field: "speed", perPoint: 2 },
  hp: { field: "maxHp", perPoint: 10 },
  mana: { field: "maxMana", perPoint: 5 },
  critical: { field: "critical", perPoint: 1 },
  precision: { field: "precision", perPoint: 1 },
  dodge: { field: "dodge", perPoint: 1 },
  resistance: { field: "resistance", perPoint: 1 },
};

export async function POST(req: NextRequest) {
  try {
    const { characterId, stat, amount } = await req.json();

    if (!characterId || !stat) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const config = STAT_CONFIG[stat as string];
    if (!config) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const qty = Math.floor(Number(amount));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    const points = char.unspentStatPoints || 0;
    if (points < qty) {
      return NextResponse.json({ error: "Pontos de status insuficientes!" }, { status: 400 });
    }

    const delta = config.perPoint * qty;

    // Aplica o incremento no status correspondente
    const patch: Record<string, unknown> = {
      [config.field]: (Number(char[config.field]) || 0) + delta,
      unspentStatPoints: points - qty,
    };

    // HP/Mana: ao aumentar o máximo, também aumenta o valor atual
    if (stat === "hp") {
      patch.hp = (Number(char.hp) || 0) + delta;
    }
    if (stat === "mana") {
      patch.mana = (Number(char.mana) || 0) + delta;
    }

    // Recalcula o poder total do personagem
    const attack = stat === "attack" ? (patch.attack as number) : char.attack;
    const defense = stat === "defense" ? (patch.defense as number) : char.defense;
    const speed = stat === "speed" ? (patch.speed as number) : char.speed;
    const critical = stat === "critical" ? (patch.critical as number) : char.critical;
    const maxHp = stat === "hp" ? (patch.maxHp as number) : char.maxHp;
    patch.power = powerCalc({
      attack: Number(attack) || 0,
      defense: Number(defense) || 0,
      hp: Number(maxHp) || 0,
      speed: Number(speed) || 0,
      critical: Number(critical) || 0,
      level: char.level || 1,
    });

    const updated = await jsonDb.updateCharacter(characterId, patch);
    if (!updated) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      character: updated,
      stat,
      added: delta,
      pointsSpent: qty,
      pointsLeft: (updated.unspentStatPoints || 0),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
