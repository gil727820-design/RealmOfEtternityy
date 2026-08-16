import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { seasonPatch } from "@/game/season";

import {
  WAR_DURATION_HOURS,
  WAR_DECLARE_MIN_GUILD_LEVEL,
  WAR_DECLARE_COOLDOWN_MS,
  warDeclareCost,
  activeWar,
  applyWarAttack,
  applyWarDefend,
  resolveGuildWar,
  guildWarStatus,
  warCanAct,
  type GuildWar,
} from "@/game/guildWars";

/** Remove a guerra dos dois lados (marca resolvida para não resolver 2x). */
async function clearWarBothSides(guildId: string, enemyId: string, result: any) {
  const patch = { war: null, lastWarResult: result, lastWarEndedAt: new Date().toISOString() };
  await jsonDb.updateGuild(guildId, patch);
  await jsonDb.updateGuild(enemyId, { war: null, lastWarResult: result, lastWarEndedAt: new Date().toISOString() });
}

/**
 * Se a guerra do lado desta guilda expirou, resolve e aplica as recompensas
 * (prêmio em dobro pro vencedor, XP de guilda, pontos de guerra). Retorna o
 * resultado se algo foi resolvido agora.
 */
async function maybeResolveWar(guild: any): Promise<any | null> {
  const w = guild?.war as GuildWar | undefined;
  if (!w || w.resolved) return null;
  const now = Date.now();
  if (new Date(w.endsAt).getTime() > now) return null;

  const enemy = await jsonDb.findGuildById(String(w.enemyId));
  if (!enemy) {
    await jsonDb.updateGuild(String(guild.id), { war: null, lastWarEndedAt: new Date().toISOString() });
    return null;
  }

  // Resolve com os dados espelhados dos dois lados.
  const result = resolveGuildWar(guild, enemy);
  const winnerGuild = result.winnerId ? (result.winnerId === String(guild.id) ? guild : enemy) : null;

  // Marca resolvido ANTES de aplicar para evitar correr 2x em chamadas paralelas.
  await clearWarBothSides(String(guild.id), String(enemy.id), result);

  if (winnerGuild && !result.draw) {
    const cost = warDeclareCost(Number(winnerGuild.level) || 1);
    const prize = cost * 2;
    const warPoints = 1 + Math.floor((Number(winnerGuild.level) || 1) / 5);
    await jsonDb.updateGuild(String(winnerGuild.id), {
      gold: (Number(winnerGuild.gold) || 0) + prize,
      warPoints: (Number(winnerGuild.warPoints) || 0) + warPoints,
    });
    // XP de guilda pela vitória.
    await jsonDb.updateGuild(String(winnerGuild.id), {
      xp: (Number(winnerGuild.xp) || 0) + 60,
    });
    await jsonDb.insertGuildChatMessage({
      guildId: String(winnerGuild.id),
      characterId: "system",
      name: "Sistema",
      text: `🏆 Sua guilda VENCEU a guerra contra ${result.winnerId === String(guild.id) ? enemy.name : guild.name}! +${prize} de ouro e +${warPoints} pontos de guerra.`,
    });
  } else {
    // Empate — devolve o prêmio declarado para cada lado.
    const cost = warDeclareCost(Number(guild.level) || 1);
    await jsonDb.updateGuild(String(guild.id), { gold: (Number(guild.gold) || 0) + cost });
    await jsonDb.updateGuild(String(enemy.id), { gold: (Number(enemy.gold) || 0) + cost });
  }

  return { ...result, resolvedAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const guild = await jsonDb.findGuildByMemberId(String(characterId));
    if (!guild) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 404 });

    // Resolve guerra expirada antes de responder.
    const resolved = await maybeResolveWar(guild);

    const war = activeWar(guild);
    let enemy: any = null;
    if (war) {
      enemy = await jsonDb.findGuildById(String(war.enemyId));
    }
    const status = guildWarStatus(guild);
    if (status.active && status.war) {
      status.war.canAct = warCanAct(guild, String(characterId));
      status.war.memberDmg =
        war?.participants?.find((p) => p.characterId === String(characterId))?.dmg || 0;
    }

    // Guildas candidatas a guerra (sem guerra ativa, não é a própria).
    const allGuilds = await jsonDb.listGuilds(100);
    const candidates = allGuilds
      .filter((g: any) => String(g.id) !== String(guild.id) && !activeWar(g) && g.id && g.name)
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        icon: g.icon || "🏰",
        level: g.level || 1,
        memberCount: Array.isArray(g.members) ? g.members.length : 0,
        power: Array.isArray(g.members)
          ? g.members.reduce((s: number, m: any) => s + (Number(m.power) || 0), 0)
          : 0,
      }))
      .sort((a: any, b: any) => b.power - a.power);

    const myRank = (guild.members || []).find((m: any) => m.id === String(characterId))?.rank || "member";
    const declareCost = warDeclareCost(Number(guild.level) || 1);

    return NextResponse.json({
      guildId: String(guild.id),
      guildName: guild.name,
      guildLevel: guild.level || 1,
      myRank,
      declareCost,
      canDeclare: myRank === "leader" || myRank === "officer",
      minLevel: WAR_DECLARE_MIN_GUILD_LEVEL,
      cooldownUntil: guild.lastWarEndedAt
        ? new Date(new Date(guild.lastWarEndedAt).getTime() + WAR_DECLARE_COOLDOWN_MS).toISOString()
        : null,
      warPoints: Number(guild.warPoints) || 0,
      war: status,
      enemy: enemy
        ? {
            id: enemy.id,
            name: enemy.name,
            icon: enemy.icon || "🏰",
            level: enemy.level || 1,
            memberCount: Array.isArray(enemy.members) ? enemy.members.length : 0,
          }
        : null,
      candidates,
      lastWarResult: guild.lastWarResult || null,
      resolvedNow: resolved,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Guild war GET error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, characterId } = body;
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const guild = await jsonDb.findGuildByMemberId(String(characterId));
    if (!guild) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 404 });

    // Sempre resolve guerra expirada antes de qualquer ação.
    await maybeResolveWar(guild);

    // ---------- DECLARAR guerra ----------
    if (action === "declare") {
      const enemyId = body.enemyId ? String(body.enemyId) : "";
      const myRank = (guild.members || []).find((m: any) => m.id === String(characterId))?.rank;
      if (myRank !== "leader" && myRank !== "officer") {
        return NextResponse.json({ error: "Apenas o líder ou oficiais podem declarar guerra" }, { status: 403 });
      }
      if ((Number(guild.level) || 1) < WAR_DECLARE_MIN_GUILD_LEVEL) {
        return NextResponse.json(
          { error: `Sua guilda precisa ser nível ${WAR_DECLARE_MIN_GUILD_LEVEL}+` },
          { status: 400 }
        );
      }
      if (activeWar(guild)) return NextResponse.json({ error: "Sua guilda já está em guerra" }, { status: 400 });
      if (guild.lastWarEndedAt && Date.now() - new Date(guild.lastWarEndedAt).getTime() < WAR_DECLARE_COOLDOWN_MS) {
        return NextResponse.json({ error: "A guilda está em cooldown para declarar guerra" }, { status: 400 });
      }
      if (!enemyId) return NextResponse.json({ error: "Escolha uma guilda inimiga" }, { status: 400 });
      const enemy = await jsonDb.findGuildById(enemyId);
      if (!enemy) return NextResponse.json({ error: "Guilda inimiga não encontrada" }, { status: 404 });
      if (activeWar(enemy)) return NextResponse.json({ error: "A guilda inimiga já está em guerra" }, { status: 400 });

      const cost = warDeclareCost(Number(guild.level) || 1);
      if ((Number(guild.gold) || 0) < cost) {
        return NextResponse.json(
          { error: `O banco da guilda precisa de ${cost} de ouro para declarar guerra` },
          { status: 400 }
        );
      }

      const endsAt = new Date(Date.now() + WAR_DURATION_HOURS * 3600_000).toISOString();
      const nowIso = new Date().toISOString();
      const warState: GuildWar = {
        enemyId: String(enemy.id),
        enemyName: String(enemy.name),
        startedAt: nowIso,
        endsAt,
        declaredBy: String(characterId),
        dmgDealt: 0,
        dmgTaken: 0,
        repaired: 0,
        participants: [],
        cooldowns: {},
      };
      await jsonDb.updateGuild(String(guild.id), { gold: (Number(guild.gold) || 0) - cost, war: warState });
      await jsonDb.updateGuild(String(enemy.id), { war: { ...warState, enemyId: String(guild.id), enemyName: String(guild.name) } });
      await jsonDb.insertGuildChatMessage({
        guildId: String(guild.id),
        characterId: "system",
        name: "Sistema",
        text: `⚔️ Guerra declarada contra ${enemy.name}! Duração: ${WAR_DURATION_HOURS}h.`,
      });
      await jsonDb.insertGuildChatMessage({
        guildId: String(enemy.id),
        characterId: "system",
        name: "Sistema",
        text: `⚔️ ${guild.name} declarou guerra contra a sua guilda! Defendam a fortaleza!`,
      });
      return NextResponse.json({ success: true, war: warState });
    }

    // ---------- ATACAR a fortaleza inimiga ----------
    if (action === "attack") {
      const war = activeWar(guild);
      if (!war) return NextResponse.json({ error: "Sua guilda não está em guerra" }, { status: 400 });
      const enemy = await jsonDb.findGuildById(String(war.enemyId));
      if (!enemy) return NextResponse.json({ error: "Guilda inimiga não encontrada" }, { status: 404 });

      const result = applyWarAttack(guild, String(characterId), char.name, Number(char.power) || 0);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

      // Espelha o dano na guilda inimiga (dmgTaken dela).
      const enemyWar = (enemy.war || {}) as GuildWar;
      await jsonDb.updateGuild(String(enemy.id), {
        war: {
          ...enemyWar,
          dmgTaken: (Number(enemyWar.dmgTaken) || 0) + result.dmg,
        },
      });
      const updated = await jsonDb.updateGuild(String(guild.id), { war: result.war });
      // Temporada global: ataque na guerra de guildas dá pontos de temporada.
      await jsonDb.updateCharacter(String(characterId), seasonPatch(char, "war"));

      // Se a fortaleza inimiga caiu, encerra a guerra na hora (vitória).
      const { fortressHpCurrent } = await import("@/game/guildWars");
      if (fortressHpCurrent({ ...enemy, war: { ...enemyWar, dmgTaken: (Number(enemyWar.dmgTaken) || 0) + result.dmg } }) <= 0) {
        const forced = { ...result.war, endsAt: new Date(Date.now() + 1000).toISOString() };
        await jsonDb.updateGuild(String(guild.id), { war: forced });
        await jsonDb.updateGuild(String(enemy.id), { war: { ...enemyWar, endsAt: forced.endsAt } });
        await maybeResolveWar(await jsonDb.findGuildById(String(guild.id)));
      }

      return NextResponse.json({
        success: true,
        dmg: result.dmg,
        war: guildWarStatus(updated).war,
      });
    }

    // ---------- DEFENDER a própria fortaleza ----------
    if (action === "defend") {
      const war = activeWar(guild);
      if (!war) return NextResponse.json({ error: "Sua guilda não está em guerra" }, { status: 400 });

      const result = applyWarDefend(guild, String(characterId), char.name, Number(char.power) || 0);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

      // O reparo reduz o dano recebido — espelha reduzindo o dmgDealt do inimigo.
      const enemy = await jsonDb.findGuildById(String(war.enemyId));
      if (enemy) {
        const enemyWar = (enemy.war || {}) as GuildWar;
        await jsonDb.updateGuild(String(enemy.id), {
          war: {
            ...enemyWar,
            dmgDealt: Math.max(0, (Number(enemyWar.dmgDealt) || 0) - result.heal),
          },
        });
      }
      const updated = await jsonDb.updateGuild(String(guild.id), { war: result.war });
      // Temporada global: defesa na guerra de guildas dá pontos de temporada.
      await jsonDb.updateCharacter(String(characterId), seasonPatch(char, "war"));
      return NextResponse.json({
        success: true,
        heal: result.heal,
        war: guildWarStatus(updated).war,
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Guild war POST error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
