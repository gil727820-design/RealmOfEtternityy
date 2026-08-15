import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { powerCalc, type ClassName } from "@/game/constants";
import { skillTreeForClass, skillTreeTotalRanks } from "@/game/skillTree";
import { masteryBuff, masteryTitle } from "@/game/mastery";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Árvore de Habilidades:
 *  - POST { characterId, skillId }  → aprende/melhora 1 rank (custa 1 ponto).
 *  - POST { characterId, reset: true } → devolve TODOS os pontos (custa 100k de ouro).
 *
 * Aplicação do bônus passivo na hora: os atributos do personagem são atualizados
 * direto (atk/def/hp/crit/precisão/esquiva/vel), então o poder, a torre e o PvP
 * já refletem a árvore sem mudar nada em outras rotas.
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId, skillId, reset } = await req.json();
    if (!characterId) {
      return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    }

    // Só o dono pode evoluir a árvore de habilidades do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // ---- Reset: devolve todos os pontos investidos por 25k de ouro ----
    if (reset === true) {
      const COST = 25_000;
      const gold = Number(char.gold) || 0;
      if (gold < COST) {
        return NextResponse.json({ error: "Ouro insuficiente (25.000)" }, { status: 400 });
      }
      const tree = skillTreeForClass((char.classType as ClassName) || "warrior");
      const invested = (char.skills as Record<string, number> | undefined) ?? {};
      const pointsRefunded = skillTreeTotalRanks(char);

      const patch: Record<string, unknown> = {
        gold: gold - COST,
        skills: {},
        skillPoints: (Number(char.skillPoints) || 0) + pointsRefunded,
      };
      // Remove os bônus passivos que a árvore dava.
      for (const s of tree) {
        const rank = Number(invested[s.id]) || 0;
        if (rank > 0 && s.passive) {
          const stat = s.passive.stat;
          if (stat === "maxHp") {
            patch.maxHp = Math.max(10, (Number(char.maxHp) || 0) - s.passive.valuePerRank * rank);
            patch.hp = Math.min(Number(patch.maxHp), Number(char.hp) || 0);
          } else {
            patch[stat] = Math.max(0, (Number(char[stat]) || 0) - s.passive.valuePerRank * rank);
          }
        }
      }
      const after = { ...char, ...patch };
      patch.power = powerCalc({
        attack: Number(after.attack) || 0,
        defense: Number(after.defense) || 0,
        hp: Number(after.maxHp) || 0,
        speed: Number(after.speed) || 0,
        critical: Number(after.critical) || 0,
        level: Number(after.level) || 1,
      });

      const updated = await jsonDb.updateCharacter(char.id, patch);
      return NextResponse.json({
        success: true,
        character: updated,
        message: `🔄 Árvore resetada! ${pointsRefunded} ${pointsRefunded === 1 ? "ponto devolvido" : "pontos devolvidos"}.`,
      });
    }

    // ---- Aprender / melhorar 1 rank ----
    const tree = skillTreeForClass((char.classType as ClassName) || "warrior");
    const skill = tree.find((s) => s.id === skillId);
    if (!skill) {
      return NextResponse.json({ error: "Habilidade não encontrada para sua classe" }, { status: 404 });
    }

    const invested = (char.skills as Record<string, number> | undefined) ?? {};
    const currentRank = Number(invested[skillId]) || 0;
    if (currentRank >= skill.maxRank) {
      return NextResponse.json({ error: "Esta habilidade já está no nível máximo!" }, { status: 400 });
    }

    // Requisito: precisa de X ranks totais investidos na árvore para desbloquear.
    const totalRanks = skillTreeTotalRanks(char);
    if (totalRanks < skill.requiresRanks) {
      return NextResponse.json(
        { error: `Desbloqueie antes ${skill.requiresRanks} ${skill.requiresRanks === 1 ? "ponto" : "pontos"} na árvore (${totalRanks}/${skill.requiresRanks})` },
        { status: 400 }
      );
    }

    const points = Number(char.skillPoints) || 0;
    const cost = skill.costPerRank;
    if (points < cost) {
      return NextResponse.json({ error: "Pontos de habilidade insuficientes" }, { status: 400 });
    }

    const nextRank = currentRank + 1;
    const patch: Record<string, unknown> = {
      skillPoints: points - cost,
      skills: { ...invested, [skillId]: nextRank },
    };
    // Aplica o bônus passivo do novo rank direto nos atributos.
    if (skill.passive) {
      const stat = skill.passive.stat;
      if (stat === "maxHp") {
        const delta = skill.passive.valuePerRank;
        patch.maxHp = (Number(char.maxHp) || 0) + delta;
        patch.hp = (Number(char.hp) || 0) + delta;
      } else {
        patch[stat] = (Number(char[stat]) || 0) + skill.passive.valuePerRank;
      }
    }

    const after = { ...char, ...patch };
    patch.power = powerCalc({
      attack: Number(after.attack) || 0,
      defense: Number(after.defense) || 0,
      hp: Number(after.maxHp) || 0,
      speed: Number(after.speed) || 0,
      critical: Number(after.critical) || 0,
      level: Number(after.level) || 1,
    });

    const updated = await jsonDb.updateCharacter(char.id, patch);
    // MAESTRIA: ao completar a árvore (todas as 10 habilidades no máximo), o
    // cliente recebe a flag pra tocar a animação especial e exibir o buff.
    const mastery = masteryBuff(updated);
    return NextResponse.json({
      success: true,
      character: updated,
      message: mastery
        ? `👑 MAESTRIA DESPERTADA! ${masteryTitle(updated, "pt")} — buff permanente ativo!`
        : `✨ ${skill.name.pt} nível ${nextRank}!`,
      skill: { id: skill.id, rank: nextRank },
      mastery: mastery
        ? {
            active: true,
            title: masteryTitle(updated, "pt"),
          }
        : { active: false },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
