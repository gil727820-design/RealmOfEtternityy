import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users, characters, itemTemplates, inventoryItems, missionTemplates,
  activeMissions, afkRewards, battles, guilds, guildInvites, guildChats,
  mailbox, excludedUsers, regionAudio, serverSettings, codes,
  marketplace, adminLogs,
} from "./schema";
import { skinById } from "@/game/skins";
import { CLASS_BASE_STATS } from "@/game/constants";

/*
 * Repositório Postgres (Supabase) — substituiu o antigo jsonDb.
 * Cada "coleção" do jsonDb virou uma tabela com coluna `data jsonb`.
 * As assinaturas e formatos de retorno são IDÊNTICOS ao anterior,
 * então as rotas não precisaram mudar de lógica.
 *
 * Característica importante do jsonDb mantida aqui: objetos são lidos/gravados
 * INTEIROS (campos dinâmicos como talents, skins, missionBatch etc. são preservados).
 */

type Table = any;

/* ─── Helpers internos (SQLite: data é TEXT, precisa de parse/stringify) ─── */

function parseData<T = any>(row: any): T {
  if (!row) return row as T;
  const raw = row.data ?? row;
  if (raw && typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }
  return raw as T;
}

async function rowsOf(table: Table): Promise<any[]> {
  const rows = await db.select().from(table);
  return (rows as any[]).map((r) => parseData(r));
}

async function getRec(table: Table, idVal: string | number, idCol = "id"): Promise<any | null> {
  const rows = await db
    .select()
    .from(table)
    .where(eq((table as any)[idCol], idVal))
    .limit(1);
  const row = (rows as any[])[0];
  return row ? parseData(row) : null;
}

async function insertRec(
  table: Table,
  rec: any,
  keyCols: [string, string][] = [],
  idCol = "id"
): Promise<any> {
  const serialized = typeof rec === "string" ? rec : JSON.stringify(rec);
  const values: any = { data: serialized };
  if (idCol === "id" && rec.id !== undefined) values.id = String(rec.id);
  for (const [col, key] of keyCols) {
    if (rec[key] !== undefined) values[col] = rec[key];
  }
  await db.insert(table).values(values);
  return rec;
}

async function updateRec(
  table: Table,
  idVal: string | number,
  patch: any,
  keyCols: [string, string][] = [],
  idCol = "id"
): Promise<any | null> {
  const existing = await getRec(table, idVal, idCol);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  const serialized = JSON.stringify(merged);
  const set: any = { data: serialized };
  for (const [col, key] of keyCols) {
    if (merged[key] !== undefined) set[col] = merged[key];
  }
  await db.update(table).set(set).where(eq((table as any)[idCol], idVal));
  return merged;
}

async function deleteRec(table: Table, idVal: string | number, idCol = "id"): Promise<void> {
  await db.delete(table).where(eq((table as any)[idCol], idVal));
}

/* ─── Users ─── */

export async function findUserByUsername(username: string) {
  const all = await rowsOf(users);
  return all.find((u: any) => u.username === username) ?? null;
}

export async function findUserById(id: string) {
  return getRec(users, id);
}

export async function insertUser(user: any) {
  const rec = { id: uuidv4(), createdAt: new Date().toISOString(), ...user };
  await insertRec(users, rec, [["username", "username"]]);
  return rec;
}

export async function updateUser(id: string, patch: any) {
  return updateRec(users, id, patch, [["username", "username"]]);
}

export async function listUsers(search = "", limit = 50) {
  const all = await rowsOf(users);
  const src = all.filter((u: any) => !search || (u.username || "").includes(search));
  return src
    .slice(0, limit)
    .sort((a: any, b: any) => (a.createdAt > b.createdAt ? -1 : 1));
}

/* ─── Characters ─── */

const DEFAULT_CHAR_FIELDS: Record<string, unknown> = {
  sex: "male",
  classType: "warrior",
  avatarId: 1,
  hairColor: "#8B4513",
  eyeColor: "#2E86AB",
  level: 1,
  xp: 0,
  xpToNext: 165, // xpForLevel(1) — curva de XP atualizada
  prestige: 0,
  precision: 5,
  dodge: 5,
  resistance: 5,
  energy: 100,
  maxEnergy: 100,
  gold: 500,
  diamonds: 0,
  crystals: 0,
  pvpCoins: 0,
  guildCoins: 0,
  towerCoins: 0,
  currentRegion: "starter_village",
  pvpLeague: "bronze",
  pvpRating: 0,
  towerFloor: 1,
  unspentStatPoints: 0,
  talentPoints: 0,
  talents: {},
  skillPoints: 0,
  skills: {},
  skins: [],
  achievements: [],
  titles: [],
  activeTitle: null,
  guildId: null,
  guildRank: null,
};

function normalizeCharacter(c: any): any {
  if (!c) return null;
  return { ...DEFAULT_CHAR_FIELDS, ...c };
}

export async function findCharacterByName(name: string) {
  const all = await rowsOf(characters);
  return normalizeCharacter(all.find((c: any) => c.name === name) ?? null);
}

export async function findCharacterByUserId(userId: string) {
  const all = await rowsOf(characters);
  return normalizeCharacter(all.find((c: any) => c.userId === userId) ?? null);
}

export async function findCharacterById(id: string) {
  return normalizeCharacter(await getRec(characters, id));
}

export async function getCharactersByUserId(userId: string) {
  const all = await rowsOf(characters);
  return all.filter((c: any) => c.userId === userId);
}

export async function insertCharacter(char: any) {
  const rec = { id: uuidv4(), ...char };
  await insertRec(characters, rec, [["userId", "userId"], ["name", "name"]]);
  return rec;
}

export async function updateCharacter(id: string, patch: any) {
  return updateRec(characters, id, patch, [["userId", "userId"], ["name", "name"]]);
}

export async function deleteCharacter(id: string) {
  await deleteRec(characters, id);
}

export async function deleteCharacterById(id: string) {
  await deleteRec(characters, id);
}

