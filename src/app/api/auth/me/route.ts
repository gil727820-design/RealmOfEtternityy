import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { getSession } from "@/game/auth";

/**
 * Restaura a sessão a partir do cookie httpOnly (`roe_session`) sem exigir
 * login de novo. O cliente chama esta rota ao abrir o jogo: se houver cookie
 * válido, devolve os mesmos dados do login; senão, 401 → tela de login.
 *
 * ANTES: o estado (personagem/inventário) era restaurado do localStorage,
 * causando dados velhos ("cache") que não refletiam o servidor.
 * AGORA: nada de dados de jogo no cache — tudo é recarregado do banco.
 */
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
      return NextResponse.json(
        { error: `Conta banida: ${user.banReason || "Violação dos termos"}` },
        { status: 403 }
      );
    }
    if (user.deleted) {
      return NextResponse.json(
        { error: "Conta excluída. Caso ache que foi um engano, contate a administração." },
        { status: 403 }
      );
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
  } catch (e: unknown) {
    console.error("Auth/me error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
