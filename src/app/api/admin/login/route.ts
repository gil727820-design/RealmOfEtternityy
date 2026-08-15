import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/game/auth";

/**
 * Login do painel admin.
 *
 * ANTES: a chave ficava hardcoded no cliente (bundle JS público) — qualquer
 * visitante conseguia ler a senha de administrador no código da página.
 * DEPOIS: a chave é validada SOMENTE no servidor (env ADMIN_KEY) e a sessão
 * vira um cookie httpOnly (`roe_admin`), assinado com a ADMIN_KEY. O navegador
 * NÃO guarda mais a chave (nem em memória, nem em localStorage).
 *
 * Body: { key, rememberMe } — rememberMe define se o cookie persiste 30 dias
 * (sessão de navegador) para não pedir a chave nas próximas visitas.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === "string" ? body.key : "";
    const rememberMe = !!body?.rememberMe;
    if (!key) {
      return NextResponse.json({ error: "Chave obrigatória" }, { status: 400 });
    }

    const validKey = process.env.ADMIN_KEY;
    if (!validKey) {
      console.error("[ADMIN] ADMIN_KEY não configurada no servidor — defina no .env");
      return NextResponse.json(
        { error: "ADMIN_KEY não configurada no servidor. Defina no .env e reinicie." },
        { status: 503 }
      );
    }

    // Comparação em tempo constante evita ataques de timing.
    if (!safeEqual(key, validKey)) {
      return NextResponse.json({ error: "Chave inválida" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    setAdminCookie(res, rememberMe ? 30 * 24 * 3600 : undefined);
    return res;
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
