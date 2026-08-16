import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import {
  GUILD_UPGRADES,
  getGuildUpgrades,
  upgradeCost,
  guildMaxMembers,
  guildLevelStatus,
  type GuildUpgrades,
} from "@/game/guildLevels";
import { syncGuildBuffsToCharacter, syncGuildBuffsToAllMembers } from "@/game/guildActivity";

const MAX_MEMBERS = 10;

// Limites da foto da guilda (salva como Data URL base64 direto no banco).
const MAX_LOGO_RAW_BYTES = 4 * 1024 * 1024; // 4MB de imagem bruta (o cliente já redimensiona)
const MAX_LOGO_DATA_LEN = 7 * 1024 * 1024; // teto do Data URL base64

/** Cria o "cartão" de membro a partir do personagem. */
async function memberSnapshot(char: any, rank: string) {
  return {
    id: char.id,
    name: char.name,
    classType: char.classType || "warrior",
    sex: char.sex || "male",
    level: char.level || 1,
    power: char.power || 0,
    rank,
    joinedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    const guilds = await jsonDb.listGuilds(100);

    if (!characterId) {
      return NextResponse.json({
        guilds: guilds.map((g: any) => ({ ...g, memberCount: Array.isArray(g.members) ? g.members.length : 0 })),
      });
    }

    // Só o dono pode ver as guildas na perspectiva do próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const myGuild = guilds.find((g: any) => {
      const members = Array.isArray(g.members) ? g.members : [];
      return members.some((m: any) => m.id === String(characterId));
    }) || null;

    // Convites que o personagem RECEBEU ainda pendentes (para entrar em uma guilda)
    const myInvites = await jsonDb.getPendingInvitesForCharacter(String(characterId));
    // Se eu sou líder, quais pedidos aguardam aprovação na minha guilda
    const isMyLeader = !!myGuild && (myGuild.members as any[]).some((m: any) => m.id === String(characterId) && m.rank === "leader");
    const guildRequests = isMyLeader ? await jsonDb.getPendingInvitesForGuild(String(myGuild.id)) : [];

    const publicGuilds = guilds.map((g: any) => ({
      ...g,
      memberCount: Array.isArray(g.members) ? g.members.length : 0,
      pendingRequest: !isMyLeader && myInvites.some((i: any) => i.guildId === g.id),
      membership: myGuild ? String(g.id) === String(myGuild.id) : false,
    }));

    // Status da guilda evolutiva (nível, XP, melhorias e buffs) para a UI.
    const guildStatus = myGuild ? guildLevelStatus(myGuild) : null;

    return NextResponse.json({
      guilds: publicGuilds,
      guild: myGuild,
      guildStatus,
      myInvites,
      guildRequests,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    // Suporta JSON e multipart (upload da foto da guilda).
    let body: Record<string, unknown> = {};
    let logoFile: File | null = null;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") body[k] = v;
        else if (v instanceof File) logoFile = v;
      }
    } else {
      body = await req.json();
    }
    const { action } = body;

    // Todas as ações de guilda agem em nome de um personagem — exige sessão e
    // que o personagem pertença ao usuário autenticado (exceto upload_logo, que
    // valida por sessão + membro abaixo).
    const actorId = body.characterId ? String(body.characterId) : "";
    let actorChar: any = null;
    if (action !== "upload_logo") {
      if (!actorId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });
      const auth = await requireCharacterAuth(req, actorId);
      if (!auth.ok) return auth.response;
      actorChar = auth.char;
    }

    // ---------- UPLOAD da foto da guilda ----------
    // A logo é salva como Data URL (base64) direto no banco (Postgres/Supabase),
    // sem gravar arquivos no disco — funciona em qualquer hospedagem (inclusive
    // serverless, onde public/uploads é somente leitura).
    if (action === "upload_logo") {
      let logoData = typeof body.logoData === "string" ? String(body.logoData) : "";

      // Compatibilidade: aceita também envio multipart (File) e converte em base64.
      if (!logoData && logoFile) {
        const bytes = Buffer.from(await logoFile.arrayBuffer());
        if (bytes.byteLength > MAX_LOGO_RAW_BYTES) {
          return NextResponse.json({ error: "Imagem muito grande (máx. 4MB)" }, { status: 400 });
        }
        const mime = logoFile.type && logoFile.type.startsWith("image/") ? logoFile.type : "image/png";
        logoData = `data:${mime};base64,${bytes.toString("base64")}`;
      }

      if (!logoData) return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
      if (!logoData.startsWith("data:image/")) {
        return NextResponse.json({ error: "O arquivo deve ser uma imagem" }, { status: 400 });
      }
      if (logoData.length > MAX_LOGO_DATA_LEN) {
        return NextResponse.json({ error: "Imagem muito grande (máx. 4MB)" }, { status: 400 });
      }

      const guildId = body.guildId ? String(body.guildId) : "";
      if (guildId) {
        // Só membro da guilda pode trocar a foto (e o painel envia characterId).
        const auth = await requireCharacterAuth(req, body.characterId ? String(body.characterId) : "");
        if (!auth.ok) return auth.response;
        const guild = await jsonDb.findGuildById(guildId);
        if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
        const isMember = (Array.isArray(guild.members) ? guild.members : []).some(
          (m: any) => m.id === String(body.characterId)
        );
        if (!isMember) {
          return NextResponse.json({ error: "Você não é membro desta guilda" }, { status: 403 });
        }
        const updated = await jsonDb.updateGuild(guildId, { logo: logoData });
        return NextResponse.json({ success: true, logo: logoData, url: logoData, guild: updated });
      }

      // Sem guildId: usado durante a criação — a logo é gravada junto com a guilda.
      return NextResponse.json({ success: true, logo: logoData, url: logoData });
    }

    // ---------- CRIAR guilda ----------
    if (action === "create") {
      const { characterId, name, icon, description } = body;
      if (!characterId || !name || String(name).trim().length < 3) {
        return NextResponse.json({ error: "O nome da guilda deve ter pelo menos 3 caracteres" }, { status: 400 });
      }
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      if (char.guildId) return NextResponse.json({ error: "Você já está em uma guilda" }, { status: 400 });
      if ((char.level || 0) < 5) return NextResponse.json({ error: "Requer nível 5+" }, { status: 400 });
      if ((char.gold || 0) < 1000) return NextResponse.json({ error: "Requer 1.000 de ouro" }, { status: 400 });

      const leader = await memberSnapshot(char, "leader");
      const guild = await jsonDb.insertGuild({
        name: String(name).trim().slice(0, 20),
        description: String(description || "").trim().slice(0, 120),
        icon: String(icon || "🏰").trim().slice(0, 4) || "🏰",
        logo: String((body.logo as string) || "").slice(0, MAX_LOGO_DATA_LEN),
        members: [leader],
        level: 1,
        gold: 0,
        maxMembers: MAX_MEMBERS,
        createdAt: new Date().toISOString(),
      });
      await jsonDb.updateCharacter(char.id, { guildId: guild.id, guildRank: "leader", gold: (char.gold || 0) - 1000 });
      return NextResponse.json({ success: true, guild });
    }

    // ---------- DOAR ouro para o banco da guilda ----------
    if (action === "donate") {
      const { characterId, guildId, amount } = body;
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
      const isMember = (Array.isArray(guild.members) ? guild.members : []).some((m: any) => m.id === String(characterId));
      if (!isMember) return NextResponse.json({ error: "Você não é membro desta guilda" }, { status: 403 });

      const qty = Math.floor(Number(amount));
      if (!Number.isFinite(qty) || qty < 100) {
        return NextResponse.json({ error: "Doe pelo menos 100 de ouro" }, { status: 400 });
      }
      if ((char.gold || 0) < qty) {
        return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
      }

      await jsonDb.updateCharacter(char.id, { gold: (char.gold || 0) - qty });
      const updatedGuild = await jsonDb.updateGuild(String(guildId), {
        gold: (Number(guild.gold) || 0) + qty,
      });
      await jsonDb.insertGuildChatMessage({
        guildId: String(guildId),
        characterId: "system",
        name: "Sistema",
        text: `${char.name} doou ${qty} de ouro para o banco da guilda.`,
      });
      return NextResponse.json({ success: true, gold: (Number(guild.gold) || 0) + qty, guild: updatedGuild });
    }

    // ---------- MELHORAR guilda (gasta ouro do banco) ----------
    if (action === "upgrade") {
      const { characterId, guildId, upgradeId } = body;
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

      // Só o líder (ou oficial) pode melhorar a guilda.
      const isLeaderOrOfficer = (Array.isArray(guild.members) ? guild.members : []).some(
        (m: any) => m.id === String(characterId) && (m.rank === "leader" || m.rank === "officer")
      );
      if (!isLeaderOrOfficer) {
        return NextResponse.json({ error: "Apenas o líder ou oficiais podem melhorar a guilda" }, { status: 403 });
      }

      const def = GUILD_UPGRADES.find((u) => u.id === upgradeId);
      if (!def) return NextResponse.json({ error: "Melhoria inválida" }, { status: 400 });

      const upgrades = getGuildUpgrades(guild);
      const currentLevel = upgrades[def.id as keyof GuildUpgrades];
      if (currentLevel >= def.maxLevel) {
        return NextResponse.json({ error: "Esta melhoria já está no nível máximo" }, { status: 400 });
      }

      const cost = upgradeCost(def, currentLevel);
      if ((Number(guild.gold) || 0) < cost) {
        return NextResponse.json(
          { error: `O banco da guilda precisa de ${cost} de ouro (dê uma doação!)` },
          { status: 400 }
        );
      }

      const newUpgrades = { ...upgrades, [def.id]: currentLevel + 1 };
      const updatedGuild = await jsonDb.updateGuild(String(guildId), {
        upgrades: newUpgrades,
        gold: (Number(guild.gold) || 0) - cost,
      });
      // Atualiza o snapshot de buffs de TODOS os membros (novo buff vale na hora).
      await syncGuildBuffsToAllMembers(updatedGuild);
      await jsonDb.insertGuildChatMessage({
        guildId: String(guildId),
        characterId: "system",
        name: "Sistema",
        text: `${char.name} melhorou ${def.nameKey} para nível ${currentLevel + 1}!`,
      });
      return NextResponse.json({
        success: true,
        guild: updatedGuild,
        status: guildLevelStatus(updatedGuild),
      });
    }

    // ---------- SAIR / EXPULSAR ----------
    if (action === "leave" || action === "kick") {
      const { characterId, guildId, targetId } = body;
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

      const members = (Array.isArray(guild.members) ? guild.members : []) as any[];
      const isLeave = action === "leave";
      const leavingId = String(isLeave ? characterId : targetId);
      const target = members.find((m) => m.id === leavingId);
      if (!target) return NextResponse.json({ error: "Membro não encontrado" }, { status: 400 });

      const isLeader = members.some((m) => m.id === String(characterId) && m.rank === "leader");

      if (!isLeave && !isLeader) {
        return NextResponse.json({ error: "Apenas o líder pode expulsar" }, { status: 403 });
      }
      if (isLeave && isLeader && members.length > 1) {
        return NextResponse.json({ error: "O líder deve transferir a liderança antes de sair" }, { status: 400 });
      }

      if (!isLeave) {
        await jsonDb.insertGuildChatMessage({ guildId: String(guildId), characterId: "system", name: "Sistema", text: `${target.name} foi expulso da guilda.` });
      }

      const nextMembers = members.filter((m) => m.id !== leavingId);
      if (nextMembers.length === 0) {
        await jsonDb.deleteGuild(String(guildId));
        await jsonDb.updateCharacter(leavingId, { guildId: null, guildRank: null });
        return NextResponse.json({ success: true, dissolved: true });
      }

      await jsonDb.updateGuild(String(guildId), { members: nextMembers });
      await jsonDb.updateCharacter(leavingId, { guildId: null, guildRank: null, guildBuffs: null });
      return NextResponse.json({ success: true, guild: await jsonDb.findGuildById(String(guildId)) });
    }

    // ---------- TRANSFERIR liderança ----------
    if (action === "transfer") {
      const { characterId, guildId, targetId } = body;
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
      const members = (Array.isArray(guild.members) ? guild.members : []) as any[];
      if (!members.some((m) => m.id === String(characterId) && m.rank === "leader")) {
        return NextResponse.json({ error: "Apenas o líder pode transferir" }, { status: 403 });
      }
      const targetChar = await jsonDb.findCharacterById(String(targetId));
      if (!targetChar) return NextResponse.json({ error: "Destinatário não encontrado" }, { status: 404 });
      if (!members.some((m) => m.id === String(targetId))) {
        return NextResponse.json({ error: "O destinatário não é membro" }, { status: 400 });
      }
      await jsonDb.updateGuild(String(guildId), {
        members: members.map((m) =>
          m.id === String(characterId) ? { ...m, rank: "member" }
          : m.id === String(targetId) ? { ...m, rank: "leader" }
          : m
        ),
      });
      await jsonDb.updateCharacter(String(characterId), { guildRank: "member" });
      await jsonDb.updateCharacter(String(targetId), { guildRank: "leader" });
      return NextResponse.json({ success: true, guild: await jsonDb.findGuildById(String(guildId)) });
    }
