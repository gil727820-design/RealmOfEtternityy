import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/**
 * POST /api/reports
 * Cria um reporte de BUG ou FEEDBACK enviado pelo jogador.
 * Body: { characterId, type: "bug" | "feedback", category?, message }
 */
export async function POST(req: NextRequest) {
  try {
    const { characterId, type, category, message } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 400 });
    }
    if (type !== "bug" && type !== "feedback") {
      return NextResponse.json({ error: "Selecione: Bug ou Feedback" }, { status: 400 });
    }
    const text = String(message || "").trim();
    if (text.length < 5) {
      return NextResponse.json({ error: "Descreva o ocorrido (mínimo 5 caracteres)." }, { status: 400 });
    }

    // Só o dono do personagem pode enviar reporte como ele.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const rec = await jsonDb.createReport({
      characterId: String(characterId),
      characterName: char.name || "—",
      classType: char.classType || "warrior",
      level: char.level || 1,
      type: type === "bug" ? "bug" : "feedback",
      category: String(category || "").trim() || null,
      message: text,
    });

    return NextResponse.json({ success: true, id: rec.id, message: "Recebido! Agradecemos o seu contato." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}