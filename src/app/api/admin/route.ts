import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import jsonDb from "@/db/repo";
import { SKIN_CATALOG, skinById } from "@/game/skins";
import { CLASS_BASE_STATS, powerCalc, REGIONS } from "@/game/constants";
import type { ClassName } from "@/game/constants";

// Admin auth middleware
async function checkAdmin(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  const validKey = process.env.ADMIN_KEY || "PereiraAdmin2026@";
  return adminKey === validKey;
}

const MUSIC_EXT = [".mp3", ".ogg", ".wav", ".m4a", ".webm"];

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "dashboard";

  try {
    if (action === "dashboard") {
      const usersList = await jsonDb.listUsers();
      const charsList = await jsonDb.listCharacters();
      const guildsList = await jsonDb.listGuilds();
      const excluded = await jsonDb.listExcludedUsers();
      return NextResponse.json({
        users: usersList.length,
        characters: charsList.length,
        guilds: guildsList.length,
        excluded: excluded.length,
      });
    }

    if (action === "users") {
      const search = url.searchParams.get("search") || "";
      const allUsers = await jsonDb.listUsers(search, 50);
      const result = await Promise.all(allUsers.map(async (u: any) => {
        const chars = await jsonDb.getCharactersByUserId(u.id);
        return { ...u, characters: chars };
      }));
      return NextResponse.json({ users: result });
    }

    if (action === "excluded") {
      const excluded = await jsonDb.listExcludedUsers();
      const result = await Promise.all(excluded.map(async (e: any) => {
        const user = await jsonDb.findUserById(e.userId);
        return { ...e, stillExists: !!user, user: user || null };
      }));
      return NextResponse.json({ excluded: result });
    }

    if (action === "characters") {
      const search = url.searchParams.get("search") || "";
      const allChars = await jsonDb.listCharacters(search, 50);
      return NextResponse.json({ characters: allChars });
    }

    if (action === "guilds") {
      const allGuilds = await jsonDb.listGuilds(50);
      return NextResponse.json({ guilds: allGuilds });
    }

    if (action === "skins") {
      const search = url.searchParams.get("search") || "";
      const allChars = await jsonDb.listCharacters(search, 50);
      const characters = await Promise.all(
        allChars.map(async (c: any) => {
          const full = await jsonDb.findCharacterById(c.id);
          return {
            id: c.id,
            name: c.name,
            level: c.level,
            classType: c.classType || "warrior",
            skins: (full?.skins || []) as string[],
          };
        })
      );
      return NextResponse.json({ characters, count: SKIN_CATALOG.length });
    }

    if (action === "audio") {
      const regionAudio = await jsonDb.listRegionAudio();
      return NextResponse.json({
        regions: REGIONS.map((r) => r.id),
        regionIcons: Object.fromEntries(REGIONS.map((r) => [r.id, r.icon])),
        audio: regionAudio,
      });
    }

    if (action === "items") {
      const items = await jsonDb.getAllItemTemplates();
      return NextResponse.json({ items });
    }

    if (action === "settings") {
      const settings = await jsonDb.getServerSettings();
      return NextResponse.json({ settings });
    }

    if (action === "codes") {
      const codes = await jsonDb.listCodes();
      return NextResponse.json({ codes });
    }

    if (action === "reports") {
      const reports = await jsonDb.listReports();
      return NextResponse.json({ reports });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    console.error("Admin error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};
    let files: FormData | null = null;

    if (contentType.includes("multipart/form-data")) {
      files = await req.formData();
      for (const [k, v] of files.entries()) {
        if (typeof v === "string") body[k] = v;
      }
    } else {
      body = await req.json();
    }
    const { action } = body;
    if (action === "edit_character") {
      const { characterId, updates } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const allowed = ["gold","diamonds","crystals","energy","maxEnergy","pvpCoins","guildCoins",
        "towerCoins","level","hp","maxHp","attack","defense","speed","critical","power","vipLevel",
        "towerFloor","pvpRating","banned","currentRegion"];

      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates as Record<string, unknown>)) {
        if (allowed.includes(k)) clean[k] = v;
      }

      if (Object.keys(clean).length === 0) {
        return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
      }

      const updated = await jsonDb.updateCharacter(String(characterId), clean);
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, updated: updated });
    }

    if (action === "reset_attributes") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const base = CLASS_BASE_STATS[(char.classType as ClassName) ?? "warrior"] ?? CLASS_BASE_STATS.warrior;
      const level = Math.max(1, Number(char.level) || 1);
      const patch: Record<string, unknown> = {
        hp: base.hp,
        maxHp: base.hp,
        mana: base.mana,
        maxMana: base.mana,
        attack: base.attack,
        defense: base.defense,
        speed: base.speed,
        critical: base.critical,
        precision: 5,
        dodge: 5,
        resistance: 5,
        unspentStatPoints: Math.max(0, level - 1) * 3,
        power: powerCalc({
          attack: base.attack,
          defense: base.defense,
          hp: base.hp,
          speed: base.speed,
          critical: base.critical,
          level,
        }),
        lastActivity: new Date().toISOString(),
      };

      const updated = await jsonDb.updateCharacter(String(characterId), patch);
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, character: updated, message: "Atributos resetados para o padrão da classe!" });
    }

    if (action === "grant_stat_points") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const level = Math.max(1, Number(char.level) || 1);
      const add = level * 3;
      const updated = await jsonDb.updateCharacter(String(characterId), {
        unspentStatPoints: (Number(char.unspentStatPoints) || 0) + add,
        lastActivity: new Date().toISOString(),
      });
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, character: updated, granted: add, message: `${add} pontos de status concedidos (3 × Lv.${level})!` });
    }

    if (action === "edit_user") {
      const { userId, updates } = body;
      if (!userId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const allowed = ["banned","banReason","role","vipLevel"];
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates as Record<string, unknown>)) {
        if (allowed.includes(k)) clean[k] = v;
      }

      if (Object.keys(clean).length === 0) {
        return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
      }
      // Ao banir: guarda motivo/data. Ao desbanir: limpa a punição.
      if (clean.banned === true) {
        clean.banReason = clean.banReason || "Violação dos termos";
        clean.bannedAt = new Date().toISOString();
      } else if (clean.banned === false) {
        clean.banReason = null;
        clean.bannedAt = null;
      }

      const updated = await jsonDb.updateUser(String(userId), { ...clean, updatedAt: new Date().toISOString() });
      if (!updated) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, updated: updated });
    }

    // ---- Excluir / recuperar / excluir de vez contas ----

    if (action === "delete_user") {
      const { userId, reason } = body;
      if (!userId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const done = await jsonDb.excludeUser(String(userId), String(reason || ""));
      if (!done) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, excluded: done, message: "Conta excluída (soft delete) — recuperável em Excluídos." });
    }

    if (action === "restore_user") {
      const { userId } = body;
      if (!userId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const restored = await jsonDb.restoreUser(String(userId));
      if (!restored) return NextResponse.json({ error: "Usuário não encontrado em users.json" }, { status: 404 });
      return NextResponse.json({ success: true, message: "Conta restaurada! O jogador pode fazer login novamente." });
    }

    if (action === "delete_user_hard") {
      const { userId } = body;
      if (!userId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const res = await jsonDb.hardDeleteUser(String(userId));
      return NextResponse.json({ success: true, deletedCharacters: res.deletedCharacters, message: "Conta excluída permanentemente." });
    }

    if (action === "reset_password") {
      const { userId, password } = body;
      if (!userId || !password || String(password).length < 4) {
        return NextResponse.json({ error: "Senha deve ter no mínimo 4 caracteres" }, { status: 400 });
      }
      await jsonDb.resetUserPassword(String(userId), String(password));
      return NextResponse.json({ success: true, message: "Senha redefinida com sucesso!" });
    }
    // ---- Música por ilha (upload pelo Admin) ----

    if (action === "upload_region_music") {
      if (!files) return NextResponse.json({ error: "Envie um arquivo de áudio" }, { status: 400 });
      const regionId = String(body.regionId || "");
      const region = REGIONS.find((r) => r.id === regionId);
      if (!region) return NextResponse.json({ error: "Ilha inválida" }, { status: 400 });

      const file = files.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
      }
      const ext = path.extname(file.name).toLowerCase();
      if (!MUSIC_EXT.includes(ext)) {
        return NextResponse.json({ error: `Formato inválido. Use: ${MUSIC_EXT.join(", ")}` }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
        return NextResponse.json({ error: "Arquivo inválido ou maior que 25MB" }, { status: 400 });
      }

      const dir = path.join(process.cwd(), "public", "uploads", "music");
      await fs.mkdir(dir, { recursive: true });
      const fileName = `${regionId}${ext}`;
      await fs.writeFile(path.join(dir, fileName), buffer);

      await jsonDb.upsertRegionAudio(regionId, {
        fileName,
        url: `/uploads/music/${fileName}`,
        uploadedAt: new Date().toISOString(),
        by: "admin",
      });

      return NextResponse.json({ success: true, url: `/uploads/music/${fileName}`, message: "Música enviada para a ilha!" });
    }

    if (action === "remove_region_music") {
      const { regionId } = body;
      if (!regionId) return NextResponse.json({ error: "ID da ilha necessário" }, { status: 400 });
      const rec = await jsonDb.getRegionAudioByRegion(String(regionId));
      if (rec) {
        try {
          await fs.unlink(path.join(process.cwd(), "public", "uploads", "music", rec.fileName || ""));
        } catch { /* arquivo já não existe */ }
      }
      await jsonDb.removeRegionAudio(String(regionId));
      return NextResponse.json({ success: true, message: "Música da ilha removida." });
    }

    // ---- QR Code do Donate (upload pelo Admin) ----
    if (action === "upload_donate_qr") {
      if (!files) return NextResponse.json({ error: "Envie um arquivo de imagem" }, { status: 400 });
      const file = files.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
      }
      const ext = path.extname(file.name).toLowerCase();
      const IMG_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
      if (!IMG_EXT.includes(ext)) {
        return NextResponse.json({ error: `Formato inválido. Use: ${IMG_EXT.join(", ")}` }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Arquivo inválido ou maior que 10MB" }, { status: 400 });
      }
      const dir = path.join(process.cwd(), "public", "uploads", "donate");
      await fs.mkdir(dir, { recursive: true });
      const fileName = `donate_qr_${randomUUID()}${ext}`;
      await fs.writeFile(path.join(dir, fileName), buffer);

      const url = `/uploads/donate/${fileName}`;
      const settings = await jsonDb.updateServerSettings({ donateQrCode: url });
      return NextResponse.json({ success: true, url, donateQrCode: settings.donateQrCode, message: "QR Code de donate atualizado!" });
    }

    // --- Skins (SKIN FULL) ---

    if (action === "give_skin") {
      const { characterId, skinId } = body;
      if (!characterId || !skinId) {
        return NextResponse.json({ error: "Dados necessários" }, { status: 400 });
      }
      const template = skinById(String(skinId));
      if (!template) return NextResponse.json({ error: "Skin não encontrada" }, { status: 404 });

      const updated = await jsonDb.addCharacterSkins(String(characterId), [template.id]);
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, skin: template.id });
    }

    if (action === "remove_skin") {
      const { characterId, skinId } = body;
      if (!characterId || !skinId) {
        return NextResponse.json({ error: "Dados necessários" }, { status: 400 });
      }
      const updated = await jsonDb.removeCharacterSkin(String(characterId), String(skinId));
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, skin: String(skinId) });
    }

    if (action === "give_all_skins") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const updated = await jsonDb.addCharacterSkins(String(characterId), SKIN_CATALOG.map((s) => s.id));
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, count: SKIN_CATALOG.length });
    }

    // --- Skins via CORREIO (presente do ADM → aparece no correio do jogador) ---

    if (action === "send_skin_mail") {
      const { characterId, skinId, note } = body;
      if (!characterId || !skinId) {
        return NextResponse.json({ error: "Dados necessários" }, { status: 400 });
      }
      const template = skinById(String(skinId));
      if (!template) return NextResponse.json({ error: "Skin não encontrada" }, { status: 404 });
      const sent = await jsonDb.sendSkinMail(String(characterId), template.id, "ADM", String(note || ""));
      if (!sent) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, mailId: sent.id });
    }

    if (action === "send_all_skins_mail") {
      const { characterId, note } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      let count = 0;
      for (const s of SKIN_CATALOG) {
        const sent = await jsonDb.sendSkinMail(String(characterId), s.id, "ADM", String(note || ""));
        if (sent) count++;
      }
      return NextResponse.json({ success: true, count });
    }

    // --- Enviar recursos / itens / skins (quantidade escolhida) para o correio ---

    if (action === "send_package") {
      const { characterId, kind, resource, templateId, skinId, quantity, note } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      let sent;
      if (kind === "resource") {
        sent = await jsonDb.sendResourceMail(String(characterId), String(resource || ""), qty, "ADM", String(note || ""));
        if (!sent) return NextResponse.json({ error: "Recurso inválido" }, { status: 400 });
      } else if (kind === "item") {
        sent = await jsonDb.sendMail(String(characterId), Number(templateId), qty, "ADM", String(note || ""));
        if (!sent) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
      } else if (kind === "skin") {
        const template = skinById(String(skinId || ""));
        if (!template) return NextResponse.json({ error: "Skin não encontrada" }, { status: 404 });
        sent = await jsonDb.sendSkinMail(String(characterId), template.id, "ADM", String(note || ""));
        if (!sent) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      } else {
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
      }
      return NextResponse.json({ success: true, mailId: sent.id });
    }

    // ---- Mensagem global / manutenção (anúncio para todos os jogadores) ----

    if (action === "update_server_settings") {
      const { announcement, maintenance, maintenanceMessage, announcementStyle } = body;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (typeof announcement === "string") {
        const trimmed = announcement.trim();
        patch.announcement = trimmed;
        // A cada envio/atualização de mensagem gera um id único → o cliente
        // mostra a "notificação popup" apenas UMA vez (mensagem única).
        patch.announcementId = trimmed ? randomUUID() : "";
      }
      if (
        typeof announcementStyle === "string" &&
        ["banner", "popup"].includes(announcementStyle)
      ) {
        patch.announcementStyle = announcementStyle;
      }
      if (typeof maintenance === "boolean") patch.maintenance = maintenance;
      if (typeof maintenanceMessage === "string") patch.maintenanceMessage = maintenanceMessage;
      if (typeof body.donatePixKey === "string") patch.donatePixKey = body.donatePixKey.trim();
      if (typeof body.donateQrCode === "string") patch.donateQrCode = body.donateQrCode.trim();
      const saved = await jsonDb.updateServerSettings(patch);
      return NextResponse.json({ success: true, settings: saved });
    }

    // ---- Códigos de resgate (gerar / excluir) ----

    function genCode(len = 10): string {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = "";
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }

    if (action === "create_code") {
      const { code, xpHours, energyHours, label, maxUses, expiresDays } = body;
      const xpH = Math.max(0, Math.floor(Number(xpHours) || 0));
      const energyH = Math.max(0, Math.floor(Number(energyHours) || 0));
      if (xpH <= 0 && energyH <= 0) {
        return NextResponse.json({ error: "Informe horas de boost XP e/ou Energia (maior que 0)." }, { status: 400 });
      }
      const codeValue = String(code || "").trim().toUpperCase() || genCode();
      if (String(codeValue).length < 4) {
        return NextResponse.json({ error: "Código deve ter no mínimo 4 caracteres." }, { status: 400 });
      }
      const existing = await jsonDb.findCodeByCodeValue(codeValue);
      if (existing) {
        return NextResponse.json({ error: "Já existe um código com esse valor." }, { status: 409 });
      }
      const expiresDaysNum = Math.max(0, Number(expiresDays) || 0);
      const rec = await jsonDb.createCode({
        code: codeValue,
        xpHours: xpH,
        energyHours: energyH,
        label: String(label || "").trim() || "Boost 2x",
        maxUses: Math.max(0, Math.floor(Number(maxUses) || 0)),
        expiresAt: expiresDaysNum > 0
          ? new Date(Date.now() + expiresDaysNum * 24 * 3600 * 1000).toISOString()
          : null,
        redeemedBy: [],
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, code: rec, message: `Código gerado: ${codeValue}` });
    }

    if (action === "delete_code") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const done = await jsonDb.deleteCode(String(id));
      if (!done) return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, message: "Código excluído." });
    }

    // ---- Reportes (bug / feedback) ----

    if (action === "delete_report") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const done = await jsonDb.deleteReport(String(id));
      if (!done) return NextResponse.json({ error: "Reporte não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, message: "Reporte excluído." });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    console.error("Admin POST error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    if (characterId) {
      const existing = await jsonDb.findCharacterById(String(characterId));
      if (!existing) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      await jsonDb.deleteCharacter(String(characterId));
      return NextResponse.json({ success: true, message: "Personagem removido" });
    }

    return NextResponse.json({ error: "ID necessário" }, { status: 400 });
  } catch (e: unknown) {
    console.error("Admin DELETE error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}