#!/usr/bin/env node
/**
 * Script to update all frontend fetch calls from old API routes to consolidated routes.
 * Run: node scripts/update-api-routes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SRC = "src";

// Map: old URL pattern → { newUrl, action }
const ROUTE_MAP = {
  // Character
  "/api/character/create":      { url: "/api/character", action: "create", body: true },
  "/api/character/allocate":    { url: "/api/character", action: "allocate", body: true },
  "/api/character/skill":       { url: "/api/character", action: "skill", body: true },
  "/api/character/prestige":    { url: "/api/character", action: "prestige", body: true },
  "/api/character/reset-stats": { url: "/api/character", action: "reset-stats", body: true },
  "/api/character/change-class":{ url: "/api/character", action: "change-class", body: true },

  // Inventory
  "/api/inventory/equip":     { url: "/api/inventory", action: "equip", body: true },
  "/api/inventory/sell":      { url: "/api/inventory", action: "sell", body: true },
  "/api/inventory/use":       { url: "/api/inventory", action: "use", body: true },
  "/api/inventory/auto-equip":{ url: "/api/inventory", action: "auto-equip", body: true },
  "/api/inventory/skin":      { url: "/api/inventory", action: "skin", body: true },
  "/api/inventory/remove":    { url: "/api/inventory", action: "remove", body: true },

  // Combat
  "/api/tower/fight":         { url: "/api/combat", action: "tower", body: true },
  "/api/tower/challenge":     { url: "/api/combat", action: "tower-challenge", body: true },
  "/api/pvp/battle":          { url: "/api/combat", action: "pvp-battle", body: true },
  "/api/pvp/fight":           { url: "/api/combat", action: "pvp-fight", body: true },
  "/api/region/farm":         { url: "/api/combat", action: "region-farm", body: true },
  "/api/region/mini-boss":    { url: "/api/combat", action: "region-mini-boss", body: true },
  "/api/region-boss/fight":   { url: "/api/combat", action: "region-boss-fight", body: true },
  "/api/world-boss/attack":   { url: "/api/combat", action: "world-boss-attack", body: true },
  "/api/world-boss/break-shield": { url: "/api/combat", action: "world-boss-break-shield", body: true },
  "/api/survival-arena":      { url: "/api/combat", action: "survival-arena", body: true },

  // Guild
  "/api/guild-war":           { url: "/api/guild", action: "guild_war", body: true },
  "/api/guild-boss":          { url: "/api/guild", action: "guild_boss", body: true },

  // Missions
  "/api/missions/daily":      { url: "/api/missions", action: "daily", body: true },
  "/api/missions/claim":      { url: "/api/missions", action: "claim", body: true },
  "/api/missions/start":      { url: "/api/missions", action: "start", body: true },
  "/api/daily-events":        { url: "/api/missions", action: "daily-events", body: true },
  "/api/daily-login":         { url: "/api/missions", action: "daily-login", body: true },
  "/api/questlines":          { url: "/api/missions", action: "questlines", body: true },

  // Dungeon
  "/api/dungeon/start":       { url: "/api/dungeon", action: "start", body: true },
  "/api/dungeon/collect":     { url: "/api/dungeon", action: "collect", body: true },

  // Shop
  "/api/ghost-shop/buy":      { url: "/api/shop", action: "ghost-buy", body: true },
  "/api/skin-shop":           { url: "/api/shop", action: "skin-shop", body: true },
  "/api/market/buy":          { url: "/api/shop", action: "market-buy", body: true },
  "/api/market/cancel":       { url: "/api/shop", action: "market-cancel", body: true },
  "/api/shop/buy":            { url: "/api/shop", action: "shop-buy", body: true },
  "/api/pix/purchase":        { url: "/api/shop", action: "pix-purchase", body: true },

  // Social
  "/api/trade-ads/chat":      { url: "/api/social", action: "trade-ads-chat", body: true },
  "/api/trade-ads/remove":    { url: "/api/social", action: "trade-ads-remove", body: true },
  "/api/trade-session/open":  { url: "/api/social", action: "trade-open", body: true },
  "/api/trade-session/select":{ url: "/api/social", action: "trade-select", body: true },
  "/api/trade-session/chat":  { url: "/api/social", action: "trade-chat", body: true },
  "/api/trade-session/confirm":{ url: "/api/social", action: "trade-confirm", body: true },
  "/api/trade-session/cancel":{ url: "/api/social", action: "trade-cancel", body: true },

  // Progression
  "/api/achievements":        { url: "/api/progression", action: "achievements", body: true },
  "/api/ascension":           { url: "/api/progression", action: "ascension", body: true },
  "/api/bestiary":            { url: "/api/progression", action: "bestiary", body: true },
  "/api/collection":          { url: "/api/progression", action: "collection", body: true },
  "/api/enchantments":        { url: "/api/progression", action: "enchantments", body: true },
  "/api/forge":               { url: "/api/progression", action: "forge", body: true },
  "/api/specialization":      { url: "/api/progression", action: "specialization", body: true },
  "/api/refinement":          { url: "/api/progression", action: "refinement", body: true },
  "/api/advanced-class":      { url: "/api/progression", action: "advanced-class", body: true },
  "/api/inheritance":         { url: "/api/progression", action: "inheritance", body: true },

  // Game
  "/api/pets":                { url: "/api/game", action: "pets", body: true },
  "/api/relics":              { url: "/api/game", action: "relics", body: true },
  "/api/codes/redeem":        { url: "/api/game", action: "codes-redeem", body: true },
  "/api/afk/start":           { url: "/api/game", action: "afk-start", body: true },
  "/api/afk/claim":           { url: "/api/game", action: "afk-claim", body: true },
  "/api/world-exploration":   { url: "/api/game", action: "world-exploration", body: true },
  "/api/random-event":        { url: "/api/game", action: "random-event", body: true },
  "/api/presence":            { url: "/api/game", action: "presence", body: true },
  "/api/seed":                { url: "/api/game", action: "seed", body: true },
  "/api/craft":               { url: "/api/game", action: "craft", body: true },
};

// GET-only routes (no body needed)
const GET_ROUTES = {
  "/api/pvp/history":           { url: "/api/combat", action: "pvp-history" },
  "/api/pvp/ranking":           { url: "/api/combat", action: "pvp-ranking" },
  "/api/pvp/season":            { url: "/api/combat", action: "pvp-season" },
  "/api/dungeon/ranking":       { url: "/api/dungeon", action: "ranking" },
  "/api/ghost-shop":            { url: "/api/shop", action: "ghost-shop" },
  "/api/market":                { url: "/api/shop", action: "market" },
  "/api/trade-ads":             { url: "/api/social", action: "trade-ads" },
  "/api/trade-session/sessions":{ url: "/api/social", action: "trade-sessions" },
  "/api/server/settings":       { url: "/api/game", action: "server-settings" },
  "/api/rankings":              { url: "/api/game", action: "rankings" },
  "/api/season":                { url: "/api/game", action: "season" },
  "/api/health":                { url: "/api/game", action: "health" },
  "/api/craft/recipes":         { url: "/api/game", action: "craft-recipes" },
  "/api/notifications/check":   { url: "/api/game", action: "notifications" },
};

function getAllFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory() && entry !== "node_modules" && entry !== ".next") {
      results.push(...getAllFiles(full));
    } else if (extname(entry) === ".tsx" || extname(entry) === ".ts") {
      results.push(full);
    }
  }
  return results;
}

let totalChanges = 0;
const files = getAllFiles(join(SRC, "components")).concat(getAllFiles(join(SRC, "store"))).concat(getAllFiles(join(SRC, "app")));

for (const filePath of files) {
  let content = readFileSync(filePath, "utf-8");
  let changed = false;

  // Handle POST routes (fetch with body)
  for (const [oldUrl, { url: newUrl, action }] of Object.entries(ROUTE_MAP)) {
    // Pattern: fetch("/api/OLD", { method: "POST", ... body: JSON.stringify({...}) })
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Replace in fetch calls
    const fetchRegex = new RegExp(`fetch\\(("|'|\`)${escapedOld}("|'|\\`)`, "g");
    if (fetchRegex.test(content)) {
      // Replace URL
      content = content.replace(new RegExp(`(("|'|\`)${escapedOld}("|'|\\`))`, "g"), `$1`.replace(escapedOld, newUrl));
      // We need to add action to the body - this is complex, let's do it differently
    }

    // Simpler approach: just replace the URL string
    const strRegex = new RegExp(`(["'\`])${escapedOld}(["'\`])`, "g");
    if (strRegex.test(content)) {
      const count = (content.match(strRegex) || []).length;
      if (count > 0) {
        content = content.replace(strRegex, `$1${newUrl}$2`);
        // Now we need to add action to body. This is harder.
        // Let's add a comment marker for manual review
        changed = true;
        totalChanges += count;
      }
    }
  }

  // Handle GET routes
  for (const [oldUrl, { url: newUrl, action }] of Object.entries(GET_ROUTES)) {
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const strRegex = new RegExp(`(["'\`])${escapedOld}(["'\`])`, "g");
    if (strRegex.test(content)) {
      const count = (content.match(strRegex) || []).length;
      content = content.replace(strRegex, `$1${newUrl}?action=${action}$2`);
      changed = true;
      totalChanges += count;
    }
    // Handle template literals with existing query params
    const tplRegex = new RegExp(`(["'\`])${escapedOld}\\?`, "g");
    if (tplRegex.test(content)) {
      content = content.replace(tplRegex, `$1${newUrl}?action=${action}&`);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, content, "utf-8");
    console.log(`✅ Updated: ${filePath}`);
  }
}

console.log(`\n📊 Total URL replacements: ${totalChanges}`);
console.log(`⚠️  NOTE: Body actions need manual addition for POST routes!`);
