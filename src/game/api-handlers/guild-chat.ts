import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

const MAX_TEXT = 300;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");
    const after = url.searchParams.get("after") || ""; // corta mensagens antigas
    if (!guildId) return NextResponse.json({ error: "guildId necessário" }, { status: 400 });

    let messages = await jsonDb.getGuildChatMessages(String(guildId), 60);
    if (after) {
      messages = messages.filter((m) => m.id !== after);
    }
    return NextResponse.json({ messages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { characterId, guildId, text } = await req.json();
    if (!characterId || !guildId || !text || !String(text).trim()) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    // Só o dono pode falar no chat com o próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;
    if (!char.guildId || String(char.guildId) !== String(guildId)) {
      return NextResponse.json({ error: "Você não é membro desta guilda" }, { status: 403 });
    }
    const clean = String(text).trim().slice(0, MAX_TEXT);
    const msg = await jsonDb.insertGuildChatMessage({
      guildId: String(guildId),
      characterId: char.id,
      name: char.name || "Jogador",
      classType: char.classType || "warrior",
      sex: char.sex || "male",
      level: char.level || 1,
      text: clean,
    });
    return NextResponse.json({ success: true, message: msg });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Guild chat error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}