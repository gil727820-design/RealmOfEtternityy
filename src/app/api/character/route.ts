import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jsonDb from "@/db/repo";
import { requireCharacterAuth, getSession, setSessionCookie, clearSessionCookie } from "@/game/auth";
import { isValidUsername } from "@/game/profanityFilter";
import { xpForLevel, powerCalc, resolveMaxLevel, CLASS_BASE_STATS } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, xpMultiplier, goldMultiplier } from "@/game/boosts";

/** GET — Buscar personagem por ID ou verificar sessão (auth/me) */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || url.searchParams.get("characterId");
    const action = url.searchParams.get("action");

    // ── AUTH/ME: verificar sessão ──
    if (!id || action === "me") {
      const session = getSession(req);
      if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      const user = await jsonDb.findUserById(session.sub);
      if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });
      if (user.banned) return NextResponse.json({ error: `Conta banida: ${user.banReason || "Violação dos termos"}` }, { status: 403 });
      if (user.deleted) return NextResponse.json({ error: "Conta excluída." }, { status: 403 });
      const chars = (await jsonDb.getCharactersByUserId(user.id)).sort((a: any, b: any) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      const main = chars[0] ?? null;
      const mailboxCount = main ? await jsonDb.countUnclaimedMails(main.id) : 0;
      return NextResponse.json({
        userId: user.id, username: user.username, role: user.role, locale: user.locale,
        hasCharacter: chars.length > 0, character: main,
        characters: chars.map((c: any) => ({ id: c.id, name: c.name, level: c.level, classType: c.classType, sex: c.sex, power: c.power, currentRegion: c.currentRegion })),
        mailboxCount,
      });
    }

    // ── Buscar personagem por ID ──
    const char = await jsonDb.findCharacterById(id);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    return NextResponse.json(char);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

