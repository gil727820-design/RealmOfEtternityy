import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { CLASS_BASE_STATS, powerCalc, STAT_RESET_COST, type ClassName } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";
import { requireCharacterAuth } from "@/game/auth";

// Config de cada status: como descobrir quantos pontos foram investidos.
// perPoint precisa ser idêntico ao do /api/character/allocate.
type StatRow = {
  stat: string;
  field: string;
  baseKey?: keyof (typeof CLASS_BASE_STATS)["warrior"];
  fixedBase?: number;
  bonusKey?: "atk" | "def" | "hp" | "spd" | "crit";
  perPoint: number;
};

const STAT_ROWS: StatRow[] = [
  { stat: "attack", field: "attack", baseKey: "attack", bonusKey: "atk", perPoint: 2 },
  { stat: "defense", field: "defense", baseKey: "defense", bonusKey: "def", perPoint: 2 },
  { stat: "speed", field: "speed", baseKey: "speed", bonusKey: "spd", perPoint: 2 },
  { stat: "hp", field: "maxHp", baseKey: "hp", bonusKey: "hp", perPoint: 10 },
  { stat: "mana", field: "maxMana", baseKey: "mana", perPoint: 5 },
  { stat: "critical", field: "critical", baseKey: "critical", bonusKey: "crit", perPoint: 1 },
  { stat: "precision", field: "precision", fixedBase: 5, perPoint: 1 },
  { stat: "dodge", field: "dodge", fixedBase: 5, perPoint: 1 },
  { stat: "resistance", field: "resistance", fixedBase: 5, perPoint: 1 },
];

/** Soma os bônus de todos os itens equipados (forja + encanto) de um personagem. */
async function equippedBonuses(characterId: string) {
  let atk = 0, def = 0, hp = 0, spd = 0, crit = 0;
  const inv = await jsonDb.getInventoryForCharacter(characterId);
  for (const e of inv) {
    if (!e.item?.equipped || e.template?.type === "consumable") continue;
    const b = equipmentBonus(e.template, e.item);
    atk += b.attack;
    def += b.defense;
    hp += b.maxHp;
    spd += b.speed;
    crit += b.critical;
  }
  return { atk, def, hp, spd, crit };
}

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode resetar os atributos do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const gold = Number(char.gold) || 0;
    if (gold < STAT_RESET_COST) {
      return NextResponse.json(
        { error: `Ouro insuficiente! Você precisa de ${STAT_RESET_COST.toLocaleString("pt-BR")} de ouro.` },
        { status: 400 }
      );
    }

    const cls = (char.classType as ClassName) ?? "warrior";
    const base = CLASS_BASE_STATS[cls] ?? CLASS_BASE_STATS.warrior;
    const equip = await equippedBonuses(String(characterId));
    const level = Math.max(1, Number(char.level) || 1);

    // Total de pontos investidos em todos os status (nunca negativo).
    let refunded = 0;
    for (const row of STAT_ROWS) {
      const baseVal = row.fixedBase ?? base[row.baseKey as keyof typeof base] ?? 0;
      const bonus = row.bonusKey ? equip[row.bonusKey] : 0;
      const current = Number(char[row.field]) || 0;
      const invested = Math.max(0, Math.floor((current - baseVal - bonus) / row.perPoint));
      refunded += invested;
    }

    if (refunded <= 0) {
      return NextResponse.json(
        { error: "Nenhum ponto investido para resetar. Distribua pontos de status primeiro." },
        { status: 400 }
      );
    }

    // Status voltam ao padrão da classe + bônus dos itens equipados (mantidos).
    const attack = base.attack + equip.atk;
    const defense = base.defense + equip.def;
    const maxHp = base.hp + equip.hp;
    const speed = base.speed + equip.spd;
    const critical = base.critical + equip.crit;

    const patch: Record<string, unknown> = {
      attack,
      defense,
      speed,
      critical,
      maxHp,
      hp: Math.min(Number(char.hp) || maxHp, maxHp),
      maxMana: base.mana,
      mana: base.mana,
      precision: 5,
      dodge: 5,
      resistance: 5,
      gold: gold - STAT_RESET_COST,
      unspentStatPoints: (Number(char.unspentStatPoints) || 0) + refunded,
      baseStats: {
        attack: base.attack,
        defense: base.defense,
        maxHp: base.hp,
        speed: base.speed,
        critical: base.critical,
      },
      power: powerCalc({ attack, defense, hp: maxHp, speed, critical, level }),
      lastActivity: new Date().toISOString(),
    };

    const updated = await jsonDb.updateCharacter(characterId, patch);
    if (!updated) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      character: updated,
      refunded,
      cost: STAT_RESET_COST,
      message: `Atributos resetados! ${refunded} pontos foram devolvidos.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}