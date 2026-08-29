import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import jsonDb from "@/db/repo";
import { getAdminSession } from "@/game/auth";
import { SKIN_CATALOG, skinById } from "@/game/skins";
import { VIP_TIERS, vipTierById } from "@/game/vip";
import { PET_DEFS, petById, grantPetPatch } from "@/game/pets";
import { ADVANCED_CLASSES, advancedClassForClass } from "@/game/advancedClasses";
import { ASCENSION_MAX } from "@/game/ascension";
import { seasonInfo } from "@/game/season";
import { CLASS_BASE_STATS, powerCalc, REGIONS } from "@/game/constants";
import { equipmentBonus } from "@/game/forge";
import { totalSetBonus } from "@/game/sets";
import type { ClassName } from "@/game/constants";

// Admin auth middleware
// A chave vem SOMENTE do env ADMIN_KEY (nunca hardcoded). Se não configurada,
// o painel recusa o acesso — não existe senha padrão que funcione em produção.
//
// Aceita (em ordem):
//   1. cookie httpOnly `roe_admin` (novo padrão — a chave não fica mais no
//      navegador/localStorage; o /api/admin/login grava esse cookie);
//   2. header `x-admin-key` (compatibilidade com sessões antigas).
async function checkAdmin(req: NextRequest) {
  const session = getAdminSession(req);
  if (session) return true;
  const adminKey = req.headers.get("x-admin-key");
  const validKey = process.env.ADMIN_KEY;
  if (!validKey) return false;
  return adminKey === validKey;
}

const MUSIC_EXT = [".mp3", ".ogg", ".wav", ".m4a", ".webm"];

/** Soma os bônus de todos os itens equipados (forja + encanto + sets) de um personagem. */
async function equippedBonuses(characterId: string, level: number) {
  let atk = 0, def = 0, hp = 0, spd = 0, crit = 0;
  const inv = await jsonDb.getInventoryForCharacter(characterId);
  for (const e of inv) {
    if (!e.item?.equipped || e.template?.type === "consumable") continue;
    const b = equipmentBonus(e.template, e.item);
    atk += b.attack;
    def += b.defense;
    hp += b.maxHp;
    spd += b.speed;
    crit += b.critical;
  }
  const setB = totalSetBonus(inv.filter((e: any) => e.item?.equipped), level);
  atk += setB.attack;
  def += setB.defense;
  hp += setB.maxHp;
  crit += setB.critical;
  return { atk, def, hp, spd, crit };
}

