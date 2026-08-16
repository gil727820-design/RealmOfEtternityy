import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc, classStatCap, type ClassName, type AllocStatKey } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";
import { requireCharacterAuth } from "@/game/auth";
import { totalSetBonus } from "@/game/sets";

// Configuração de cada status: quanto vale 1 ponto investido
const STAT_CONFIG: Record<string, { field: string; perPoint: number; cap?: number; bonusKey?: "atk" | "def" | "hp" | "spd" | "crit" }> = {
  attack: { field: "attack", perPoint: 2, bonusKey: "atk" },
  defense: { field: "defense", perPoint: 2, bonusKey: "def" },
  speed: { field: "speed", perPoint: 2, bonusKey: "spd" },
  hp: { field: "maxHp", perPoint: 10, bonusKey: "hp" },
  mana: { field: "maxMana", perPoint: 5 },
  critical: { field: "critical", perPoint: 1, cap: 90, bonusKey: "crit" },
  precision: { field: "precision", perPoint: 1 },
  dodge: { field: "dodge", perPoint: 1, cap: 50 },
  resistance: { field: "resistance", perPoint: 1 },
};

/** Soma os bônus de todos os itens equipados (forja + encanto + sets) de um personagem. */
async function equippedBonuses(characterId: string, level: number) {
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
  const setB = totalSetBonus(inv.filter((e: any) => e.item?.equipped), level);
  atk += setB.attack;
  def += setB.defense;
  hp += setB.maxHp;
  crit += setB.critical;
  return { atk, def, hp, spd, crit };
}

export async function POST(req: NextRequest) {
  try {
    const { characterId, stat, amount } = await req.json();

    if (!characterId || !stat) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Só o dono pode alocar pontos no próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const config = STAT_CONFIG[stat as string];
    if (!config) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const qty = Math.floor(Number(amount));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
    }

    const char = auth.char;

    const points = char.unspentStatPoints || 0;
    if (points < qty) {
      return NextResponse.json({ error: "Pontos de status insuficientes!" }, { status: 400 });
    }

    // Quantos pontos o incremento vale (em unidades do status)
    let appliedQty = qty;

    // Valor total atual do status (inclui bônus de itens equipados)
    const current = Number(char[config.field]) || 0;

    // Bônus de itens equipados para esse status (base investida exclui isso)
    const equip = await equippedBonuses(String(characterId), char.level || 1);
    const bonusVal = config.bonusKey ? equip[config.bonusKey] : 0;

    // Limite POR CLASSE: cada classe tem papel definido (DPS/tank/caster) e não
    // pode virar outra. O cap é sobre o valor investido (classe base + pontos),
    // então equipamentos ainda somam por cima mas não te deixam passar de tank/DPS.
    const cls = (char.classType ?? "warrior") as ClassName;
    const classCap = classStatCap(cls, stat as AllocStatKey);
    const baseInvested = Math.max(0, current - bonusVal);

    // Capacidade restante de cada limite (quanto ainda pode subir).
    let classRemaining = Infinity;
    let globalRemaining = Infinity;

    // Limite POR CLASSE (cap sobre o valor investido, sem equipamento).
    if (classCap !== null) {
      classRemaining = classCap - baseInvested;
      if (classRemaining <= 0) {
        return NextResponse.json(
          { error: `${stat} já está no limite da sua classe (${classCap})!` },
          { status: 400 }
        );
      }
      const maxPoints = Math.floor(classRemaining / config.perPoint);
      // Se falta menos que 1 ponto inteiro (ex.: limite 35 e +2 por ponto),
      // permite investir UM ponto parcial para completar o cap exato — em vez
      // de travar em 34 e nunca chegar aos 35.
      if (maxPoints <= 0) appliedQty = Math.min(appliedQty, 1);
      else appliedQty = Math.min(appliedQty, maxPoints);
    }

    // Limite máximo global do status (ex.: critical até 90%, dodge até 50%)
    if (config.cap !== undefined) {
      globalRemaining = config.cap - current;
      if (globalRemaining <= 0) {
        return NextResponse.json({ error: `${stat} já está no limite (${config.cap})!` }, { status: 400 });
      }
      const maxPoints = Math.floor(globalRemaining / config.perPoint);
      if (maxPoints <= 0) appliedQty = Math.min(appliedQty, 1);
      else appliedQty = Math.min(appliedQty, maxPoints);
    }

    // Valor aplicado: nunca estoura os limites — o último ponto pode ser
    // parcial (ex.: 34 → 35 com perPoint 2 gasta 1 ponto e soma só +1).
    const delta = Math.min(config.perPoint * appliedQty, classRemaining, globalRemaining);

    // Aplica o incremento no status correspondente
    const patch: Record<string, unknown> = {
      [config.field]: current + delta,
      unspentStatPoints: points - appliedQty,
    };

    // Mantém baseStats sincronizado (base da classe + pontos investidos, SEM
    // equipamento) para a UI saber quanto já foi investido em cada status.
    const baseStats = (char.baseStats as Record<string, number> | undefined) ?? {};
    const baseFieldMap: Record<string, string> = { attack: "attack", defense: "defense", speed: "speed", hp: "maxHp", critical: "critical" };
    if (baseFieldMap[stat as string]) {
      const baseKey = baseFieldMap[stat as string];
      const baseVal = Number(baseStats[baseKey]) || 0;
      patch.baseStats = { ...baseStats, [baseKey]: baseVal + delta };
    }

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
      pointsSpent: appliedQty,
      pointsLeft: (updated.unspentStatPoints || 0),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
