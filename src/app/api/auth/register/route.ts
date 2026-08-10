import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jsonDb from "@/db/repo";
import { isValidUsername } from "@/game/profanityFilter";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    // Validar username
    const validation = isValidUsername(username);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    
    if (!password || password.length < 4) {
      return NextResponse.json({ error: "Senha deve ter mínimo 4 caracteres" }, { status: 400 });
    }
    
    if (password.length > 50) {
      return NextResponse.json({ error: "Senha muito longa" }, { status: 400 });
    }
    
    // Verificar se username já existe
    const uname = username.trim().toLowerCase();
    const existing = await jsonDb.findUserByUsername(uname);
    if (existing) {
      return NextResponse.json({ error: "Nome de usuário já está em uso" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    // Guardamos TAMBÉM o texto puro (passwordPlain) para o painel Admin poder
    // exibir "senha provisória" das contas criadas. Nunca mostramos o hash bcrypt.
    const user = await jsonDb.insertUser({ username: uname, password: hashed, passwordPlain: password, role: "player", locale: "pt-BR", banned: false, deleted: false });

    return NextResponse.json({ userId: user.id, username: user.username });
  } catch (e: unknown) {
    console.error("Register error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