async function getServerSettingsData() {
  return jsonDb.getServerSettings();
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "dashboard";

  try {
    if (action === "infinite_energy") {
      const settings = await getServerSettingsData();
      return NextResponse.json({ infiniteEnergy: !!settings.infiniteEnergy });
    }

    if (action === "dashboard") {
      const usersList = await jsonDb.listUsers();
      const charsList = await jsonDb.listCharacters();
      const guildsList = await jsonDb.listGuilds();
      const excluded = await jsonDb.listExcludedUsers();
      // Estatísticas extras
      const onlineCount = await jsonDb.countRecentlyActive(3);
      const recentLogs = await jsonDb.listAdminLogs(undefined, 20);
      return NextResponse.json({
        users: usersList.length,
        characters: charsList.length,
        guilds: guildsList.length,
        excluded: excluded.length,
        online: onlineCount,
        logs: recentLogs,
      });
    }

    if (action === "users") {
      const search = url.searchParams.get("search") || "";
      const allUsers = await jsonDb.listUsers(search, 50);
      const result = await Promise.all(allUsers.map(async (u: any) => {
        const chars = await jsonDb.getCharactersByUserId(u.id);
        // Nunca expõe senha (nem o hash bcrypt, nem qualquer resíduo de texto puro).
        const { password, passwordPlain, ...safe } = u;
        return { ...safe, characters: chars };
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

    if (action === "inventory") {
      // Inventário de um personagem (para o admin remover/ajustar itens).
      const characterId = url.searchParams.get("characterId") || "";
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(characterId);
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const inventory = await jsonDb.getInventoryForCharacter(characterId);
      return NextResponse.json({
        character: { id: char.id, name: char.name, level: char.level },
        inventory,
      });
    }

    if (action === "settings") {
      const settings = await jsonDb.getServerSettings();
      // serverTime/serverOffsetMinutes: relógio do SERVIDOR, para o admin
      // calibrar os horários dos eventos (o agendamento usa hora do servidor;
      // se o servidor estiver em outro fuso que não o do admin, os horários
      // "HH:MM" configurados abrem em horas diferentes das esperadas).
      return NextResponse.json({
        settings,
        serverTime: new Date().toISOString(),
        serverOffsetMinutes: -new Date().getTimezoneOffset(),
      });
    }

    if (action === "codes") {
      const codes = await jsonDb.listCodes();
      return NextResponse.json({ codes });
    }

    if (action === "logs") {
      // Logs administrativos (ex.: avisos de hitkill da torre / boss mundial).
      const kind = url.searchParams.get("kind") || "";
      const sourceArg = url.searchParams.get("source") || "";
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 100));
      const logs = await jsonDb.listAdminLogs(kind || undefined, limit, sourceArg || undefined);
      return NextResponse.json({ logs });
    }

    if (action === "world_boss_report") {
      // Relatório do Boss Mundial para o painel: ranking de dano dos
      // participantes do evento ATUAL + logs de hitkill com source "world-boss".
      const { sanitizeWorldBossConfig } = await import("@/game/worldBoss");
      const settings = await jsonDb.getServerSettings();
      const cfg = sanitizeWorldBossConfig(settings?.worldBoss);
      const event = settings?.worldBossEvent ?? null;

      const participants: Array<Record<string, unknown>> = event?.participants
        ? Object.values(event.participants)
            .map((p: any) => ({
              characterId: p.characterId,
              name: p.name,
              level: p.level,
              classType: p.classType,
              damageDealt: Number(p.damageDealt) || 0,
              hits: Number(p.hits) || 0,
              hp: Math.round(Number(p.hp) || 0),
              maxHp: Math.round(Number(p.maxHp) || 0),
              deadAt: p.deadAt ?? null,
            }))
            .sort((a: any, b: any) => Number(b.damageDealt) - Number(a.damageDealt))
        : [];

      // Top 3 de dano (medalhas 1/2/3).
      const top3 = participants.slice(0, 3);

      // Rotula com o dano "%" do total (depois de ordenar, o total real = soma).
      const totalD = participants.reduce((s: number, p: any) => s + Number(p.damageDealt || 0), 0);
      const top3WithShare = top3.map((p: any) => ({
        ...p,
        sharePct: totalD > 0 ? Math.round((Number(p.damageDealt) / totalD) * 100) : 0,
      }));

      // Logs de hitkill do boss mundial.
      const logs = await jsonDb.listAdminLogs("hitkill", 200, "world-boss");
      // + logs gerais com source world-boss de qualquer tipo.
      const worldBossLogs = await jsonDb.listAdminLogs(undefined, 300, "world-boss");
      const hitkillLogs = logs.filter((l: any) => String(l.source) === "world-boss");

      return NextResponse.json({
        report: {
          enabled: cfg.enabled,
          eventStatus: event?.status ?? null,
          bossHp: Number(event?.bossHp) || 0,
          bossMaxHp: Number(event?.bossMaxHp) || 0,
          totalDamage: Number(event?.totalDamage) || 0,
          participantsCount: participants.length,
          shieldActive: !!event?.shieldActive,
          shieldThreshold: event?.shieldThreshold ?? null,
          participants,
          top3: top3WithShare,
          log: Array.isArray(event?.log) ? event.log.slice(-50) : [],
        },
        hitkillLogs,
        worldBossLogs,
      });
    }

    // ---- Auto-balance Boss Mundial baseado no poder médio dos jogadores ----
    if (action === "auto_balance_worldboss") {
      const allChars = await jsonDb.listCharacters("", 999999);
      if (allChars.length === 0) {
        return NextResponse.json({ error: "Nenhum personagem encontrado" }, { status: 400 });
      }
      const powers = allChars.map((c: any) => powerCalc({
        attack: Number(c.attack) || 0,
        defense: Number(c.defense) || 0,
        hp: Number(c.maxHp) || 0,
        speed: Number(c.speed) || 0,
        critical: Number(c.critical) || 0,
        level: Number(c.level) || 1,
      }));
      const avgPower = powers.reduce((s: number, p: number) => s + p, 0) / powers.length;
      const maxPower = Math.max(...powers);
      const medianPower = powers.sort((a: number, b: number) => a - b)[Math.floor(powers.length / 2)];
      const top20Powers = powers.sort((a: number, b: number) => b - a).slice(0, Math.ceil(powers.length * 0.2));
      const avgTop20 = top20Powers.length > 0 ? top20Powers.reduce((s: number, p: number) => s + p, 0) / top20Powers.length : avgPower;
      
      // Boss baseado nos top 20% (para ser um desafio para os mais fortes)
      const bossMultiplier = 15; // Boss deve ter ~15x o poder médio dos top20
      const avgMaxHp = allChars.reduce((s: number, c: any) => s + (Number(c.maxHp) || 0), 0) / allChars.length;
      const avgAttack = allChars.reduce((s: number, c: any) => s + (Number(c.attack) || 0), 0) / allChars.length;
      const avgDefense = allChars.reduce((s: number, c: any) => s + (Number(c.defense) || 0), 0) / allChars.length;
      const avgSpeed = allChars.reduce((s: number, c: any) => s + (Number(c.speed) || 0), 0) / allChars.length;
      const avgCritical = allChars.reduce((s: number, c: any) => s + (Number(c.critical) || 0), 0) / allChars.length;
      
      // HP: precisa que ~20-30 jogadores consigam matar em 30-45 min
      // Cada jogador dá ~avgAttack * 1.5 de dano por ataque, cooldown 5s
      // Em 30 min = 360 ataques por jogador
      // 20 jogadores * 360 * avgAttack * 1.5 = HP total estimado
      const estimatedDpsPerPlayer = (avgAttack * 1.5) / 5; // dano por segundo
      const targetKillTimeSec = 30 * 60; // 30 minutos
      const estimatedParticipants = Math.max(5, Math.floor(allChars.length * 0.1));
      const suggestedMaxHp = Math.floor(estimatedDpsPerPlayer * targetKillTimeSec * estimatedParticipants);
      
      const suggestedBoss = {
        kind: "void_wyrm",
        maxHp: Math.max(1_000_000, suggestedMaxHp),
        attack: Math.floor(avgAttack * 3),
        defense: Math.floor(avgDefense * 2.5),
        speed: Math.min(15, Math.floor(avgSpeed * 1.5)),
        critical: Math.min(30, Math.floor(avgCritical * 1.5)),
      };
      
      // Recompensas baseadas no poder
      const goldPerPower = 0.5; // 0.5 ouro por ponto de poder
      const xpPerPower = 0.1;
      const suggestedRewards = {
        gold: Math.floor(avgTop20 * goldPerPower * 10),
        xp: Math.floor(avgTop20 * xpPerPower * 10),
        towerCoins: Math.floor(500 + avgTop20 * 0.05),
      };
      
      // Escudo: thresholds baseados na complexidade
      const suggestedShield = {
        enabled: allChars.length > 10,
        thresholds: allChars.length > 20 ? [75, 50, 25] : allChars.length > 10 ? [50, 25] : [25],
        durationSec: 120,
        breakCost: { currency: "diamonds" as const, amount: Math.floor(10 + avgTop20 * 0.001) },
      };
      
      // Mobs baseados no nível médio
      const avgLevel = allChars.reduce((s: number, c: any) => s + (Number(c.level) || 1), 0) / allChars.length;
      const suggestedMobs = {
        enabled: allChars.length > 5,
        kinds: avgLevel > 30 ? ["lich_trono", "invocador_almas", "cavaleiro_corrompido"] : avgLevel > 15 ? ["beholder_vigilancia", "mago_caos", "gargula_ferro"] : ["monstro_esqueleto", "monstro_lobo"],
        hp: Math.floor(avgMaxHp * 0.3),
        count: Math.min(6, Math.max(2, Math.floor(allChars.length / 10))),
        reward: { gold: Math.floor(avgTop20 * 0.1), xp: Math.floor(avgTop20 * 0.02) },
      };
      
      return NextResponse.json({
        success: true,
        stats: {
          totalCharacters: allChars.length,
          avgPower: Math.floor(avgPower),
          maxPower: Math.floor(maxPower),
          medianPower: Math.floor(medianPower),
          avgTop20Power: Math.floor(avgTop20),
          avgLevel: Math.floor(avgLevel),
        },
        suggested: {
          boss: suggestedBoss,
          rewards: suggestedRewards,
          shield: suggestedShield,
          mobs: suggestedMobs,
        },
      });
    }

    if (action === "purchases") {
      const purchases = await jsonDb.listPurchases();
      return NextResponse.json({ purchases });
    }

    if (action === "purchase_ledger") {
      // Livro-razão PERMANENTE de quem comprou e foi aprovado. Backfill: compras
      // já aprovadas que ainda não estão no livro são migradas automaticamente.
      const ledger = await jsonDb.listPurchaseLedger();
      const purchases = await jsonDb.listPurchases();
      const existingPurchaseIds = new Set(ledger.map((e: any) => e.purchaseId));
      let backfilled = 0;
      for (const p of purchases) {
        if (String(p.status) !== "approved") continue;
        if (existingPurchaseIds.has(String(p.id))) continue;
        const char = await jsonDb.findCharacterById(String(p.characterId));
        await jsonDb.appendPurchaseLedger({
          purchaseId: String(p.id),
          characterId: String(p.characterId || ""),
          characterName: String(char?.name || p.characterName || "?"),
          userId: String(p.userId || char?.userId || ""),
          diamonds: Number(p.diamonds) || 0,
          valueBRL: Number(p.valueBRL) || 0,
          approvedAt: String(p.decidedAt || p.createdAt || new Date().toISOString()),
          refunded: false,
          refundedAt: null,
        });
        backfilled++;
      }
      const fresh = backfilled > 0 ? await jsonDb.listPurchaseLedger() : ledger;
      // Lista de personagens atuais para escolher o destino do reembolso.
      const chars = await jsonDb.listCharacters("", 999999);
      return NextResponse.json({
        ledger: fresh,
        backfilled,
        characters: chars.map((c: any) => ({ id: c.id, name: c.name, level: c.level, classType: c.classType })),
      });
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
        "towerCoins","level","xp","hp","maxHp","mana","maxMana","attack","defense","speed","critical",
        "precision","dodge","resistance","power","vipLevel","unspentStatPoints","skillPoints",
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

    if (action === "set_vip") {
      // Ativa um VIP por tier no personagem (30 dias, igual à loja).
      const { characterId, tier } = body;
      if (!characterId || !tier) return NextResponse.json({ error: "Personagem e tier são obrigatórios" }, { status: 400 });
      const tierDef = vipTierById(String(tier));
      if (!tierDef) return NextResponse.json({ error: "Tier VIP inválido" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const until = new Date(Date.now() + tierDef.days * 86400000).toISOString();
      const updated = await jsonDb.updateCharacter(String(characterId), {
        vipTier: tierDef.id,
        vipUntil: until,
        lastActivity: new Date().toISOString(),
      });
      const tierLabel = tierDef.id.charAt(0).toUpperCase() + tierDef.id.slice(1);
      return NextResponse.json({
        success: true,
        character: updated,
        message: `👑 VIP ${tierLabel} ativado para ${char.name} até ${new Date(until).toLocaleString("pt-BR")}!`,
      });
    }

    if (action === "remove_vip") {
      // Remove o VIP do personagem (tier e validade zerados).
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const updated = await jsonDb.updateCharacter(String(characterId), {
        vipTier: null,
        vipUntil: null,
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, character: updated, message: `👑 VIP removido de ${char.name}!` });
    }

    if (action === "reset_attributes") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const base = CLASS_BASE_STATS[(char.classType as ClassName) ?? "warrior"] ?? CLASS_BASE_STATS.warrior;
      const level = Math.max(1, Number(char.level) || 1);
      // Bônus dos itens equipados continuam valendo após o reset.
      const equip = await equippedBonuses(String(characterId), 1);
      const patch: Record<string, unknown> = {
        hp: Math.min(Number(char.hp) || base.hp, base.hp + equip.hp),
        maxHp: base.hp + equip.hp,
        mana: base.mana,
        maxMana: base.mana,
        attack: base.attack + equip.atk,
        defense: base.defense + equip.def,
        speed: base.speed + equip.spd,
        critical: base.critical + equip.crit,
        precision: 5,
        dodge: 5,
        resistance: 5,
        unspentStatPoints: 0,
        power: powerCalc({
          attack: base.attack + equip.atk,
          defense: base.defense + equip.def,
          hp: base.hp + equip.hp,
          speed: base.speed + equip.spd,
          critical: base.critical + equip.crit,
          level,
        }),
        lastActivity: new Date().toISOString(),
      };

      const updated = await jsonDb.updateCharacter(String(characterId), patch);
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, character: updated, message: "Atributos resetados para o padrão da classe e pontos zerados (bônus de itens equipados mantidos)!" });
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

    if (action === "adjust_stats") {
      // Dar OU TIRAR status do personagem: `amount` pode ser negativo
      // (ex.: attack -50, maxHp +2000, xp +500000).
      const { characterId, stat, amount } = body;
      if (!characterId || !stat) return NextResponse.json({ error: "Dados necessários" }, { status: 400 });

      const fieldMap: Record<string, string> = {
        attack: "attack", defense: "defense", speed: "speed", critical: "critical",
        maxHp: "maxHp", mana: "maxMana", precision: "precision", dodge: "dodge",
        resistance: "resistance", energy: "energy", gold: "gold", diamonds: "diamonds",
        crystals: "crystals", towerCoins: "towerCoins", pvpCoins: "pvpCoins",
        guildCoins: "guildCoins", xp: "xp", unspentStatPoints: "unspentStatPoints",
      };
      const field = fieldMap[String(stat)];
      if (!field) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

      const delta = Math.floor(Number(amount) || 0);
      if (delta === 0) return NextResponse.json({ error: "Informe um valor diferente de 0" }, { status: 400 });

      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

      const current = Number(char[field]) || 0;
      const next = Math.max(0, current + delta);
      const patch: Record<string, unknown> = { [field]: next, lastActivity: new Date().toISOString() };
      if (field === "maxHp") patch.hp = Math.min(Number(char.hp) || next, next);
      if (field === "maxMana") patch.mana = Math.min(Number(char.mana) || next, next);
      if (field === "energy") patch.energy = Math.min(next, Number(char.maxEnergy) || 100);

      // Mantém a contabilidade "investido" (baseStats) em dia para os status
      // que têm base — equipar/trocar item depois não sobrescreve o ajuste.
      const baseMap: Record<string, string> = {
        attack: "attack", defense: "defense", speed: "speed", critical: "critical", maxHp: "maxHp",
      };
      if (baseMap[String(stat)]) {
        const baseStats =
          char.baseStats && typeof char.baseStats === "object"
            ? { ...(char.baseStats as Record<string, number>) }
            : {};
        baseStats[baseMap[String(stat)]] = Math.max(0, (Number(baseStats[baseMap[String(stat)]]) || 0) + delta);
        patch.baseStats = baseStats;
      }

      // Recalcula o poder quando o status alterado faz parte dele.
      if (["attack", "defense", "speed", "critical", "maxHp"].includes(String(stat))) {
        const attack = String(stat) === "attack" ? next : Number(char.attack) || 0;
        const defense = String(stat) === "defense" ? next : Number(char.defense) || 0;
        const hp = String(stat) === "maxHp" ? next : Number(char.maxHp) || 0;
        const speed = String(stat) === "speed" ? next : Number(char.speed) || 0;
        const critical = String(stat) === "critical" ? next : Number(char.critical) || 0;
        patch.power = powerCalc({ attack, defense, hp, speed, critical, level: Number(char.level) || 1 });
      }

      const updated = await jsonDb.updateCharacter(String(characterId), patch);
      if (!updated) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      return NextResponse.json({
        success: true,
        character: updated,
        field,
        delta,
        value: next,
        message: `✅ ${field} ${delta >= 0 ? "+" : ""}${delta} → ${next}`,
      });
    }

    if (action === "recalc_equipment") {
      // Recalcula os status de TODOS os personagens (ou um, se characterId)
      // a partir dos itens EQUIPADOS atuais — aplica retroativamente mudanças
      // de balanceamento (ex.: multiplicador por raridade da forja).
      const { characterId } = body;
      const all = characterId
        ? [await jsonDb.findCharacterById(String(characterId))].filter(Boolean)
        : await jsonDb.listCharacters("", 999999);
      let processed = 0;
      for (const c of all) {
        if (!c) continue;
        const inv = await jsonDb.getInventoryForCharacter(String(c.id));
        const bonus = { attack: 0, defense: 0, maxHp: 0, speed: 0, critical: 0 };
        for (const e of inv) {
          if (!e.item?.equipped || e.template?.type === "consumable") continue;
          const b = equipmentBonus(e.template, e.item);
          bonus.attack += b.attack;
          bonus.defense += b.defense;
          bonus.maxHp += b.maxHp;
          bonus.speed += b.speed;
          bonus.critical += b.critical;
        }
        const setBonus = totalSetBonus(inv.filter((e: any) => e.item?.equipped), c.level || 1);
        bonus.attack += setBonus.attack;
        bonus.defense += setBonus.defense;
        bonus.maxHp += setBonus.maxHp;
        bonus.critical += setBonus.critical;
        // Base investida = o que foi alocado/ganho (sem equipamento).
        const baseStats =
          c.baseStats && typeof c.baseStats === "object"
            ? (c.baseStats as Record<string, number>)
            : {
                attack: Math.max(0, (Number(c.attack) || 0) - bonus.attack),
                defense: Math.max(0, (Number(c.defense) || 0) - bonus.defense),
                maxHp: Math.max(0, (Number(c.maxHp) || 0) - bonus.maxHp),
                speed: Math.max(0, (Number(c.speed) || 0) - bonus.speed),
                critical: Math.max(0, (Number(c.critical) || 0) - bonus.critical),
              };
        const attack = Math.max(0, (Number(baseStats.attack) || 0) + bonus.attack);
        const defense = Math.max(0, (Number(baseStats.defense) || 0) + bonus.defense);
        const maxHp = Math.max(1, (Number(baseStats.maxHp) || 0) + bonus.maxHp);
        const speed = Math.max(0, (Number(baseStats.speed) || 0) + bonus.speed);
        const critical = Math.max(0, (Number(baseStats.critical) || 0) + bonus.critical);
        await jsonDb.updateCharacter(String(c.id), {
          attack,
          defense,
          maxHp,
          speed,
          critical,
          hp: Math.min(Number(c.hp) || maxHp, maxHp),
          baseStats: {
            attack: Math.max(0, Number(baseStats.attack) || 0),
            defense: Math.max(0, Number(baseStats.defense) || 0),
            maxHp: Math.max(0, Number(baseStats.maxHp) || 0),
            speed: Math.max(0, Number(baseStats.speed) || 0),
            critical: Math.max(0, Number(baseStats.critical) || 0),
          },
          power: powerCalc({
            attack,
            defense,
            hp: maxHp,
            speed,
            critical,
            level: Number(c.level) || 1,
          }),
          lastActivity: new Date().toISOString(),
        });
        processed++;
      }
      return NextResponse.json({
        success: true,
        processed,
        message: `Equipamentos recalculados em ${processed} personagem(ns) — raridade × runas × encanto aplicados!`,
      });
    }

    if (action === "reset_attributes_general") {
      // Zera os atributos de TODOS os personagens e devolve 3 pontos de status por nível,
      // tudo de uma vez (sem precisar escolher 1 por 1).
      const all = await jsonDb.listCharacters("", 999999);
      if (!all.length) return NextResponse.json({ error: "Nenhum personagem encontrado" }, { status: 400 });
      let processed = 0;
      for (const c of all) {
        const base = CLASS_BASE_STATS[(c.classType as ClassName) ?? "warrior"] ?? CLASS_BASE_STATS.warrior;
        const level = Math.max(1, Number(c.level) || 1);
        const equip = await equippedBonuses(String(c.id), c.level || 1);
        await jsonDb.updateCharacter(String(c.id), {
          hp: Math.min(Number(c.hp) || base.hp, base.hp + equip.hp),
          maxHp: base.hp + equip.hp,
          mana: base.mana,
          maxMana: base.mana,
          attack: base.attack + equip.atk,
          defense: base.defense + equip.def,
          speed: base.speed + equip.spd,
          critical: base.critical + equip.crit,
          precision: 5,
          dodge: 5,
          resistance: 5,
          unspentStatPoints: level * 3,
          power: powerCalc({
            attack: base.attack + equip.atk,
            defense: base.defense + equip.def,
            hp: base.hp + equip.hp,
            speed: base.speed + equip.spd,
            critical: base.critical + equip.crit,
            level,
          }),
          lastActivity: new Date().toISOString(),
        });
        processed++;
      }
      return NextResponse.json({
        success: true,
        processed,
        message: `Atributos zerados em ${processed} personagens e cada um recebeu 3 × Lv em pontos de status!`,
      });
    }

    if (action === "reset_tower") {
      // Reseta o andar da torre de TODOS os personagens para 1 (moedas são mantidas).
      const all = await jsonDb.listCharacters("", 999999);
      if (!all.length) return NextResponse.json({ error: "Nenhum personagem encontrado" }, { status: 400 });
      let processed = 0;
      for (const c of all) {
        await jsonDb.updateCharacter(String(c.id), {
          towerFloor: 1,
          lastActivity: new Date().toISOString(),
        });
        processed++;
      }
      return NextResponse.json({
        success: true,
        processed,
        message: `Torre resetada para o 1º andar em ${processed} personagens!`,
      });
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

    // ---- Foto do Boss Mundial (upload pelo Admin) ----
    if (action === "upload_world_boss_image") {
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
      const dir = path.join(process.cwd(), "public", "uploads", "worldboss");
      await fs.mkdir(dir, { recursive: true });
      const fileName = `world_boss_${randomUUID()}${ext}`;
      await fs.writeFile(path.join(dir, fileName), buffer);

      const url = `/uploads/worldboss/${fileName}`;
      await jsonDb.updateServerSettings({ worldBossImage: url });
      return NextResponse.json({ success: true, url, message: "Foto do boss atualizada!" });
    }

    if (action === "reset_world_boss_image") {
      await jsonDb.updateServerSettings({ worldBossImage: "" });
      return NextResponse.json({ success: true, message: "Foto do boss removida (usa o visual da torre)." });
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

    // --- Remover / ajustar itens do inventário direto do personagem ---
    // quantidade <= 0 apaga o item; > 0 define a quantidade da stack.
    if (action === "set_inventory_quantity") {
      const { characterId, inventoryItemId, quantity } = body;
      if (!characterId || !inventoryItemId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const existing = await jsonDb.getInventoryItemById(String(inventoryItemId));
      if (!existing) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
      if (existing.item.characterId !== characterId) {
        return NextResponse.json({ error: "Este item não pertence a esse personagem" }, { status: 400 });
      }
      const q = Math.floor(Number(quantity));
      if (!Number.isFinite(q)) return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
      if (q <= 0) {
        await jsonDb.removeInventoryItem(String(inventoryItemId));
      } else {
        await jsonDb.updateInventoryItem(String(inventoryItemId), { quantity: q });
      }
      return NextResponse.json({ success: true });
    }

    // Apaga todos os itens do inventário de um personagem (cuidado: irreversível).
    if (action === "clear_inventory") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const inventory = await jsonDb.getInventoryForCharacter(String(characterId));
      for (const entry of inventory) {
        await jsonDb.removeInventoryItem(entry.item.id);
      }
      return NextResponse.json({ success: true, removed: inventory.length });
    }

    // ---- Compras PIX: aprovar / rejeitar comprovantes ----

    if (action === "approve_purchase") {
      const { purchaseId } = body;
      const purchase = purchaseId ? await jsonDb.updatePurchase(String(purchaseId), {
        status: "approved",
        decidedAt: new Date().toISOString(),
      }) : null;
      if (!purchase) return NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });
      const char = await jsonDb.findCharacterById(String(purchase.characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const diamonds = Number(purchase.diamonds) || 0;
      await jsonDb.updateCharacter(char.id, { diamonds: (char.diamonds || 0) + diamonds });
      // Registro PERMANENTE no livro-razão: se o jogo for resetado, o ADM
      // reenvia esses diamantes pelo painel (aba 💎 Já Compraram).
      await jsonDb.appendPurchaseLedger({
        purchaseId: String(purchase.id),
        characterId: String(char.id),
        characterName: String(char.name || "?"),
        userId: String(purchase.userId || char.userId || ""),
        diamonds,
        valueBRL: Number(purchase.valueBRL) || 0,
        approvedAt: new Date().toISOString(),
        refunded: false,
        refundedAt: null,
      });
      return NextResponse.json({ success: true, purchase, granted: diamonds, message: `💎 ${diamonds} diamantes creditados para ${char.name} e registrados no livro-razão (reenvio após reset)!` });
    }

    // ---- Livro-razão permanente: listar + reenviar diamantes após reset ----

    if (action === "refund_purchase") {
      const { ledgerId, characterId } = body;
      if (!ledgerId) return NextResponse.json({ error: "ID do registro necessário" }, { status: 400 });
      const ledger = await jsonDb.listPurchaseLedger();
      const entry = ledger.find((e: any) => e.id === String(ledgerId));
      if (!entry) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
      if (entry.refunded) return NextResponse.json({ error: "Este reembolso já foi enviado antes!" }, { status: 400 });
      const diamonds = Math.max(0, Math.floor(Number(entry.diamonds) || 0));
      if (diamonds <= 0) return NextResponse.json({ error: "Registro sem diamantes" }, { status: 400 });
      const targetId = String(characterId || entry.characterId || "");
      const char = await jsonDb.findCharacterById(targetId);
      if (!char) {
        return NextResponse.json({ error: "Personagem não encontrado — selecione o personagem que deve receber o reembolso." }, { status: 404 });
      }
      await jsonDb.updateCharacter(char.id, {
        diamonds: (Number(char.diamonds) || 0) + diamonds,
        lastActivity: new Date().toISOString(),
      });
      await jsonDb.updatePurchaseLedgerEntry(String(entry.id), {
        refunded: true,
        refundedAt: new Date().toISOString(),
        refundedToCharacterId: char.id,
        refundedToName: String(char.name || "?"),
      });
      return NextResponse.json({ success: true, granted: diamonds, character: char, message: `💎 ${diamonds} diamantes reenviados para ${char.name} (compra original de ${entry.characterName})!` });
    }

    if (action === "reject_purchase") {
      const { purchaseId } = body;
      const purchase = purchaseId ? await jsonDb.updatePurchase(String(purchaseId), {
        status: "rejected",
        decidedAt: new Date().toISOString(),
      }) : null;
      if (!purchase) return NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });
      return NextResponse.json({ success: true, purchase, message: "Compra rejeitada." });
    }

    // ---- Excluir compra (fake) ----
    if (action === "delete_purchase") {
      const { purchaseId } = body;
      if (!purchaseId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
      const deleted = await jsonDb.deletePurchase(String(purchaseId));
      return deleted
        ? NextResponse.json({ success: true, message: "Compra excluída permanentemente." })
        : NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });
    }

    // ---- Excluir registro do livro-razão ----
    if (action === "delete_ledger_entry") {
      const { entryId } = body;
      if (!entryId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
      const deleted = await jsonDb.deletePurchaseLedgerEntry(String(entryId));
      return deleted
        ? NextResponse.json({ success: true, message: "Registro excluído do livro-razão." })
        : NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    // ---- Reset do jogo (começar do zero) ----

    if (action === "reset_game") {
      await jsonDb.resetGameData();
      return NextResponse.json({
        success: true,
        message: "♻️ Jogo resetado! Todos os jogadores, personagens, guildas, inventário e correio foram apagados. O catálogo de itens/missões foi mantido.",
      });
    }

    // ---- Reset de personagens (mantém contas) ----
    if (action === "reset_characters") {
      await jsonDb.resetCharacterData();
      return NextResponse.json({
        success: true,
        message: "♻️ Personagens resetados! Todos voltaram ao nível 1 com stats padrão da classe. Contas foram mantidas intactas.",
      });
    }

    // ---- Excluir Guilda ----
    if (action === "delete_guild") {
      const guildId = body.id as string;
      if (!guildId) return NextResponse.json({ error: "ID da guilda obrigatório" }, { status: 400 });
      const guild = await jsonDb.findGuildById(guildId);
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
      const members = Array.isArray(guild.members) ? guild.members : [];
      for (const m of members) {
        const charId = (m as any).characterId || (m as any).id;
        if (charId) {
          try { await jsonDb.updateCharacter(String(charId), { guildId: null, guildRank: null, guildBuffs: {} }); } catch { /* ignora */ }
        }
      }
      await jsonDb.deleteGuild(guildId);
      return NextResponse.json({ success: true, message: `🗑️ Guilda "${guild.name}" excluída com sucesso.` });
    }

    // ---- Expulsar membro da guilda ----
    if (action === "kick_guild_member") {
      const { guildId, characterId } = body;
      if (!guildId || !characterId) return NextResponse.json({ error: "guildId e characterId obrigatórios" }, { status: 400 });
      const guild = await jsonDb.findGuildById(String(guildId));
      if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });
      const members = Array.isArray(guild.members) ? guild.members : [];
      const member = members.find((m: any) => (m.characterId || m.id) === String(characterId));
      if (!member) return NextResponse.json({ error: "Membro não encontrado na guilda" }, { status: 404 });
      const updatedMembers = members.filter((m: any) => (m.characterId || m.id) !== String(characterId));
      await jsonDb.updateGuild(String(guildId), { members: updatedMembers });
      try { await jsonDb.updateCharacter(String(characterId), { guildId: null, guildRank: null }); } catch { /* ignora */ }
      return NextResponse.json({ success: true, message: `👢 Membro expulso da guilda "${guild.name}".` });
    }

    // ---- Chat da guilda (admin pode ler/limpar) ----
    if (action === "guild_chat") {
      const guildId = body.id as string;
      if (!guildId) return NextResponse.json({ error: "ID da guilda obrigatório" }, { status: 400 });
      const messages = await jsonDb.getGuildChatMessages(String(guildId), 50);
      return NextResponse.json({ guildId, messages });
    }

    // ---- Logs administrativos: limpar (todos ou por tipo) ----
    if (action === "clear_logs") {
      const { kind, source } = body;
      let removed = 0;
      if (typeof source === "string" && source) {
        removed = await jsonDb.clearAdminLogsBySource(
          typeof kind === "string" && kind ? kind : undefined,
          source
        );
      } else {
        removed = await jsonDb.clearAdminLogs(typeof kind === "string" && kind ? kind : undefined);
      }
      return NextResponse.json({
        success: true,
        removed,
        message: `🗑️ ${removed} log(s) removido(s).`,
      });
    }

    // ---- Mensagem global / manutenção (anúncio para todos os jogadores) ----

    if (action === "toggle_infinite_energy") {
      const { enabled } = body;
      const settings = await getServerSettingsData();
      const newValue = typeof enabled === "boolean" ? enabled : !settings.infiniteEnergy;
      const saved = await jsonDb.updateServerSettings({ infiniteEnergy: newValue });
      return NextResponse.json({ success: true, infiniteEnergy: !!saved.infiniteEnergy, message: newValue ? "⚡ Energia infinita ATIVADA para todos!" : "⚡ Energia infinita DESATIVADA." });
    }

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
      // Horário programado para o fim da manutenção (ISO) — o cliente mostra
      // um cooldown ao vivo até essa hora.
      if (typeof body.maintenanceUntil === "string") patch.maintenanceUntil = body.maintenanceUntil;
      if (typeof body.infiniteEnergy === "boolean") patch.infiniteEnergy = body.infiniteEnergy;
      if (typeof body.donatePixKey === "string") patch.donatePixKey = body.donatePixKey.trim();
      if (typeof body.donateQrCode === "string") patch.donateQrCode = body.donateQrCode.trim();
      // Conversão de diamantes por real (loja PIX): quantos diamantes valem R$ 1.
      if (typeof body.diamondsPerReal === "number" && Number.isFinite(body.diamondsPerReal)) {
        patch.diamondsPerReal = Math.max(1, Math.floor(body.diamondsPerReal));
      }
      // Limites e balanceamento: torre (andar máx.), nível máx. e XP da torre.
      // 0 = sem limite próprio (usa o padrão do jogo).
      if (body.maxTowerFloor !== undefined) {
        patch.maxTowerFloor = Math.max(0, Math.floor(Number(body.maxTowerFloor) || 0));
      }
      if (body.maxLevel !== undefined) {
        patch.maxLevel = Math.max(0, Math.floor(Number(body.maxLevel) || 0));
      }
      // Multiplicador de XP ganho na torre (0.01–5; ex.: 0.3 = só 30% do XP).
      if (body.towerXpMult !== undefined) {
        patch.towerXpMult = Math.min(5, Math.max(0.01, Number(body.towerXpMult) || 1));
      }
      // Multiplicador de XP em regiões
      if (body.regionXpMult !== undefined) {
        patch.regionXpMult = Math.min(10, Math.max(0.01, Number(body.regionXpMult) || 1));
      }
      // Multiplicador de ouro global
      if (body.goldMult !== undefined) {
        patch.goldMult = Math.min(10, Math.max(0.01, Number(body.goldMult) || 1));
      }
      // Tempo de regeneração de energia (minutos)
      if (body.energyRegenMinutes !== undefined) {
        patch.energyRegenMinutes = Math.max(1, Math.floor(Number(body.energyRegenMinutes) || 5));
      }
      // Multiplicador de ouro em missões
      if (body.missionGoldMult !== undefined) {
        patch.missionGoldMult = Math.min(10, Math.max(0.01, Number(body.missionGoldMult) || 1));
      }
      // Taxa de crítico global (%)
      if (body.critRate !== undefined) {
        patch.critRate = Math.min(100, Math.max(0, Number(body.critRate) || 10));
      }
      // Taxa de esquiva global (%)
      if (body.dodgeRate !== undefined) {
        patch.dodgeRate = Math.min(100, Math.max(0, Number(body.dodgeRate) || 5));
      }
      // Loja Fantasma (moedas da torre): configuração completa (horários, duração, itens).
      if (body.ghostShop !== undefined) {
        const { sanitizeGhostShopConfig } = await import("@/game/ghostShop");
        patch.ghostShop = sanitizeGhostShopConfig(body.ghostShop);
      }
      // Evento Global (Boss Mundial): configuração completa (horários, boss, recompensas).
      if (body.worldBoss !== undefined) {
        const { sanitizeWorldBossConfig } = await import("@/game/worldBoss");
        patch.worldBoss = sanitizeWorldBossConfig(body.worldBoss);
      }
      const saved = await jsonDb.updateServerSettings(patch);
      return NextResponse.json({ success: true, settings: saved });
    }

    // ---- Atualizar preços de Skins e Baús ----
    if (action === "update_prices") {
      const sp = body.skinPrices as Record<string, number> | undefined;
      const cp = body.chestPrices as Record<string, number> | undefined;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (sp && typeof sp === "object") {
        patch.skinPrices = {
          epic: Math.max(1, Math.floor(Number(sp.epic) || 5)),
          legendary: Math.max(1, Math.floor(Number(sp.legendary) || 10)),
          mythic: Math.max(1, Math.floor(Number(sp.mythic) || 25)),
        };
      }
      if (cp && typeof cp === "object") {
        patch.chestPrices = {
          common: Math.max(1, Math.floor(Number(cp.common) || 100)),
          rare: Math.max(1, Math.floor(Number(cp.rare) || 500)),
          epic: Math.max(1, Math.floor(Number(cp.epic) || 2000)),
          legendary: Math.max(1, Math.floor(Number(cp.legendary) || 10000)),
        };
      }
      const saved = await jsonDb.updateServerSettings(patch);
      return NextResponse.json({ success: true, settings: saved });
    }

    // ---- Loja Fantasma / Evento Global: ligar/desligar na hora (1 clique) ----
    // Só inverte o "enabled" preservando toda a config já salva (horários, itens, boss...).
    if (action === "toggle_ghost_shop") {
      const { enabled } = body;
      const settings = await getServerSettingsData();
      const cur = (settings.ghostShop || {}) as Record<string, unknown>;
      const newValue = typeof enabled === "boolean" ? enabled : !cur.enabled;
      const { sanitizeGhostShopConfig } = await import("@/game/ghostShop");
      const saved = await jsonDb.updateServerSettings({
        ghostShop: sanitizeGhostShopConfig({ ...cur, enabled: newValue }),
      });
      return NextResponse.json({
        success: true,
        enabled: !!saved?.ghostShop?.enabled,
        message: newValue ? "👻 Loja Fantasma ATIVADA!" : "👻 Loja Fantasma DESATIVADA.",
      });
    }

    if (action === "toggle_world_boss") {
      const { enabled } = body;
      const settings = await getServerSettingsData();
      const cur = (settings.worldBoss || {}) as Record<string, unknown>;
      const newValue = typeof enabled === "boolean" ? enabled : !cur.enabled;
      const { sanitizeWorldBossConfig } = await import("@/game/worldBoss");
      const saved = await jsonDb.updateServerSettings({
        worldBoss: sanitizeWorldBossConfig({ ...cur, enabled: newValue }),
      });
      return NextResponse.json({
        success: true,
        enabled: !!saved?.worldBoss?.enabled,
        message: newValue ? "🌍 Evento Global ATIVADO!" : "🌍 Evento Global DESATIVADO.",
      });
    }

    // ---- Códigos de resgate (gerar / excluir) ----

    function genCode(len = 10): string {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = "";
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }

    if (action === "create_code") {
      const { code, xpHours, energyHours, label, maxUses, expiresDays, items } = body;
      const xpH = Math.max(0, Math.floor(Number(xpHours) || 0));
      const energyH = Math.max(0, Math.floor(Number(energyHours) || 0));
      const vipTierId = String(body.vipTier || "").trim().toLowerCase();
      const vipDays = Math.max(0, Math.floor(Number(body.vipDays) || 0));
      const goldReward = Math.max(0, Math.floor(Number(body.gold) || 0));
      const diamondsReward = Math.max(0, Math.floor(Number(body.diamonds) || 0));
      const crystalsReward = Math.max(0, Math.floor(Number(body.crystals) || 0));
      const codeItems = Array.isArray(items) ? items.filter((i: any) => i && i.templateId) : [];
      const hasVip = vipTierId !== "" && vipDays > 0 && !!vipTierById(vipTierId);
      if (xpH <= 0 && energyH <= 0 && !hasVip && goldReward <= 0 && diamondsReward <= 0 && crystalsReward <= 0 && codeItems.length === 0) {
        return NextResponse.json({ error: "Informe ao menos uma recompensa: boost XP, boost Energia, VIP, ouro, diamantes, cristais ou itens." }, { status: 400 });
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
        vipTier: hasVip ? vipTierId : null,
        vipDays: hasVip ? vipDays : 0,
        gold: goldReward,
        diamonds: diamondsReward,
        crystals: crystalsReward,
        items: codeItems,
        label: String(label || "").trim() || "Presente do ADM",
        maxUses: Math.max(0, Math.floor(Number(maxUses) || 0)),
        expiresAt: expiresDaysNum > 0
          ? new Date(Date.now() + expiresDaysNum * 24 * 3600 * 1000).toISOString()
          : null,
        redeemedBy: [],
        createdAt: new Date().toISOString(),
      });
      const parts: string[] = [];
      if (xpH > 0) parts.push(`${xpH}h de XP`);
      if (energyH > 0) parts.push(`${energyH}h de Energia`);
      if (hasVip) parts.push(`VIP ${vipTierId} por ${vipDays}d`);
      if (goldReward > 0) parts.push(`${goldReward.toLocaleString()} de ouro`);
      if (diamondsReward > 0) parts.push(`${diamondsReward} diamantes`);
      if (crystalsReward > 0) parts.push(`${crystalsReward} cristais`);
      if (codeItems.length > 0) parts.push(`${codeItems.length} item(ns)`);
      return NextResponse.json({ success: true, code: rec, message: `Código gerado: ${codeValue} (${parts.join(" + ")})` });
    }

    // ---- Evento Global (Boss Mundial): resetar o evento em andamento ----
    if (action === "reset_world_boss") {
      const saved = await jsonDb.updateServerSettings({ worldBossEvent: null });
      return NextResponse.json({ success: true, message: "Evento atual zerado — o próximo começa com o boss com HP cheio." });
    }

    if (action === "delete_code") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const done = await jsonDb.deleteCode(String(id));
      if (!done) return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, message: "Código excluído." });
    }

    // ---- Pets: dar pet específico ou a coleção inteira ----

    if (action === "grant_pet") {
      const { characterId, petId } = body;
      if (!characterId || !petId) return NextResponse.json({ error: "Personagem e pet são obrigatórios" }, { status: 400 });
      const def = petById(String(petId));
      if (!def) return NextResponse.json({ error: "Pet não encontrado" }, { status: 404 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const res = grantPetPatch(char, def.id);
      const patch: Record<string, unknown> = { ...res.patch, lastActivity: new Date().toISOString() };
      if (res.added && !char.activePetId) patch.activePetId = def.id;
      const updated = await jsonDb.updateCharacter(String(characterId), patch);
      return NextResponse.json({
        success: true,
        character: updated,
        added: res.added,
        message: res.added
          ? `${def.icon} Pet ${def.nameKey} adicionado a ${char.name}!`
          : `${def.icon} ${char.name} já tinha esse pet — convertido em XP para o pet ativo.`,
      });
    }

    if (action === "grant_all_pets") {
      const { characterId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      let patch: Record<string, unknown> = { lastActivity: new Date().toISOString() };
      let added = 0;
      for (const def of PET_DEFS) {
        const res = grantPetPatch(char, def.id);
        if (res.added) added++;
        patch = { ...patch, ...res.patch };
      }
      const updated = await jsonDb.updateCharacter(String(characterId), patch);
      return NextResponse.json({
        success: true,
        character: updated,
        added,
        message: `🐾 ${added} pet(s) novos adicionados (duplicatas viraram XP)!`,
      });
    }

    // ---- Classe Avançada: setar/remover direto (sem custo) ----

    if (action === "set_advanced_class") {
      const { characterId, advancedClassId } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const id = String(advancedClassId || "").trim();
      if (!id) {
        const updated = await jsonDb.updateCharacter(String(characterId), {
          advancedClass: null,
          lastActivity: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, character: updated, message: `🌟 Classe avançada removida de ${char.name}.` });
      }
      const def = ADVANCED_CLASSES.find((a) => a.id === id);
      if (!def) return NextResponse.json({ error: "Classe avançada não encontrada" }, { status: 404 });
      if (def.cls !== char.classType) {
        return NextResponse.json({ error: `Essa evolução é de ${def.cls} — o personagem é ${char.classType}.` }, { status: 400 });
      }
      const updated = await jsonDb.updateCharacter(String(characterId), {
        advancedClass: { id: def.id, evolvedAt: new Date().toISOString() },
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, character: updated, message: `🌟 ${char.name} evoluiu para ${def.nameKey}!` });
    }

    // ---- Trocar classe base (cobra ouro) ----
    if (action === "change_class") {
      const { characterId, newClassType } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      if (!newClassType) return NextResponse.json({ error: "Nova classe obrigatória" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const validClasses = ["warrior","paladin","berserker","mage","necromancer","assassin","hunter","monk","samurai","knight","summoner","templar","archer"];
      if (!validClasses.includes(String(newClassType))) {
        return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
      }
      if (char.classType === newClassType) {
        return NextResponse.json({ error: "O personagem já é dessa classe!" }, { status: 400 });
      }
      // Custo: 5000 + (nível × 100) de ouro
      const level = Math.max(1, Number(char.level) || 1);
      const cost = 5000 + level * 100;
      const currentGold = Number(char.gold) || 0;
      if (currentGold < cost) {
        return NextResponse.json({ error: `Ouro insuficiente! Necessário: ${cost.toLocaleString()} 💰 (tem ${currentGold.toLocaleString()})` }, { status: 400 });
      }
      // Stats base da nova classe
      const base = CLASS_BASE_STATS[(newClassType as ClassName)] ?? CLASS_BASE_STATS.warrior;
      const newPower = powerCalc({ attack: base.attack, defense: base.defense, hp: base.hp, speed: base.speed, critical: base.critical, level });
      await jsonDb.updateCharacter(String(characterId), {
        classType: newClassType,
        gold: currentGold - cost,
        // Stats base da nova classe (mantém level e XP)
        hp: base.hp,
        maxHp: base.hp,
        attack: base.attack,
        defense: base.defense,
        speed: base.speed,
        critical: base.critical,
        mana: base.mana,
        maxMana: base.mana,
        power: newPower,
        // Remove classe avançada (não é da nova classe)
        advancedClass: null,
        // Reseta atributos investidos (pontos devolvidos = nível × 3)
        unspentStatPoints: level * 3,
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        message: `🔄 ${char.name} trocou de ${char.classType} para ${newClassType}! Custo: ${cost.toLocaleString()} 💰`,
        cost,
      });
    }

    // ---- Ascensão: setar patamar direto ----

    if (action === "set_ascension") {
      const { characterId, level } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const lv = Math.max(0, Math.min(ASCENSION_MAX, Math.floor(Number(level) || 0)));
      const updated = await jsonDb.updateCharacter(String(characterId), {
        ascension: lv,
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        character: updated,
        message: lv > 0
          ? `🌌 Ascensão ${lv} definida para ${char.name} (buffs permanentes aplicados)!`
          : `🌌 Ascensão removida de ${char.name}.`,
      });
    }

    // ---- Temporada: conceder pontos da temporada atual ----

    if (action === "grant_season_points") {
      const { characterId, points } = body;
      if (!characterId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });
      const char = await jsonDb.findCharacterById(String(characterId));
      if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
      const pts = Math.max(1, Math.floor(Number(points) || 0));
      const sid = seasonInfo().seasonId;
      const cur = Number(char?.seasonId) === sid ? Math.max(0, Math.floor(Number(char?.seasonPoints) || 0)) : 0;
      const updated = await jsonDb.updateCharacter(String(characterId), {
        seasonId: sid,
        seasonPoints: cur + pts,
        lastActivity: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        character: updated,
        seasonPoints: cur + pts,
        message: `🏆 +${pts} pontos de temporada para ${char.name} (total: ${(cur + pts).toLocaleString()})!`,
      });
    }

    // ---- AÇÕES EM MASSA (selecionar vários personagens no painel) ----
    // body: { characterIds: string[], subAction, value }
    // subAction: reset_tower | grant_all_pets | grant_pet | grant_stat_points
    //            | grant_resources | grant_season_points | set_vip
    if (action === "bulk_action") {
      const ids: string[] = Array.isArray(body.characterIds) ? body.characterIds.map(String) : [];
      if (!ids.length) return NextResponse.json({ error: "Selecione ao menos um personagem" }, { status: 400 });
      const subAction = String(body.subAction || "");
      let processed = 0;
      for (const id of ids) {
        const char = await jsonDb.findCharacterById(id);
        if (!char) continue;
        const stamp = new Date().toISOString();
        if (subAction === "reset_tower") {
          await jsonDb.updateCharacter(id, { towerFloor: 1, lastActivity: stamp });
        } else if (subAction === "grant_all_pets") {
          let patch: Record<string, unknown> = { lastActivity: stamp };
          for (const def of PET_DEFS) {
            const res = grantPetPatch(char, def.id);
            patch = { ...patch, ...res.patch };
          }
          const pets = Array.isArray(patch.pets) ? (patch.pets as Array<{ id: string }>) : [];
          await jsonDb.updateCharacter(id, patch);
          if (pets.length > 0 && !char.activePetId) {
            await jsonDb.updateCharacter(id, { activePetId: pets[0].id, lastActivity: stamp });
          }
        } else if (subAction === "grant_pet") {
          const def = petById(String(body.value || ""));
          if (!def) continue;
          const res = grantPetPatch(char, def.id);
          const patch: Record<string, unknown> = { ...res.patch, lastActivity: stamp };
          if (res.added && !char.activePetId) patch.activePetId = def.id;
          await jsonDb.updateCharacter(id, patch);
        } else if (subAction === "grant_stat_points") {
          const add = Math.max(1, Number(char.level) || 1) * 3;
          await jsonDb.updateCharacter(id, { unspentStatPoints: (Number(char.unspentStatPoints) || 0) + add, lastActivity: stamp });
        } else if (subAction === "grant_resources") {
          const v = body.value as Record<string, number> | undefined;
          const patch: Record<string, unknown> = { lastActivity: stamp };
          if (v && typeof v === "object") {
            if (Number(v.gold)) patch.gold = (Number(char.gold) || 0) + Math.max(0, Math.floor(Number(v.gold)));
            if (Number(v.diamonds)) patch.diamonds = (Number(char.diamonds) || 0) + Math.max(0, Math.floor(Number(v.diamonds)));
            if (Number(v.crystals)) patch.crystals = (Number(char.crystals) || 0) + Math.max(0, Math.floor(Number(v.crystals)));
            if (Number(v.towerCoins)) patch.towerCoins = (Number(char.towerCoins) || 0) + Math.max(0, Math.floor(Number(v.towerCoins)));
            if (Number(v.energy)) patch.energy = Math.min(Number(char.maxEnergy) || 100, (Number(char.energy) || 0) + Math.max(0, Math.floor(Number(v.energy))));
          }
          if (Object.keys(patch).length === 1) continue;
          await jsonDb.updateCharacter(id, patch);
        } else if (subAction === "grant_season_points") {
          const pts = Math.max(1, Math.floor(Number(body.value) || 0));
          const sid = seasonInfo().seasonId;
          const cur = Number(char?.seasonId) === sid ? Math.max(0, Math.floor(Number(char?.seasonPoints) || 0)) : 0;
          await jsonDb.updateCharacter(id, { seasonId: sid, seasonPoints: cur + pts, lastActivity: stamp });
        } else if (subAction === "set_vip") {
          const tierDef = vipTierById(String(body.value || ""));
          if (!tierDef) continue;
          const until = new Date(Date.now() + tierDef.days * 86400000).toISOString();
          await jsonDb.updateCharacter(id, { vipTier: tierDef.id, vipUntil: until, vipLevel: VIP_TIERS.indexOf(tierDef) + 1, lastActivity: stamp });
        }
        processed++;
      }
      if (!processed) return NextResponse.json({ error: "Nenhum personagem válido encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, processed, message: `⚡ Ação aplicada em ${processed} personagem(ns)!` });
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