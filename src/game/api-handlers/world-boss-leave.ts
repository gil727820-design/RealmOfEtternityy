import { NextRequest, NextResponse } from "next/server";
import { loadCtx } from "./world-boss-state";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/** Sai do evento: remove do squad (promovendo o próximo membro se for líder). */
export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const { event } = await loadCtx();
    if (!event) return NextResponse.json({ success: true });

    const meId = auth.char.id;

    // Sai do squad (se estiver em um).
    const squadIdx = event.squads.findIndex((s) => s.members.includes(meId));
    if (squadIdx >= 0) {
      const squad = event.squads[squadIdx];
      squad.members = squad.members.filter((id) => id !== meId);
      squad.invites = squad.invites.filter((i) => i.targetId !== meId);
      if (squad.members.length === 0) {
        event.squads.splice(squadIdx, 1);
      } else if (squad.leaderId === meId) {
        // Promove o próximo membro a líder.
        squad.leaderId = squad.members[0];
        event.log.push(`👑 ${event.participants[squad.leaderId]?.name ?? "?"} agora lidera o squad.`);
      }
    }

    // Remove do evento (participante).
    delete event.participants[meId];

    await jsonDb.saveWorldBossEvent(event);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("World boss leave error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
