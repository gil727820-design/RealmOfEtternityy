import { NextRequest, NextResponse } from "next/server";
import { participantFromChar, requireOpenEvent } from "../_state";
import jsonDb from "@/db/repo";

/** Aceita (accept=true) ou recusa um convite de squad. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, squadId, accept } = await req.json();
    if (!characterId || !squadId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const open = await requireOpenEvent(req, characterId);
    if (!open.ok) return open.response;
    const { ctx, auth } = open;
    const { cfg, event } = ctx;
    if (!event) return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });

    const meId = auth.char.id;
    const squad = event.squads.find((s) => s.id === squadId);
    if (!squad) return NextResponse.json({ error: "Squad não encontrado." }, { status: 404 });

    const inviteIdx = squad.invites.findIndex((i) => i.targetId === meId);
    if (inviteIdx < 0) {
      return NextResponse.json({ error: "Você não tem convite pendente desse squad." }, { status: 404 });
    }
    const [invite] = squad.invites.splice(inviteIdx, 1);

    if (accept === true) {
      if (squad.members.length >= cfg.maxSquadSize) {
        return NextResponse.json({ error: `Squad cheio (máximo ${cfg.maxSquadSize} jogadores).` }, { status: 400 });
      }
      // Garante participação no evento (entra automaticamente ao aceitar).
      if (!event.participants[meId]) event.participants[meId] = participantFromChar(auth.char);
      squad.members.push(meId);
      const me = event.participants[meId];
      event.log.push(`🤝 ${me.name} entrou no squad de ${event.participants[squad.leaderId]?.name ?? "?"}!`);
    } else {
      const me = event.participants[meId];
      event.log.push(`❌ ${me?.name ?? "Um jogador"} recusou o convite de ${event.participants[squad.leaderId]?.name ?? "?"}.`);
    }

    await jsonDb.saveWorldBossEvent(event);
    return NextResponse.json({ success: true, accepted: accept === true });
  } catch (e: unknown) {
    console.error("World boss respond error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
