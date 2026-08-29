import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jsonDb from "@/db/repo";
import { getSession, setSessionCookie, clearSessionCookie } from "@/game/auth";
import { isValidUsername } from "@/game/profanityFilter";

/** GET — Verifica sessão (me) */
export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await jsonDb.findUserById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });
    }
    if (user.banned) {
      return NextResponse.json({ error: `Conta banida: ${user.banReason || "Violação dos termos"}` }, { status: 403 });
    }
    if (user.deleted) {
      return NextResponse.json({ error: "Conta excluída." }, { status: 403 });
    }

    const chars = (await jsonDb.getCharactersByUserId(user.id)).sort((a: any, b: any) =>
      (a.createdAt || "").localeCompare(b.createdAt || "")
    );
    const main = chars[0] ?? null;
    const mailboxCount = main ? await jsonDb.countUnclaimedMails(main.id) : 0;

    return NextResponse.json({
      userId: user.id,
      username: user.username,
      role: user.role,
      locale: user.locale,
      hasCharacter: chars.length > 0,
      character: main,
      characters: chars.map((c: any) => ({
        id: c.id, name: c.name, level: c.level, classType: c.classType,
        sex: c.sex, power: c.power, currentRegion: c.currentRegion,
      })),
      mailboxCount,
    });
  } catch (e: unknown) {
    console.error("Auth/me error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** POST — Login, Register ou Logout (action-based) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || "login");

    // ── LOGOUT ──
    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res);
      return res;
    }

    // ── REGISTER ──
    if (action === "register") {
      const { username, password } = body;
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
      const uname = username.trim().toLowerCase();
      const existing = await jsonDb.findUserByUsername(uname);
      if (existing) {
        return NextResponse.json({ error: "Nome de usuário já está em uso" }, { status: 409 });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await jsonDb.insertUser({ username: uname, password: hashed, role: "player", locale: "pt-BR", banned: false, deleted: false });
      const res = NextResponse.json({ userId: user.id, username: user.username });
      setSessionCookie(res, user.id);
      return res;
    }

    // ── LOGIN (padrão) ──
    const { username, password } = body;
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
      return NextResponse.json({ error: "Conta excluída." }, { status: 403 });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }
    await jsonDb.updateUser(user.id, { lastLogin: new Date().toISOString() });
    const chars = (await jsonDb.getCharactersByUserId(user.id)).sort((a: any, b: any) =>
      (a.createdAt || "").localeCompare(b.createdAt || "")
    );
    const main = chars[0] ?? null;
    const mailboxCount = main ? await jsonDb.countUnclaimedMails(main.id) : 0;

    const res = NextResponse.json({
      userId: user.id, username: user.username, role: user.role, locale: user.locale,
      hasCharacter: chars.length > 0, character: main,
      characters: chars.map((c: any) => ({
        id: c.id, name: c.name, level: c.level, classType: c.classType,
        sex: c.sex, power: c.power, currentRegion: c.currentRegion,
      })),
      mailboxCount,
    });
    setSessionCookie(res, user.id);
    return res;
  } catch (e: unknown) {
    console.error("Auth error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
