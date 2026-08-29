import {
  sqliteTable, text, integer,
} from "drizzle-orm/sqlite-core";

/*
 * Schema SQLite — substitui o Postgres (Supabase).
 * Cada "coleção" que o antigo jsonDb guardava em arquivos JSON virou uma tabela:
 *   - coluna de identidade / consulta (`id`, `userId`, `name`, `characterId`...),
 *   - uma coluna `data text` com o documento JSON completo.
 * Isso preserva 100% do formato (campos dinâmicos como talents, skins,
 * achievements, missionBatch, afkSince etc.) e mantém as rotas funcionando
 * com as mesmas assinaturas do antigo jsonDb — só que agora em SQLite local.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username"),
  data: text("data").notNull(),
});

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name"),
  data: text("data").notNull(),
});

export const itemTemplates = sqliteTable("item_templates", {
  id: integer("id").primaryKey(),
  nameKey: text("name_key"),
  data: text("data").notNull(),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  characterId: text("character_id"),
  data: text("data").notNull(),
});

export const missionTemplates = sqliteTable("mission_templates", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(),
});

export const activeMissions = sqliteTable("active_missions", {
  id: text("id").primaryKey(),
  characterId: text("character_id"),
  data: text("data").notNull(),
});

export const afkRewards = sqliteTable("afk_rewards", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});

export const battles = sqliteTable("battles", {
  id: text("id").primaryKey(),
  characterId: text("character_id"),
  data: text("data").notNull(),
});

// id de guilda tem formato `${Date.now()}_${rand}` (não é uuid válido)
export const guilds = sqliteTable("guilds", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});

export const guildInvites = sqliteTable("guild_invites", {
  id: text("id").primaryKey(),
  targetCharacterId: text("target_character_id"),
  guildId: text("guild_id"),
  data: text("data").notNull(),
});

export const guildChats = sqliteTable("guild_chats", {
  id: text("id").primaryKey(),
  guildId: text("guild_id"),
  data: text("data").notNull(),
});

export const mailbox = sqliteTable("mailbox", {
  id: text("id").primaryKey(),
  characterId: text("character_id"),
  data: text("data").notNull(),
});

// A coleção excludedUsers é chaveada por `userId` (sem campo `id` próprio)
export const excludedUsers = sqliteTable("excluded_users", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
});

// A coleção regionAudio é chaveada por `regionId`
export const regionAudio = sqliteTable("region_audio", {
  regionId: text("region_id").primaryKey(),
  data: text("data").notNull(),
});

// Configurações globais do servidor (anúncio + manutenção) — 1 linha chaveada por `key`
export const serverSettings = sqliteTable("server_settings", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
});

// Códigos de resgate gerados pelo admin (boost 2x XP / 2x Energia)
export const codes = sqliteTable("codes", {
  id: text("id").primaryKey(),
  code: text("code"),
  data: text("data").notNull(),
});

// Mercado entre jogadores: anúncios de venda (`kind = "listing"`) e propostas
// de troca (`kind = "trade"`). A coluna `kind` discrimina os dois fluxos.
export const marketplace = sqliteTable("marketplace", {
  id: text("id").primaryKey(),
  characterId: text("character_id"),
  kind: text("kind"),
  data: text("data").notNull(),
});

// Logs administrativos do servidor (ex.: avisos de hitkill na torre / boss
// mundial). A coluna `kind` permite filtrar por tipo de evento.
export const adminLogs = sqliteTable("admin_logs", {
  id: text("id").primaryKey(),
  kind: text("kind"),
  data: text("data").notNull(),
});