/** POST — Todas as ações de personagem */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    // Aceita action tanto na URL quanto no corpo (o frontend usa ?action=...);
    // a URL tem precedência para nunca colidir com sub-comandos no body.
    const action = String(url.searchParams.get("action") || body?.action || "");

    // ── CREATE ──
    if (action === "create") {
      const { userId, name, classType, sex } = body;
      if (!userId || !name || !classType) {
        return NextResponse.json({ error: "userId, name e classType obrigatórios" }, { status: 400 });
      }
      const chars = await jsonDb.getCharactersByUserId(userId);
      if (chars.length >= 3) {
        return NextResponse.json({ error: "Máximo 3 personagens por conta" }, { status: 400 });
      }
      const existing = chars.find((c: any) => c.name?.toLowerCase() === name.toLowerCase());
      if (existing) {
        return NextResponse.json({ error: "Já existe um personagem com esse nome" }, { status: 409 });
      }
      const baseStats = CLASS_BASE_STATS[classType as keyof typeof CLASS_BASE_STATS] || { hp: 100, attack: 10, defense: 10, speed: 5, mana: 50, critical: 3 };
      const newChar = await jsonDb.insertCharacter({
        userId, name, classType, sex: sex || "male",
        level: 1, xp: 0, xpToNext: xpForLevel(1),
        hp: baseStats.hp, maxHp: baseStats.hp,
        mana: baseStats.mana, maxMana: baseStats.mana,
        attack: baseStats.attack, defense: baseStats.defense,
        speed: baseStats.speed, critical: baseStats.critical,
        dodge: 5, precision: 5,
        energy: 100, maxEnergy: 100,
        gold: 500, diamonds: 0, crystals: 0,
        towerCoins: 0, towerFloor: 1,
        pvpCoins: 0, pvpRating: 0, pvpLeague: "bronze",
        power: powerCalc({ attack: baseStats.attack, defense: baseStats.defense, hp: baseStats.hp, speed: baseStats.speed, critical: baseStats.critical, level: 1 }),
        skills: {}, talents: {}, collection: {}, bestiary: {},
        achievements: [], titles: [], activeTitle: null,
        activeRelicId: null, activePetId: null, pets: [], skins: [],
        currentRegion: "starter_village",
        lastActivity: new Date().toISOString(),
        lastEnergyAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, character: newChar });
    }

    // ── ALLOCATE (distribute stat points) ──
    if (action === "allocate") {
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      const char = auth.char;
      const { stat, qty } = body;
      const points = Number(qty) || 1;
      if (Number(char.unspentStatPoints || 0) < points) {
        return NextResponse.json({ error: "Pontos insuficientes" }, { status: 400 });
      }
      const validStats = ["attack", "defense", "hp", "speed", "critical"];
      if (!validStats.includes(stat)) {
        return NextResponse.json({ error: "Stat inválido" }, { status: 400 });
      }
      const patch: any = { unspentStatPoints: (char.unspentStatPoints || 0) - points };
      if (stat === "hp") { patch.maxHp = (char.maxHp || 100) + points * 5; patch.hp = (char.hp || 100) + points * 5; }
      else { patch[stat] = (char[stat] || 0) + points; }
      patch.power = powerCalc({ attack: patch.attack ?? char.attack, defense: patch.defense ?? char.defense, hp: patch.maxHp ?? char.maxHp, speed: patch.speed ?? char.speed, critical: patch.critical ?? char.critical, level: char.level });
      const updated = await jsonDb.updateCharacter(char.id, patch);
      return NextResponse.json({ success: true, character: updated });
    }

    // ── SKILL (invest skill point) ──
    if (action === "skill") {
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      const char = auth.char;
      const { skillId } = body;
      if (!skillId) return NextResponse.json({ error: "skillId obrigatório" }, { status: 400 });
      if (Number(char.skillPoints || 0) < 1) {
        return NextResponse.json({ error: "Sem pontos de habilidade" }, { status: 400 });
      }
      const skills = { ...(char.skills || {}) };
      const current = Number(skills[skillId]) || 0;
      if (current >= 5) return NextResponse.json({ error: "Habilidade no máximo" }, { status: 400 });
      skills[skillId] = current + 1;
      const updated = await jsonDb.updateCharacter(char.id, { skills, skillPoints: (char.skillPoints || 0) - 1 });
      return NextResponse.json({ success: true, character: updated });
    }

    // ── PRESTIGE (reset for prestige bonuses) ──
    if (action === "prestige") {
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      const char = auth.char;
      const settings = await jsonDb.getServerSettings();
      const maxLevel = resolveMaxLevel(Number(settings?.maxLevel) || 0);
      if ((char.level || 1) < maxLevel) {
        return NextResponse.json({ error: `Precisa estar no nível máximo (${maxLevel})` }, { status: 400 });
      }
      const newPrestige = (char.prestige || 0) + 1;
      const updated = await jsonDb.updateCharacter(char.id, {
        level: 1, xp: 0, xpToNext: xpForLevel(1),
        prestige: newPrestige,
        unspentStatPoints: 0, skillPoints: 0, skills: {},
        power: 10,
      });
      return NextResponse.json({ success: true, character: updated, prestige: newPrestige });
    }

    // ── RESET STATS ──
    if (action === "reset-stats") {
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      const char = auth.char;
      const baseStats = CLASS_BASE_STATS[(char.classType as keyof typeof CLASS_BASE_STATS) || "warrior"];
      const pointsSpent = ((char.attack || 0) - baseStats.attack + (char.defense || 0) - baseStats.defense + (char.speed || 0) - baseStats.speed + (char.critical || 0) - baseStats.critical + Math.floor(((char.maxHp || 100) - baseStats.hp) / 5));
      const refund = Math.max(0, pointsSpent);
      const updated = await jsonDb.updateCharacter(char.id, {
        attack: baseStats.attack, defense: baseStats.defense, speed: baseStats.speed,
        critical: baseStats.critical, maxHp: baseStats.hp, hp: baseStats.hp,
        unspentStatPoints: (char.unspentStatPoints || 0) + refund,
      });
      return NextResponse.json({ success: true, character: updated, refundedPoints: refund });
    }

    // ── CHANGE CLASS ──
    if (action === "change-class") {
      const auth = await requireCharacterAuth(req, body.characterId);
      if (!auth.ok) return auth.response;
      const char = auth.char;
      const { newClass } = body;
      if (!newClass) return NextResponse.json({ error: "newClass obrigatório" }, { status: 400 });
      const allClasses = ["warrior","paladin","berserker","mage","necromancer","assassin","hunter","monk","samurai","knight","summoner","templar","archer"];
      if (!allClasses.includes(newClass)) return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
      const cost = 5000 + (char.level || 1) * 100;
      if ((char.gold || 0) < cost) {
        return NextResponse.json({ error: `Ouro insuficiente. Necessário: ${cost.toLocaleString()}` }, { status: 400 });
      }
      const baseStats = CLASS_BASE_STATS[newClass as keyof typeof CLASS_BASE_STATS];
      const updated = await jsonDb.updateCharacter(char.id, {
        classType: newClass,
        gold: (char.gold || 0) - cost,
        attack: baseStats.attack, defense: baseStats.defense, speed: baseStats.speed,
        critical: baseStats.critical, maxHp: baseStats.hp, hp: baseStats.hp,
        maxMana: baseStats.mana, mana: baseStats.mana,
        unspentStatPoints: (char.level || 1) * 3 - 3,
        skillPoints: Math.floor((char.level || 1) / 3),
        skills: {},
      });
      return NextResponse.json({ success: true, character: updated });
    }

    // ── SELECT CHARACTER ──
    if (action === "select") {
      const session = getSession(req);
      if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "characterId obrigatório" }, { status: 400 });
      const char = await jsonDb.findCharacterById(characterId);
      if (!char || char.userId !== session.sub) {
        return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      }
      const regen = computeEnergyRegen(char, new Date(), energyMultiplier(char));
      const updated = await jsonDb.updateCharacter(characterId, {
        energy: regen.energy, lastEnergyAt: regen.lastEnergyAt,
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, character: updated });
    }

    // ── AUTH: logout ──
    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res);
      return res;
    }
    // ── AUTH: register ──
    if (action === "register") {
      const { username, password } = body;
      const validation = isValidUsername(username);
      if (!validation.valid) return NextResponse.json({ error: validation.reason }, { status: 400 });
      if (!password || password.length < 4) return NextResponse.json({ error: "Senha deve ter mínimo 4 caracteres" }, { status: 400 });
      if (password.length > 50) return NextResponse.json({ error: "Senha muito longa" }, { status: 400 });
      const uname = username.trim().toLowerCase();
      const existing = await jsonDb.findUserByUsername(uname);
      if (existing) return NextResponse.json({ error: "Nome de usuário já está em uso" }, { status: 409 });
      const hashed = await bcrypt.hash(password, 10);
      const user = await jsonDb.insertUser({ username: uname, password: hashed, role: "player", locale: "pt-BR", banned: false, deleted: false });
      const r = NextResponse.json({ userId: user.id, username: user.username });
      setSessionCookie(r, user.id);
      return r;
    }
    // ── AUTH: login (padrão) ──
    if (action === "login" || (!action && body.username && body.password)) {
      const { username, password } = body;
      if (!username || !password) return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
      const uname = username.trim().toLowerCase();
      const user = await jsonDb.findUserByUsername(uname);
      if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      if (user.banned) return NextResponse.json({ error: `Conta banida: ${user.banReason || "Violação dos termos"}` }, { status: 403 });
      if (user.deleted) return NextResponse.json({ error: "Conta excluída." }, { status: 403 });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
      await jsonDb.updateUser(user.id, { lastLogin: new Date().toISOString() });
      const chars = (await jsonDb.getCharactersByUserId(user.id)).sort((a: any, b: any) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      const main = chars[0] ?? null;
      const mailboxCount = main ? await jsonDb.countUnclaimedMails(main.id) : 0;
      const r = NextResponse.json({
        userId: user.id, username: user.username, role: user.role, locale: user.locale,
        hasCharacter: chars.length > 0, character: main,
        characters: chars.map((c: any) => ({ id: c.id, name: c.name, level: c.level, classType: c.classType, sex: c.sex, power: c.power, currentRegion: c.currentRegion })),
        mailboxCount,
      });
      setSessionCookie(r, user.id);
      return r;
    }

    // ── INVENTORY: equip ──
    if (action === "equip") {
      const mod = await import("@/game/api-handlers/inventory-equip");
      return mod.POST(req);
    }
    // ── INVENTORY: sell ──
    if (action === "sell") {
      const mod = await import("@/game/api-handlers/inventory-sell");
      return mod.POST(req);
    }
    // ── INVENTORY: use ──
    if (action === "use") {
      const mod = await import("@/game/api-handlers/inventory-use");
      return mod.POST(req);
    }
    // ── INVENTORY: auto-equip ──
    if (action === "auto-equip") {
      const mod = await import("@/game/api-handlers/inventory-auto-equip");
      return mod.POST(req);
    }
    // ── INVENTORY: skin ──
    if (action === "skin") {
      const mod = await import("@/game/api-handlers/inventory-skin");
      return mod.POST(req);
    }
    // ── INVENTORY: remove ──
    if (action === "remove") {
      const mod = await import("@/game/api-handlers/inventory-remove");
      return mod.POST(req);
    }

    return NextResponse.json({ error: "Action inválida" }, { status: 400 });
  } catch (e: unknown) {
    console.error("Character error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
