import {
  pgTable, text, integer, jsonb, uuid, varchar
} from "drizzle-orm/pg-core";

/*
 * Persistência no Supabase (Postgres).
 * Cada "coleção" que o antigo jsonDb guardava em arquivos JSON virou uma tabela:
 *   - coluna de identidade / consulta (`id`, `userId`, `name`, `characterId`...),
 *   - uma coluna `data jsonb` com o documento completo.
 * Isso preserva 100% do formato (campos dinâmicos como talents, skins,
 * achievements, missionBatch, afkSince etc.) e mantém as rotas funcionando
 * com as mesmas assinaturas do antigo jsonDb — só que agora no Supabase.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  username: varchar("username", { length: 40 }),
  data: jsonb("data").notNull(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id"),
  name: varchar("name", { length: 30 }),
  data: jsonb("data").notNull(),
});

export const itemTemplates = pgTable("item_templates", {
  id: integer("id").primaryKey(),
  nameKey: varchar("name_key", { length: 100 }),
  data: jsonb("data").notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id"),
  data: jsonb("data").notNull(),
});

export const missionTemplates = pgTable("mission_templates", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const activeMissions = pgTable("active_missions", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id"),
  data: jsonb("data").notNull(),
});

export const afkRewards = pgTable("afk_rewards", {
  id: uuid("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const battles = pgTable("battles", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id"),
  data: jsonb("data").notNull(),
});

// id de guilda tem formato `${Date.now()}_${rand}` (não é uuid válido)
export const guilds = pgTable("guilds", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const guildInvites = pgTable("guild_invites", {
  id: uuid("id").primaryKey(),
  targetCharacterId: uuid("target_character_id"),
  guildId: text("guild_id"),
  data: jsonb("data").notNull(),
});

export const guildChats = pgTable("guild_chats", {
  id: uuid("id").primaryKey(),
  guildId: text("guild_id"),
  data: jsonb("data").notNull(),
});

export const mailbox = pgTable("mailbox", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id"),
  data: jsonb("data").notNull(),
});

// A coleção excludedUsers é chaveada por `userId` (sem campo `id` próprio)
export const excludedUsers = pgTable("excluded_users", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull(),
});

// A coleção regionAudio é chaveada por `regionId`
export const regionAudio = pgTable("region_audio", {
  regionId: text("region_id").primaryKey(),
  data: jsonb("data").notNull(),
});

// Configurações globais do servidor (anúncio + manutenção) — 1 linha chaveada por `key`
export const serverSettings = pgTable("server_settings", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
});

// Códigos de resgate gerados pelo admin (boost 2x XP / 2x Energia)
export const codes = pgTable("codes", {
  id: uuid("id").primaryKey(),
  code: text("code"),
  data: jsonb("data").notNull(),
});

// Reportes de bug / feedback enviados pelos jogadores
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey(),
  data: jsonb("data").notNull(),
});

// Mercado entre jogadores: anúncios de venda (`kind = "listing"`) e propostas
// de troca (`kind = "trade"`). A coluna `kind` discrimina os dois fluxos.
export const marketplace = pgTable("marketplace", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id"),
  kind: text("kind"),
  data: jsonb("data").notNull(),
});