export async function listCharacters(search = "", limit = 50) {
  const all = await rowsOf(characters);
  const src = all.filter((c: any) => !search || (c.name || "").includes(search));
  return src
    .slice(0, limit)
    .sort((a: any, b: any) => (a.level > b.level ? -1 : 1));
}

/**
 * Conta quantos jogadores estão online: personagens com lastActivity (heartbeat
 * de presença) dentro dos últimos `minutes` minutos. Agrupa por userId para não
 * contar contas com vários personagens (alts) mais de uma vez.
 */
export async function countRecentlyActive(minutes = 3) {
  const all = await rowsOf(characters);
  const cutoff = Date.now() - Math.max(1, minutes) * 60 * 1000;
  const seen = new Set<string>();
  for (const c of all) {
    const ts = c.lastActivity || c.lastSeenAt;
    if (!ts) continue;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    seen.add(c.userId ? String(c.userId) : String(c.id));
  }
  return seen.size;
}

/* ─── Inventory / Items ─── */

export async function insertInventoryItem(item: any) {
  const rec = { id: uuidv4(), ...item };
  await insertRec(inventoryItems, rec, [["characterId", "characterId"]]);
  return rec;
}

/** Diz se um template deve ser empilhável (consumíveis / stackable). */
export function isStackableTemplate(template: any): boolean {
  return !!template && (template.type === "consumable" || template.stackable === true);
}

/** Concede itens ao inventário: empilha consumíveis, cria instância para equipamentos. */
export async function grantItem(
  characterId: string,
  templateId: number,
  quantity = 1,
  equipped = false
) {
  const templates = await rowsOf(itemTemplates);
  const template = templates.find((t: any) => t.id === templateId) ?? null;
  if (!template) return null;

  const items = await rowsOf(inventoryItems);
  const stack = Math.max(1, Math.floor(quantity || 1));

  if (isStackableTemplate(template) && !equipped) {
    const existing = items.find(
      (i: any) => i.characterId === characterId && i.templateId === templateId && !i.equipped
    );
    if (existing) {
      const merged = await updateRec(inventoryItems, existing.id, {
        quantity: (existing.quantity || 1) + stack,
      }, [["characterId", "characterId"]]);
      return { item: merged, template, merged: true };
    }
  }

  const rec = {
    id: uuidv4(),
    characterId,
    templateId,
    equipped,
    quantity: stack,
    obtainedAt: new Date().toISOString(),
  };
  await insertRec(inventoryItems, rec, [["characterId", "characterId"]]);
  // COLEÇÃO/CODEX: registra itens de equipamento obtidos (idempotente, barato).
  if (template?.slot && template?.type !== "consumable" && template?.stackable !== true) {
    try {
      const char = await getRec(characters, characterId);
      const coll = char?.collection;
      const unlocked = Array.isArray(coll?.unlocked) ? coll.unlocked : [];
      const tid = Math.floor(Number(template.id));
      if (Number.isFinite(tid) && !unlocked.includes(tid)) {
        unlocked.push(tid);
        await updateCharacter(characterId, { collection: { unlocked, claimed: Array.isArray(coll?.claimed) ? coll.claimed : [] } });
      }
    } catch { /* nunca quebra a concessão */ }
  }
  return { item: rec, template, merged: false };
}

export async function getInventoryForCharacter(characterId: string) {
  const items = (await rowsOf(inventoryItems))
    .filter((i: any) => i.characterId === characterId)
    .sort((a: any, b: any) => (b.obtainedAt || "").localeCompare(a.obtainedAt || ""));
  const templates = await rowsOf(itemTemplates);

  return items.map((it: any) => {
    const template = templates.find((t: any) => t.id === it.templateId) ?? null;
    const quantity = it.quantity || 1;
    return {
      item: it,
      template,
      quantity,
      totalSellValue: (template?.sellPrice || 0) * quantity,
      stackable: isStackableTemplate(template),
    };
  });
}

export async function getInventoryItemById(id: string) {
  const it = await getRec(inventoryItems, id);
  if (!it) return null;
  const templates = await rowsOf(itemTemplates);
  const template = templates.find((t: any) => t.id === it.templateId) ?? null;
  const quantity = it.quantity || 1;
  return {
    item: it,
    template,
    quantity,
    totalValue: (template?.sellPrice || 0) * quantity,
    stackable: isStackableTemplate(template),
  };
}

export async function updateInventoryItem(id: string, patch: any) {
  return updateRec(inventoryItems, id, patch, [["characterId", "characterId"]]);
}

export async function removeInventoryItem(id: string) {
  const existing = await getRec(inventoryItems, id);
  if (!existing) return false;
  await deleteRec(inventoryItems, id);
  return true;
}

/** Remove `amount` unidades de um stack; apaga a linha se chegar a zero. */
export async function decrementInventoryItem(id: string, amount = 1) {
  const existing = await getRec(inventoryItems, id);
  if (!existing) return null;
  const current = existing.quantity || 1;
  const delta = Math.max(1, Math.floor(amount || 1));
  if (current <= delta) {
    await deleteRec(inventoryItems, id);
    return null;
  }
  return updateRec(inventoryItems, id, { quantity: current - delta }, [["characterId", "characterId"]]);
}

export async function getAllItemTemplates() {
  return rowsOf(itemTemplates);
}

export async function getItemTemplateById(id: number) {
  return getRec(itemTemplates, id);
}

export async function getItemTemplateByNameKey(nameKey: string) {
  const all = await rowsOf(itemTemplates);
  return all.find((t: any) => t.nameKey === nameKey) ?? null;
}

export async function getItemTemplatesByMaxLevel(maxLevel: number) {
  const all = await rowsOf(itemTemplates);
  return all.filter((t: any) => (t.minLevel || 1) <= maxLevel);
}

export async function insertItemTemplates(items: any[]) {
  const existing = await rowsOf(itemTemplates);
  const startId = existing.length > 0 ? Math.max(...existing.map((t: any) => t.id)) + 1 : 1;
  let nextId = startId;
  for (const it of items) {
    const record = { id: nextId++, ...it };
    await insertRec(itemTemplates, record, [["nameKey", "nameKey"]]);
  }
  return items.length;
}

