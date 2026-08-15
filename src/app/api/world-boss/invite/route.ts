import { NextRequest, NextResponse } from "next/server";
import { requireOpenEvent } from "../_state";
import jsonDb from "@/db/repo";
import { randomUUID } from "crypto";

/** Líder convida um jogador (por nome) para entrar no squad. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, targetName } = await req.json();
    if (!characterId || !targetName || !String(targetName).trim()) {
      return NextResponse.json({ error: "Informe o nome do jogador para convidar." }, { status: 400 });
    }

    const open = await requireOpenEvent(req, characterId);
    if (!open.ok) return open.response;
    const { ctx, auth } = open;
    const { cfg, event } = ctx;
    if (!event) return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });

    const meId = auth.char.id;

    // Garante participação do líder (entra automaticamente).
    if (!event.participants[meId]) {
      const { participantFromChar } = await import("../_state");
      event.participants[meId] = participantFromChar(auth.char);
    }

    // Squad do líder (cria se ainda não tiver).
    let squad = event.squads.find((s) => s.members.includes(meId));
    if (!squad) {
      squad = { id: randomUUID(), leaderId: meId, members: [meId], invites: [] };
      event.squads.push(squad);
    }

    if (squad.leaderId !== meId) {
      return NextResponse.json({ error: "Apenas o líder do squad pode convidar." }, { status: 400 });
    }
    if (squad.members.length >= cfg.maxSquadSize) {
      return NextResponse.json({ error: `Squad cheio (máximo ${cfg.maxSquadSize} jogadores).` }, { status: 400 });
    }

    // Busca o alvo pelo nome (exato, depois por trecho).
    const target =
      (await jsonDb.findCharacterByName(String(targetName).trim())) ??
      (await jsonDb.listCharacters(String(targetName).trim(), 5))[0] ??
      null;
    if (!target) {
      return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404 });
    }
    if (target.id === meId) {
      return NextResponse.json({ error: "Você não pode convidar a si mesmo." }, { status: 400 });
    }
    if (squad.members.includes(target.id)) {
      return NextResponse.json({ error: "Esse jogador já está no seu squad." }, { status: 400 });
    }
    // Se o alvo já está em outro squad, também não convida.
    const inOtherSquad = event.squads.some((s) => s.id !== squad!.id && s.members.includes(target.id));
    if (inOtherSquad) {
      return NextResponse.json({ error: "Esse jogador já está em outro squad." }, { status: 400 });
    }
    if (squad.invites.some((i) => i.targetId === target.id)) {
      return NextResponse.json({ error: "Convite já enviado para esse jogador." }, { status: 400 });
    }

    squad.invites.push({ targetId: target.id, at: Date.now() });
    event.log.push(`📨 ${auth.char.name} convidou ${target.name} para o squad.`);
    await jsonDb.saveWorldBossEvent(event);

    return NextResponse.json({
      success: true,
      squad: {
        id: squad.id,
        leaderId: squad.leaderId,
        members: squad.members,
        invites: squad.invites,
      },
    });
  } catch (e: unknown) {
    console.error("World boss invite error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
