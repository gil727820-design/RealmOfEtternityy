import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jsonDb from "@/db/repo";
import { setSessionCookie } from "@/game/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
    }
    
    const uname = username.trim().toLowerCase();
    const user = await jsonDb.findUserByUsername(uname);

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (user.banned) {
      return NextResponse.json({ error: `Conta banida: ${user.banReason || "Violação dos termos"}` }, { status: 403 });
    }

    if (user.deleted) {
      return NextResponse.json(
        { error: "Conta excluída. Caso ache que foi um engano, contate a administração." },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    await jsonDb.updateUser(user.id, { lastLogin: new Date().toISOString() });

    // Todos os personagens da conta (o primeiro criado é o principal).
    const chars = (await jsonDb.getCharactersByUserId(user.id)).sort((a: any, b: any) =>
      (a.createdAt || "").localeCompare(b.createdAt || "")
    );
    const main = chars[0] ?? null;
    const mailboxCount = main
      ? await jsonDb.countUnclaimedMails(main.id)
      : 0;

    // Grava a sessão autenticada em cookie httpOnly (a partir de agora as rotas
    // de jogo validam a propriedade dos personagens via esta sessão).
    const res = NextResponse.json({
      userId: user.id,
      username: user.username,
      role: user.role,
      locale: user.locale,
      hasCharacter: chars.length > 0,
      character: main,
      characters: chars.map((c: any) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        classType: c.classType,
        sex: c.sex,
        power: c.power,
        currentRegion: c.currentRegion,
      })),
      mailboxCount,
    });
    setSessionCookie(res, user.id);
    return res;
  } catch (e: unknown) {
    console.error("Login error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