/* ─── Missions ─── */

export async function getMissionTemplates() {
  return rowsOf(missionTemplates);
}

export async function insertMissionTemplates(missions: any[]) {
  const existing = await rowsOf(missionTemplates);
  const startId = existing.length > 0 ? Math.max(...existing.map((m: any) => m.id || 0)) + 1 : 1;
  let nextId = startId;
  for (const m of missions) {
    const record = { id: nextId++, ...m };
    await insertRec(missionTemplates, record);
  }
  return missions.length;
}

export async function upsertMissionTemplates(missions: any[]) {
  for (const m of missions) {
    const id = Number(m.id);
    const existing = await getRec(missionTemplates, id);
    if (!existing) {
      await insertRec(missionTemplates, { id, ...m });
    }
  }
  return missions.length;
}


export async function getMissionTemplateById(id: number) {
  return getRec(missionTemplates, id);
}

/* ─── Active missions ─── */

export async function findActiveMissionByCharacterId(characterId: string) {
  const all = await rowsOf(activeMissions);
  return all.find((a: any) => a.characterId === characterId && !a.claimed) ?? null;
}

export async function insertActiveMission(active: any) {
  const rec = { id: uuidv4(), ...active };
  await insertRec(activeMissions, rec, [["characterId", "characterId"]]);
  return rec;
}

export async function getActiveMissionById(id: string) {
  return getRec(activeMissions, id);
}

export async function updateActiveMission(id: string, patch: any) {
  return updateRec(activeMissions, id, patch, [["characterId", "characterId"]]);
}

/* ─── AFK ─── */

export async function insertAfkReward(reward: any) {
  const rec = { id: uuidv4(), ...reward };
  await insertRec(afkRewards, rec);
  return rec;
}

/* ─── PvP battles (histórico) ─── */

export async function insertBattle(battle: any) {
  const rec = { id: uuidv4(), foughtAt: new Date().toISOString(), ...battle };
  await insertRec(battles, rec, [["characterId", "characterId"]]);
  return rec;
}

export async function getBattlesByCharacterId(characterId: string, limit = 50) {
  return (await rowsOf(battles))
    .filter((b: any) => b.characterId === characterId)
    .sort((a: any, b: any) => (b.foughtAt || "").localeCompare(a.foughtAt || ""))
    .slice(0, limit);
}

/* ─── Guilds ─── */

export async function listGuilds(limit = 50) {
  return (await rowsOf(guilds)).slice(0, limit);
}

export async function insertGuild(guild: any) {
  const rec = { id: `${Date.now()}_${Math.floor(Math.random() * 10000)}`, ...guild };
  await insertRec(guilds, rec);
  return rec;
}

export async function findGuildById(id: string) {
  return getRec(guilds, id);
}

export async function updateGuild(id: string, patch: any) {
  return updateRec(guilds, id, patch);
}

export async function deleteGuild(id: string) {
  await deleteRec(guilds, id);
}

/** Busca a guilda da qual um personagem é membro (via characterId). */
export async function findGuildByMemberId(characterId: string) {
  const all = await rowsOf(guilds);
  return (
    all.find((g: any) => {
      const members = Array.isArray(g.members) ? g.members : [];
      return members.some((m: any) => m.id === characterId);
    }) ?? null
  );
}

/* ─── Guildas v2: convites ─── */

export async function insertGuildInvite(invite: any) {
  const rec = { id: uuidv4(), createdAt: new Date().toISOString(), ...invite };
  await insertRec(guildInvites, rec, [
    ["targetCharacterId", "targetCharacterId"],
    ["guildId", "guildId"],
  ]);
  return rec;
}

export async function getGuildInviteById(id: string) {
  return getRec(guildInvites, id);
}

