import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function POST(req: NextRequest) {
  try {
    const { characterId } = await req.json();
    if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
    
    await jsonDb.updateCharacter(characterId, { afkSince: new Date().toISOString() });
    
    return NextResponse.json({ success: true, message: "Modo AFK ativado! Suas recompensas começarão a acumular." });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
