import { NextRequest, NextResponse } from "next/server";

/**
 * Login do painel admin.
 *
 * ANTES: a chave ficava hardcoded no cliente (bundle JS público) — qualquer
 * visitante conseguia ler a senha de administrador no código da página.
 * AGORA: a chave é validada SOMENTE no servidor (env ADMIN_KEY). O navegador
 * guarda a chave digitada em memória (ou localStorage se "lembrar de mim") e
 * a envia no header `x-admin-key` nas próximas chamadas.
 */
export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (!key || typeof key !== "string") {
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

    return NextResponse.json({ ok: true });
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
