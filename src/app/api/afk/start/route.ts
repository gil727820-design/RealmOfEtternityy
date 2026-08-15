import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

    // Só o dono pode ativar o AFK do próprio personagem.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Protege contra começar de novo com recompensas ainda pendentes
    // (perderia o tempo acumulado ao zerar o afkSince).
    if (char.afkSince) {
      const diff = Math.floor((Date.now() - new Date(char.afkSince).getTime()) / 1000);
      if (diff >= 60) {
        return NextResponse.json(
          { error: "Você já tem recompensas acumuladas. Colete antes de descansar novamente." },
          { status: 400 }
        );
      }
    }

    await jsonDb.updateCharacter(characterId, { afkSince: new Date().toISOString() });
    
    return NextResponse.json({ success: true, message: "Modo AFK ativado! Suas recompensas começarão a acumular." });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