// ---------- SOLICITAR entrada (pedido ao líder) ----------
    if (action === "invite") {
      const { characterId, guildId } = body;
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      if (char.guildId) return NextResponse.json({ error: "Você já está em uma guilda" }, { status: 400 });
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
      const members = (Array.isArray(guild.members) ? guild.members : []) as any[];
      const memberLimit = guildMaxMembers(Number(guild.level) || 1);
      if (members.length >= memberLimit) return NextResponse.json({ error: "Guilda cheia" }, { status: 400 });
      if (await jsonDb.hasPendingGuildInvite(char.id, String(guildId))) {
        return NextResponse.json({ error: "Você já solicitou entrada nesta guilda" }, { status: 400 });
      }
      const leader = members.find((m) => m.rank === "leader");
      const invite = await jsonDb.insertGuildInvite({
        guildId: String(guildId),
        guildName: String(guild.name),
        targetCharacterId: char.id,
        targetName: char.name,
        leaderCharacterId: leader ? leader.id : null,
      });
      return NextResponse.json({ success: true, invite });
    }

    // ---------- LÍDER aceita/recusa pedido ----------
    if (action === "accept" || action === "decline") {
      const { inviteId, characterId } = body;
      const invite = await jsonDb.getGuildInviteById(String(inviteId));
      if (!invite) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
      if (invite.status) return NextResponse.json({ error: "Pedido já resolvido" }, { status: 400 });
      const guild = await jsonDb.findGuildById(String(invite.guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não existe mais" }, { status: 404 });

      if (action === "decline") {
        await jsonDb.updateGuildInvite(invite.id, { status: "declined", resolvedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, declined: true });
      }

      const members = (Array.isArray(guild.members) ? guild.members : []) as any[];
      if (!members.some((m: any) => m.id === String(characterId) && m.rank === "leader")) {
        return NextResponse.json({ error: "Apenas o líder pode aceitar pedidos" }, { status: 403 });
      }
      if (members.length >= guildMaxMembers(Number(guild.level) || 1)) {
        await jsonDb.updateGuildInvite(invite.id, { status: "declined", resolvedAt: new Date().toISOString() });
        return NextResponse.json({ error: "Guilda cheia" }, { status: 400 });
      }
      const targetChar = await jsonDb.findCharacterById(String(invite.targetCharacterId));
      if (!targetChar) return NextResponse.json({ error: "Solicitante não encontrado" }, { status: 404 });
      if (targetChar.guildId) return NextResponse.json({ error: "O jogador já entrou em outra guilda" }, { status: 400 });

      const snapshot = await memberSnapshot(targetChar, "member");
      await jsonDb.updateGuild(guild.id, { members: [...members, snapshot] });
      await jsonDb.updateCharacter(targetChar.id, { guildId: guild.id, guildRank: "member" });
      await jsonDb.updateGuildInvite(invite.id, { status: "accepted", resolvedAt: new Date().toISOString() });
      await jsonDb.insertGuildChatMessage({ guildId: String(guild.id), characterId: "system", name: "Sistema", text: `${targetChar.name} entrou na guilda.` });
      // Grava o snapshot dos buffs atuais da guilda no novo membro.
      const acceptedGuild = await jsonDb.findGuildById(String(guild.id));
      if (acceptedGuild) await syncGuildBuffsToCharacter(targetChar.id, acceptedGuild);
      return NextResponse.json({ success: true, guild: await jsonDb.findGuildById(guild.id) });
    }
// ---------- JOGADOR aceita/recusa CONVITE recebido ----------
    if (action === "my_accept" || action === "my_decline") {
      const { inviteId, characterId } = body;
      const invite = await jsonDb.getGuildInviteById(String(inviteId));
      if (!invite) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
      if (invite.status) return NextResponse.json({ error: "Convite já resolvido" }, { status: 400 });
      if (invite.targetCharacterId !== characterId) {
        return NextResponse.json({ error: "Este convite não é seu" }, { status: 403 });
      }
      if (action === "my_decline") {
        await jsonDb.updateGuildInvite(invite.id, { status: "declined", resolvedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, declined: true });
      }
      const guild = await jsonDb.findGuildById(String(invite.guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não existe mais" }, { status: 404 });
      const members = (Array.isArray(guild.members) ? guild.members : []) as any[];
      if (members.length >= guildMaxMembers(Number(guild.level) || 1)) return NextResponse.json({ error: "Guilda cheia" }, { status: 400 });
      const targetChar = await jsonDb.findCharacterById(String(characterId));
      if (!targetChar) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      if (targetChar.guildId) return NextResponse.json({ error: "Você já está em uma guilda" }, { status: 400 });

      const snapshot = await memberSnapshot(targetChar, "member");
      await jsonDb.updateGuild(guild.id, { members: [...members, snapshot] });
      await jsonDb.updateCharacter(targetChar.id, { guildId: guild.id, guildRank: "member" });
      await jsonDb.updateGuildInvite(invite.id, { status: "accepted", resolvedAt: new Date().toISOString() });
      await jsonDb.insertGuildChatMessage({ guildId: String(guild.id), characterId: "system", name: "Sistema", text: `${targetChar.name} entrou na guilda.` });
      // Grava o snapshot dos buffs atuais da guilda no novo membro.
      const joinedGuild = await jsonDb.findGuildById(String(guild.id));
      if (joinedGuild) await syncGuildBuffsToCharacter(targetChar.id, joinedGuild);
      return NextResponse.json({ success: true, guild: await jsonDb.findGuildById(guild.id) });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Guild error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}