/** Convites AINDA pendentes recebidos por um personagem. */
export async function getPendingInvitesForCharacter(characterId: string) {
  return (await rowsOf(guildInvites))
    .filter((i: any) => i.targetCharacterId === characterId && !i.status)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** Convites pendentes enviados a uma guilda (para o líder aprovar). */
export async function getPendingInvitesForGuild(guildId: string) {
  return (await rowsOf(guildInvites))
    .filter((i: any) => i.guildId === guildId && !i.status)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function updateGuildInvite(id: string, patch: any) {
  return updateRec(guildInvites, id, patch, [
    ["targetCharacterId", "targetCharacterId"],
    ["guildId", "guildId"],
  ]);
}

export async function hasPendingGuildInvite(characterId: string, guildId: string) {
  const all = await rowsOf(guildInvites);
  return all.some(
    (i: any) => i.targetCharacterId === characterId && i.guildId === guildId && !i.status
  );
}

/* ─── Guildas v2: chat (polling ~4s) ─── */

export async function insertGuildChatMessage(msg: any) {
  const rec = { id: uuidv4(), createdAt: new Date().toISOString(), ...msg };
  await insertRec(guildChats, rec, [["guildId", "guildId"]]);
  return rec;
}

export async function getGuildChatMessages(guildId: string, limit = 50) {
  return (await rowsOf(guildChats))
    .filter((m: any) => m.guildId === guildId)
    .sort((a: any, b: any) => (a.createdAt || "").localeCompare(b.createdAt || ""))
    .slice(-limit);
}

/* ─── Skins (SKIN FULL) ─── */

export async function getCharacterSkins(characterId: string): Promise<string[]> {
  const char = await findCharacterById(characterId);
  if (!char) return [];
  return Array.isArray(char.skins) ? (char.skins as string[]) : [];
}

export async function addCharacterSkins(characterId: string, skinIds: string[]): Promise<any | null> {
  const char = await findCharacterById(characterId);
  if (!char) return null;
  const current = Array.isArray(char.skins) ? (char.skins as string[]) : [];
  const merged = Array.from(new Set([...current, ...skinIds]));
  return updateCharacter(characterId, { skins: merged });
}

export async function removeCharacterSkin(characterId: string, skinId: string): Promise<any | null> {
  const char = await findCharacterById(characterId);
  if (!char) return null;
  const next = (Array.isArray(char.skins) ? (char.skins as string[]) : []).filter(
    (s: string) => s !== skinId
  );
  return updateCharacter(characterId, { skins: next });
}

/* ─── Caixa de correio ─── */

export interface MailRecord {
  id: string;
  characterId: string;
  kind: "item" | "skin" | "resource";
  templateId?: number;
  quantity?: number;
  skinId?: string;
  resource?: string;
  amount?: number;
  from: string;
  note: string;
  createdAt: string;
  claimedAt: string | null;
  claimed: boolean;
}

/** Insere um registro de correio genérico. Retorna o registro ou null se o personagem não existir. */
async function pushMail(
  characterId: string,
  mail: Partial<MailRecord> & { kind: MailRecord["kind"] }
): Promise<MailRecord | null> {
  const char = await findCharacterById(characterId);
  if (!char) return null;
  const rec: MailRecord = {
    id: uuidv4(),
    characterId,
    from: "Administração",
    note: "",
    createdAt: new Date().toISOString(),
    claimedAt: null,
    claimed: false,
    ...mail,
  };
  await insertRec(mailbox, rec, [["characterId", "characterId"]]);
  return rec;
}

/** Envia um item para a caixa de correio de um personagem. */
export async function sendMail(
  characterId: string,
  templateId: number,
  quantity = 1,
  from = "Administração",
  note = ""
): Promise<MailRecord | null> {
  const templates = await rowsOf(itemTemplates);
  const template = templates.find((t: any) => t.id === Number(templateId));
  if (!template) return null;
  return pushMail(characterId, {
    kind: "item",
    templateId: Number(templateId),
    quantity: Math.max(1, Math.floor(quantity || 1)),
    from: from || "Administração",
    note: note || "",
  });
}

/** Envia uma skin para a caixa de correio do personagem (presente do ADM). */
export async function sendSkinMail(
  characterId: string,
  skinId: string,
  from = "Administração",
  note = ""
): Promise<MailRecord | null> {
  const template = skinById(skinId);
  if (!template) return null;
  return pushMail(characterId, {
    kind: "skin",
    skinId: template.id,
    from: from || "Administração",
    note: note || "",
  });
}

const RESOURCE_KEYS = ["gold", "diamonds", "crystals", "pvpCoins", "guildCoins", "towerCoins", "energy"];

/** Envia recursos (moedas/gemas/energia) para a caixa de correio do personagem. */
export async function sendResourceMail(
  characterId: string,
  resource: string,
  amount = 1,
  from = "Administração",
  note = ""
): Promise<MailRecord | null> {
  if (!RESOURCE_KEYS.includes(resource)) return null;
  return pushMail(characterId, {
    kind: "resource",
    resource,
    amount: Math.max(1, Math.floor(amount || 1)),
    from: from || "Administração",
    note: note || "",
  });
}

/** Lista o correio de um personagem (mais recente primeiro), com template/item/skin unidos. */
export async function getMailsForCharacter(characterId: string) {
  const mails = (await rowsOf(mailbox))
    .filter((m: any) => m.characterId === characterId)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const templates = await rowsOf(itemTemplates);
  return mails.map((m: any) => {
    const kind = m.kind || "item";
    const template =
      kind === "item" ? templates.find((t: any) => t.id === m.templateId) ?? null : null;
    const skin = kind === "skin" ? skinById(m.skinId) ?? null : null;
    return { mail: m, template, skin };
  });
}

export async function getMailById(id: string) {
  return (await getRec(mailbox, id)) as MailRecord | null;
}

/** Quantidade de mensagens não resgatadas do personagem. */
export async function countUnclaimedMails(characterId: string): Promise<number> {
  const all = await rowsOf(mailbox);
  return all.filter((m: any) => m.characterId === characterId && !m.claimed).length;
}

/** Resgata o correio → entrega o conteúdo (item/skin/recurso) e marca como resgatado. */
export async function claimMail(mailId: string): Promise<MailRecord | null> {
  const mail = await getMailById(mailId);
  if (!mail || mail.claimed) return null;

  const kind = mail.kind || "item";

  if (kind === "item") {
    const granted = await grantItem(mail.characterId, mail.templateId as number, mail.quantity || 1);
    if (!granted) return null;
  } else if (kind === "skin") {
    if (!mail.skinId) return null;
    const added = await addCharacterSkins(mail.characterId, [mail.skinId]);
    if (!added) return null;
  } else if (kind === "resource") {
    const char = await findCharacterById(mail.characterId);
    if (!char) return null;
    const res = mail.resource || "";
    const amt = Number(mail.amount) || 0;
    const patch: Record<string, number> = {};
    if (res === "energy") {
      patch.energy = Math.min(Number(char.maxEnergy) || 100, (Number(char.energy) || 0) + amt);
    } else {
      patch[res] = (Number(char[res]) || 0) + amt;
    }
    await updateCharacter(mail.characterId, patch);
  } else {
    return null;
  }

  return updateRec(mailbox, mailId, { claimed: true, claimedAt: new Date().toISOString() }, [
    ["characterId", "characterId"],
  ]) as Promise<MailRecord | null>;
}

/** Resgata todo o correio pendente do personagem. Retorna quantos foram resgatados. */
export async function claimAllMails(characterId: string): Promise<number> {
  const pending = (await rowsOf(mailbox)).filter((m: any) => m.characterId === characterId && !m.claimed);
  let claimed = 0;
  for (const m of pending) {
    const done = await claimMail(m.id);
    if (done) claimed++;
  }
  return claimed;
}

/* ─── Admin: contas excluídas / recuperação / exclusão permanente ─── */

export async function deleteUser(id: string) {
  const old = await getRec(users, id);
  await deleteRec(users, id);
  return old;
}

export async function listExcludedUsers() {
  return (await rowsOf(excludedUsers))
    .slice()
    .sort((a: any, b: any) => (b.excludedAt || "").localeCompare(a.excludedAt || ""));
}

export async function getExcludedUserById(id: string) {
  return getRec(excludedUsers, id, "userId");
}

/** Move a conta para a lista de excluídos e marca o registro como deletado. */
export async function excludeUser(userId: string, reason = "") {
  const user = await findUserById(userId);
  if (!user) return null;
  const now = new Date().toISOString();
  const chars = await getCharactersByUserId(userId);
  const snapshot = {
    userId,
    username: user.username,
    reason: reason || "Razão não informada",
    excludedAt: now,
    characterNames: chars.map((c: any) => c.name),
  };
  const existing = await getRec(excludedUsers, userId, "userId");
  if (existing) {
    await updateRec(excludedUsers, userId, { ...snapshot }, [["userId", "userId"]], "userId");
  } else {
    await insertRec(excludedUsers, snapshot, [["userId", "userId"]], "userId");
  }
  await updateUser(userId, {
    deleted: true,
    deletedAt: now,
    banned: false,
    banReason: null,
    bannedAt: null,
    deletedReason: reason || "Razão não informada",
  });
  return snapshot;
}

/** Restaura uma conta excluída (remove da lista e libera o login). */
export async function restoreUser(userId: string) {
  await deleteRec(excludedUsers, userId, "userId");
  const user = await updateUser(userId, { deleted: false, deletedAt: null, deletedReason: null });
  return user;
}

/** Exclusão permanente: remove da lista de excluídos E apaga conta/personagem/inventário. */
export async function hardDeleteUser(userId: string) {
  await deleteRec(excludedUsers, userId, "userId");
  const user = await deleteUser(userId);
  const chars = await getCharactersByUserId(userId);
  const charIds = chars.map((c: any) => c.id);
  for (const cid of charIds) {
    await deleteRec(characters, cid);
    const invItems = (await rowsOf(inventoryItems)).filter((i: any) => i.characterId === cid);
    for (const item of invItems) {
      await deleteRec(inventoryItems, item.id);
    }
  }
  return { user, deletedCharacters: charIds.length };
}

/** Redefine a senha de um usuário: guarda apenas o hash bcrypt (NUNCA o texto puro). */
export async function resetUserPassword(userId: string, plain: string) {
  const bcrypt = await import("bcryptjs");
  const hashed = await bcrypt.hash(plain, 10);
  await updateUser(userId, {
    password: hashed,
    passwordResetAt: new Date().toISOString(),
  });
  return true;
}

/* ─── Admin: música por ilha ─── */

export async function listRegionAudio() {
  return rowsOf(regionAudio);
}

export async function getRegionAudioByRegion(regionId: string) {
  return getRec(regionAudio, regionId, "regionId");
}

/** Salva (ou atualiza) o registro de música de uma ilha. */
export async function upsertRegionAudio(
  regionId: string,
  patch: Partial<{ fileName: string; url: string; uploadedAt: string; by: string }>
) {
  const existing = await getRec(regionAudio, regionId, "regionId");
  const rec = { regionId, ...patch };
  if (existing) {
    await updateRec(regionAudio, regionId, { ...patch }, [["regionId", "regionId"]], "regionId");
  } else {
    await insertRec(regionAudio, rec, [["regionId", "regionId"]], "regionId");
  }
  return rec;
}

/** Remove o registro de áudio de uma ilha. */
export async function removeRegionAudio(regionId: string) {
  const existing = await getRec(regionAudio, regionId, "regionId");
  if (!existing) return false;
  await deleteRec(regionAudio, regionId, "regionId");
  return true;
}

/* ─── Admin: anúncio global / manutenção ─── */

/** Lê as configurações globais do servidor (anúncio, manutenção...). */
export async function getServerSettings(): Promise<any> {
  const all = await rowsOf(serverSettings);
  return all.find((s: any) => s.key === "core") ?? {};
}

/** Atualiza (upsert) as configurações globais do servidor. */
export async function updateServerSettings(patch: any) {
  const existing = await getRec(serverSettings, "core", "key");
  if (existing) {
    const merged = { ...existing, ...patch };
    await updateRec(serverSettings, "core", merged, [["key", "key"]], "key");
    return merged;
  }
  const rec = { key: "core", ...patch };
  await insertRec(serverSettings, rec, [["key", "key"]], "key");
  return rec;
}

/** Verifica se a energia infinita está ativada globalmente. */
export async function isInfiniteEnergyEnabled(): Promise<boolean> {
  const settings = await getServerSettings();
  return !!settings.infiniteEnergy;
}

/* ─── Logs administrativos (hitkill, eventos do servidor...) ─── */

/** Grava um log administrativo (ex.: aviso de hitkill) na tabela admin_logs. */
export async function addAdminLog(kind: string, entry: Record<string, unknown>) {
  const full = {
    id: uuidv4(),
    kind: String(kind || "log"),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  try {
    await insertRec(adminLogs, full, [["kind", "kind"]]);
  } catch (e) {
    // Log nunca deve derrubar a ação do jogador — se falhar, apenas avisa.
    console.error("[adminLog] falha ao gravar log:", e);
  }
  return full;
}

/** Lista logs administrativos, do mais recente para o mais antigo. Aceita
 * filtro por `kind` (ex.: "hitkill") e/ou por `source` (ex.: "world-boss"). */
export async function listAdminLogs(kind?: string, limit = 100, sourceArg?: string) {
  const all = await rowsOf(adminLogs);
  let filtered = kind ? all.filter((l: any) => String(l.kind) === String(kind)) : all;
  if (sourceArg) filtered = filtered.filter((l: any) => String(l.source) === String(sourceArg));
  return filtered
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Math.max(1, Math.min(1000, Number(limit) || 100)));
}

/** Apaga logs administrativos (todos ou de um tipo específico). */
export async function clearAdminLogs(kind?: string) {
  const all = await rowsOf(adminLogs);
  const target = kind
    ? all.filter((l: any) => String(l.kind) === String(kind))
    : all;
  for (const rec of target) {
    try {
      await deleteRec(adminLogs, rec.id);
    } catch { /* ignora */ }
  }
  return target.length;
}

/** Apaga logs administrativos por origem (ex.: todos os "world-boss"). */
export async function clearAdminLogsBySource(kind: string | undefined, source: string) {
  const all = await rowsOf(adminLogs);
  const target = all.filter(
    (l: any) => String(l.source) === String(source) && (!kind || String(l.kind) === String(kind))
  );
  for (const rec of target) {
    try {
      await deleteRec(adminLogs, rec.id);
    } catch { /* ignora */ }
  }
  return target.length;
}

/* ─── Códigos de resgate ─── */

export async function listCodes() {
  const all = await rowsOf(codes);
  return all.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function findCodeByCodeValue(code: string) {
  const all = await rowsOf(codes);
  return all.find((c: any) => String(c.code).toUpperCase() === String(code).toUpperCase()) ?? null;
}

export async function createCode(rec: any) {
  const full = { id: uuidv4(), createdAt: new Date().toISOString(), ...rec };
  await insertRec(codes, full, [["code", "code"]]);
  return full;
}

export async function deleteCode(id: string) {
  const existing = await getRec(codes, id);
  if (!existing) return false;
  await deleteRec(codes, id);
  return true;
}

/** Atualiza as `data` de um código (ex.: marcar `redeemedBy` após resgate). */
export async function updateCode(id: string, patch: any) {
  return updateRec(codes, id, patch, [["code", "code"]]);
}

/* ─── Compras PIX (diamantes) — comprovantes aguardando aprovação ─── */

async function getPurchasesData(): Promise<any[]> {
  const settings = await getServerSettings();
  return Array.isArray(settings?.purchases) ? settings.purchases : [];
}

export async function listPurchases() {
  const all = await getPurchasesData();
  return all.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function createPurchase(rec: any) {
  const full = { id: uuidv4(), createdAt: new Date().toISOString(), status: "pending", ...rec };
  const next = [...(await getPurchasesData()), full];
  await updateServerSettings({ purchases: next });
  return full;
}

export async function updatePurchase(id: string, patch: any) {
  const next = (await getPurchasesData()).map((p: any) =>
    p.id === id ? { ...p, ...patch } : p
  );
  await updateServerSettings({ purchases: next });
  return next.find((p: any) => p.id === id) ?? null;
}

export async function deletePurchase(id: string) {
  const all = await getPurchasesData();
  const filtered = all.filter((p: any) => p.id !== id);
  await updateServerSettings({ purchases: filtered });
  return all.length > filtered.length;
}

export async function deletePurchaseLedgerEntry(id: string) {
  const all = await getPurchaseLedgerData();
  const filtered = all.filter((e: any) => e.id !== id);
  await updateServerSettings({ purchaseLedger: filtered });
  return all.length > filtered.length;
}

/* ─── Livro-razão de compras PERMANENTE (sobrevive ao reset do jogo) ─── */
/* Cada compra APROVADA vira um registro eterno aqui: se o jogo for
 * resetado, o ADM reenvia os diamantes pelo painel (aba 💎 Já Compraram).
 * Guardado em serverSettings.purchaseLedger — o reset não apaga serverSettings. */

async function getPurchaseLedgerData(): Promise<any[]> {
  const settings = await getServerSettings();
  return Array.isArray(settings?.purchaseLedger) ? settings.purchaseLedger : [];
}

export async function listPurchaseLedger() {
  const all = await getPurchaseLedgerData();
  return all.sort((a: any, b: any) => (b.approvedAt || "").localeCompare(a.approvedAt || ""));
}

export async function appendPurchaseLedger(entry: any) {
  const full = { id: uuidv4(), createdAt: new Date().toISOString(), ...entry };
  const next = [...(await getPurchaseLedgerData()), full];
  await updateServerSettings({ purchaseLedger: next });
  return full;
}

export async function updatePurchaseLedgerEntry(id: string, patch: any) {
  const next = (await getPurchaseLedgerData()).map((e: any) =>
    e.id === id ? { ...e, ...patch } : e
  );
  await updateServerSettings({ purchaseLedger: next });
  return next.find((e: any) => e.id === id) ?? null;
}

/* ─── Evento Global — Boss Mundial ─── */

/** Lê o estado atual do evento (ou null se ainda não começou). */
export async function getWorldBossEvent() {
  const settings = await getServerSettings();
  return settings?.worldBossEvent ?? null;
}

/** Salva o estado do evento em server_settings.worldBossEvent. */
export async function saveWorldBossEvent(event: any) {
  const saved = await updateServerSettings({ worldBossEvent: event });
  return saved?.worldBossEvent ?? event;
}

/**
 * Aplica dano ao HP do boss de forma ATÔMICA (evita corrida entre jogadores
 * atacando ao mesmo tempo). Retorna o estado do evento ATUALIZADO (ou null).
 */
export async function decrementWorldBossHp(damage: number) {
  const settings = await getServerSettings();
  const event = settings?.worldBossEvent;
  if (!event) return null;

  const currentHp = Number(event.bossHp) || 0;
  const delta = Math.max(1, Math.floor(damage));
  const newHp = Math.max(0, currentHp - delta);

  event.bossHp = newHp;
  await updateServerSettings({ worldBossEvent: event });
  return event;
}

/* ─── Mercado entre jogadores (anúncios + trocas) ─── */

// UUID "fantasma" (não pertence a nenhum personagem real): guarda os itens
// que estão ANUNCIADOS no mercado enquanto ninguém compra. A coluna
// character_id é uuid no Postgres, então precisa ser um UUID válido.
export const MARKET_SYSTEM_ID = "00000000-0000-0000-0000-00000000dead";

/** Insere um registro no marketplace (anúncio, proposta de troca, anúncio de troca ou sala). */
export async function insertMarketRec(
  rec: any,
  kind: "listing" | "trade" | "tradeAd" | "tradeSession",
  characterId?: string
) {
  const full = {
    id: uuidv4(),
    characterId: characterId ?? rec.sellerId ?? rec.proposerId ?? null,
    kind,
    createdAt: new Date().toISOString(),
    status: "active",
    ...rec,
  };
  await insertRec(marketplace, full, [["characterId", "characterId"], ["kind", "kind"]]);
  return full;
}

export async function getMarketRecById(id: string) {
  return getRec(marketplace, id);
}

export async function updateMarketRec(id: string, patch: any) {
  return updateRec(marketplace, id, patch, [["characterId", "characterId"], ["kind", "kind"]]);
}

export async function deleteMarketRec(id: string) {
  const existing = await getRec(marketplace, id);
  if (!existing) return false;
  await deleteRec(marketplace, id);
  return true;
}

/** Anúncios ATIVOS (à venda) com dados do vendedor + template do item. */
export async function listActiveListings(limit = 300) {
  const all = (await rowsOf(marketplace)).filter(
    (m: any) => m.kind === "listing" && m.status === "active"
  );
  const templates = await rowsOf(itemTemplates);
  const chars = await rowsOf(characters);
  return all
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit)
    .map((m: any) => {
      const template = templates.find((tp: any) => tp.id === m.templateId) ?? null;
      const seller = chars.find((c: any) => c.id === m.sellerId) ?? null;
      const skin = m.listingType === "skin" ? skinById(String(m.skinId || "")) ?? null : null;
      return { listing: m, template, skin, seller: seller ? { id: seller.id, name: seller.name, level: seller.level } : null };
    });
}

/** Anúncios de um personagem (todos os estados). */
export async function getListingsByCharacter(characterId: string) {
  return (await rowsOf(marketplace))
    .filter((m: any) => m.kind === "listing" && m.sellerId === characterId)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** Lista itens de um characterId que estão marcados como listados. */
export async function getListedItemsByCharacter(characterId: string) {
  const items = (await rowsOf(inventoryItems)).filter(
    (i: any) => i.characterId === characterId && i.listed === true
  );
  const templates = await rowsOf(itemTemplates);
  return items.map((it: any) => {
    const template = templates.find((t: any) => t.id === it.templateId) ?? null;
    return { item: it, template, quantity: it.quantity || 1 };
  });
}

/* ─── Anúncios de troca + salas de troca (marketplace) ─── */

/** Identifica um registro como anúncio de troca ATIVO (kind no registro). */
function isTradeAd(m: any): boolean {
  return (m.kind === "tradeAd" || m.recKind === "tradeAd") && m.status === "active";
}

/** Expande itens com o template (nome/raridade/etc.). */
function expandItems(items: any[], templates: any[]): any[] {
  return (items || []).map((it: any) => {
    const template = templates.find((t: any) => t.id === it.templateId) ?? null;
    return { ...it, template };
  });
}

/** Lista os anúncios de troca ATIVOS (com dados do dono + templates). */
export async function listTradeAds(limit = 100) {
  const all = await rowsOf(marketplace);
  const templates = await rowsOf(itemTemplates);
  const chars = await rowsOf(characters);
  return all
    .filter(isTradeAd)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit)
    .map((m: any) => {
      const poster = chars.find((c: any) => c.id === m.posterId) ?? null;
      return {
        record: m,
        poster: poster ? { id: poster.id, name: poster.name, level: poster.level } : null,
        offeredItems: expandItems(m.offeredItems, templates),
      };
    });
}

/** Anúncios de troca de um personagem (ativos). */
export async function getTradeAdsByCharacter(characterId: string) {
  const all = await rowsOf(marketplace);
  return all.filter((m: any) => isTradeAd(m) && m.posterId === characterId);
}

/** Busca um registro do marketplace (anúncio ou sala) com templates. */
export async function getMarketRecExpanded(id: string) {
  const m = await getRec(marketplace, id);
  if (!m) return null;
  const templates = await rowsOf(itemTemplates);
  const chars = await rowsOf(characters);
  const poster = chars.find((c: any) => c.id === m.posterId) ?? null;
  return {
    record: m,
    poster: poster ? { id: poster.id, name: poster.name, level: poster.level } : null,
    offeredItems: expandItems(m.offeredItems, templates),
  };
}

/** Sessões de troca ativas que envolvem um personagem (perspectiva dele). */
export async function getSessionsByCharacter(characterId: string) {
  const all = await rowsOf(marketplace);
  const templates = await rowsOf(itemTemplates);
  const chars = await rowsOf(characters);
  return all
    .filter(
      (m: any) =>
        (m.kind === "tradeSession" || m.recKind === "tradeSession") &&
        m.status === "active" &&
        (m.playerAId === characterId || m.playerBId === characterId)
    )
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map((m: any) => {
      const otherId = m.playerAId === characterId ? m.playerBId : m.playerAId;
      const other = chars.find((c: any) => c.id === otherId) ?? null;
      const isA = m.playerAId === characterId;
      return {
        record: m,
        other: other ? { id: other.id, name: other.name, level: other.level } : null,
        isA,
        myConfirmed: isA ? !!m.aConfirmed : !!m.bConfirmed,
        otherConfirmed: isA ? !!m.bConfirmed : !!m.aConfirmed,
        myOffers: expandItems(isA ? m.aOffers : m.bOffers, templates),
        otherOffers: expandItems(isA ? m.bOffers : m.aOffers, templates),
      };
    });
}

/* ─── Reset do jogo (administrador) ─── */

/**
 * Apaga TODOS os dados de jogadores para "começar do zero".
 * Mantém o catálogo de itens, missões, músicas das ilhas e as configurações
 * do servidor (anúncio/manutenção/PIX) intactos — só o progresso dos
 * jogadores (contas, personagens, inventário, guildas, correio e códigos
 * usados etc.) é zerado.
 */
export async function resetGameData() {
  for (const table of [
    users,
    characters,
    inventoryItems,
    activeMissions,
    afkRewards,
    battles,
    guilds,
    guildInvites,
    guildChats,
    mailbox,
    excludedUsers,
    codes,
    marketplace,
  ]) {
    await db.delete(table);
  }
  return true;
}

/**
 * Reseta TODOS os personagens para o nível 1 com stats padrão da classe,
 * mas NÃO exclui as contas (users). Inventário, missões ativas, batalhas,
 * guildas, correio e códigos também são limpos.
 */
export async function resetCharacterData() {
  // 1. Limpa tabelas dependentes de personagens
  for (const table of [
    inventoryItems,
    activeMissions,
    afkRewards,
    battles,
    guildInvites,
    guildChats,
    mailbox,
    marketplace,
  ]) {
    await db.delete(table);
  }
  // 2. Limpa guildas (precisa limpar member references)
  await db.delete(guilds);
  // 3. Reseta todos os personagens mantendo conta e nome
  const all = await rowsOf(characters);
  for (const c of all) {
    const base = CLASS_BASE_STATS[(c.classType as any) ?? "warrior"] ?? CLASS_BASE_STATS.warrior;
    await updateRec(characters, c.id, {
      level: 1,
      xp: 0,
      xpToNext: 120,
      prestige: 0,
      skillPoints: 0,
      unspentStatPoints: 0,
      talentPoints: 0,
      talents: {},
      advancedClass: null,
      ascension: 0,
      seasonPoints: 0,
      seasonId: 0,
      // Moedas
      gold: 500,
      diamonds: 0,
      crystals: 0,
      pvpCoins: 0,
      guildCoins: 0,
      towerCoins: 0,
      // Energia
      energy: 100,
      maxEnergy: 100,
      lastEnergyAt: new Date().toISOString(),
      // Região / PvP / Torre
      currentRegion: "starter_village",
      pvpLeague: "bronze",
      pvpRating: 0,
      towerFloor: 1,
      // Pet inicial
      pets: { lobo_sombrio: { id: "lobo_sombrio", level: 1, equipped: true } },
      activePetId: "lobo_sombrio",
      // Stats base da classe
      hp: base.hp,
      maxHp: base.hp,
      attack: base.attack,
      defense: base.defense,
      speed: base.speed,
      critical: base.critical,
      precision: 5,
      dodge: 5,
      resistance: 5,
      mana: base.mana,
      maxMana: base.mana,
      power: 0,
      baseStats: {
        attack: base.attack,
        defense: base.defense,
        maxHp: base.hp,
        speed: base.speed,
        critical: base.critical,
      },
      // VIP resetado
      vipTier: null,
      vipUntil: null,
      vipLevel: 0,
      // Timestamps
      afkSince: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }, [["userId", "userId"], ["name", "name"]]);
  }
  return true;
}

export default {
  // users
  findUserByUsername,
  findUserById,
  insertUser,
  updateUser,
  listUsers,
  // characters
  findCharacterByName,
  findCharacterByUserId,
  getCharactersByUserId,
  findCharacterById,
  insertCharacter,
  updateCharacter,
  deleteCharacter,
  listCharacters,
  countRecentlyActive,
  // inventory / items
  insertInventoryItem,
  grantItem,
  isStackableTemplate,
  getInventoryForCharacter,
  getInventoryItemById,
  updateInventoryItem,
  removeInventoryItem,
  decrementInventoryItem,
  getAllItemTemplates,
  getItemTemplateById,
  getItemTemplateByNameKey,
  insertItemTemplates,
  getItemTemplatesByMaxLevel,
  // missions
  getMissionTemplates,
  insertMissionTemplates,
  upsertMissionTemplates,
  getMissionTemplateById,
  // active missions
  findActiveMissionByCharacterId,
  insertActiveMission,
  getActiveMissionById,
  updateActiveMission,
  // afk
  insertAfkReward,
  // pvp battles (histórico)
  insertBattle,
  getBattlesByCharacterId,
  // guilds v1
  listGuilds,
  insertGuild,
  findGuildById,
  updateGuild,
  deleteGuild,
  // guildas v2 (membros/convites/chat)
  findGuildByMemberId,
  insertGuildInvite,
  getGuildInviteById,
  getPendingInvitesForCharacter,
  getPendingInvitesForGuild,
  updateGuildInvite,
  hasPendingGuildInvite,
  insertGuildChatMessage,
  getGuildChatMessages,
  // skins (SKIN FULL)
  getCharacterSkins,
  addCharacterSkins,
  removeCharacterSkin,
  // caixa de correio
  sendMail,
  sendSkinMail,
  sendResourceMail,
  getMailsForCharacter,
  getMailById,
  countUnclaimedMails,
  claimMail,
  claimAllMails,
  // admin: contas excluídas / recuperação / exclusão permanente
  deleteUser,
  listExcludedUsers,
  getExcludedUserById,
  excludeUser,
  restoreUser,
  hardDeleteUser,
  resetUserPassword,
  // admin: música por ilha
  listRegionAudio,
  getRegionAudioByRegion,
  upsertRegionAudio,
  removeRegionAudio,
  // admin: anúncio global / manutenção
  getServerSettings,
  updateServerSettings,
  // admin: logs do servidor (hitkill etc.)
  addAdminLog,
  listAdminLogs,
  clearAdminLogs,
  clearAdminLogsBySource,
  // códigos de resgate
  listCodes,
  findCodeByCodeValue,
  createCode,
  deleteCode,
  updateCode,
  // mercado entre jogadores
  insertMarketRec,
  getMarketRecById,
  updateMarketRec,
  deleteMarketRec,
  listActiveListings,
  getListingsByCharacter,
  getListedItemsByCharacter,
  // anúncios de troca + salas de troca
  listTradeAds,
  getTradeAdsByCharacter,
  getMarketRecExpanded,
  getSessionsByCharacter,
  MARKET_SYSTEM_ID,
  // compras PIX (diamantes)
  listPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  // Livro-razão permanente (reenvio de diamantes após reset)
  listPurchaseLedger,
  appendPurchaseLedger,
  updatePurchaseLedgerEntry,
  deletePurchaseLedgerEntry,
  // evento global — Boss Mundial
  getWorldBossEvent,
  saveWorldBossEvent,
  decrementWorldBossHp,
  resetGameData,
  resetCharacterData,
};