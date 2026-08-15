import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import jsonDb from "@/db/repo";

/*
 * Autenticação por sessão (cookie httpOnly + JWT).
 *
 * ANTES: o cliente mandava `userId`/`characterId` no corpo e o servidor confiava
 * cegamente — qualquer um podia agir sobre o personagem de outro jogador.
 * AGORA: o login emite um JWT assinado num cookie httpOnly (`roe_session`), e as
 * rotas validam a sessão + a propriedade do personagem antes de qualquer ação.
 *
 * - httpOnly: o token não é legível por JavaScript (imune a XSS).
 * - sameSite=lax: impede envio cross-site (CSRF).
 * - secure: só envia por HTTPS em produção.
 */

export const SESSION_COOKIE = "roe_session";
export const ADMIN_COOKIE = "roe_admin";

/** 30 dias de sessão (acompanha a persistência do cliente). */
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

let _fallbackSecret: string | null = null;

/**
 * Segredo de assinatura: SESSION_SECRET (recomendado) → ADMIN_KEY → aleatório
 * por processo (apenas dev, com aviso). NUNCA use o fallback em produção.
 */
function secret(): string {
  const fromEnv = process.env.SESSION_SECRET || process.env.ADMIN_KEY;
  if (fromEnv) return fromEnv;
  if (!_fallbackSecret) {
    _fallbackSecret = `dev-fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[auth] SESSION_SECRET/ADMIN_KEY não configurados — usando segredo aleatório de dev. " +
        "Defina SESSION_SECRET no .env para sessões estáveis."
      );
    }
  }
  return _fallbackSecret;
}

export interface SessionPayload {
  /** id do usuário (uuid). */
  sub: string;
  role: string;
}

function signSession(userId: string, role = "player"): string {
  return jwt.sign({ sub: userId, role }, secret(), { expiresIn: SESSION_TTL_SEC });
}

function verifySession(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, secret()) as jwt.JwtPayload;
    if (!payload?.sub) return null;
    return { sub: String(payload.sub), role: String(payload.role || "player") };
  } catch {
    return null;
  }
}

/** Lê e valida a sessão do jogador a partir do cookie da requisição. */
export function getSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Exige uma sessão válida; devolve erro 401 caso contrário. */
export function requireSession(
  req: NextRequest
): { ok: true; session: SessionPayload } | { ok: false; response: NextResponse } {
  const session = getSession(req);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  return { ok: true, session };
}

/**
 * Exige sessão válida E que o `characterId` informado pertença ao usuário
 * autenticado. Retorna o personagem carregado (evita re-busca nas rotas).
 */
export async function requireCharacterAuth(
  req: NextRequest,
  characterId: string | null | undefined
): Promise<
  | { ok: true; char: any; session: SessionPayload }
  | { ok: false; response: NextResponse }
> {
  const sess = requireSession(req);
  if (!sess.ok) return sess;

  if (!characterId) {
    return { ok: false, response: NextResponse.json({ error: "Dados inválidos" }, { status: 400 }) };
  }

  const char = await jsonDb.findCharacterById(String(characterId));
  if (!char) {
    return { ok: false, response: NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 }) };
  }

  // Personagem sem dono (dado antigo) ou de outro usuário → negado.
  if (!char.userId || String(char.userId) !== String(sess.session.sub)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }

  return { ok: true, char, session: sess.session };
}

/** Grava o cookie de sessão do jogador na resposta. */
export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, signSession(userId, "player"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

/** Remove o cookie de sessão (logout). */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/* ─── Admin (cookie separado, função exclusiva de admin) ─── */

function isAdminPayload(p: SessionPayload | null): p is SessionPayload & { role: "admin" } {
  return !!p && p.role === "admin";
}

/** Valida a sessão do admin a partir do cookie `roe_admin`. */
export function getAdminSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  return isAdminPayload(payload) ? payload : null;
}

/** Grava o cookie de sessão do admin (maxAge opcional p/ "lembrar de mim"). */
export function setAdminCookie(res: NextResponse, maxAge?: number): void {
  res.cookies.set(ADMIN_COOKIE, signSession("admin", "admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  });
}

/** Remove o cookie de sessão do admin. */
export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
