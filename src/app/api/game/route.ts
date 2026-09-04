import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    // A action da URL tem precedência; o body pode trazer action somente
    // quando a URL não define (compat) — evita que sub-comandos dos painéis
    // (ex.: tower "attack", pvp-battle "defend") sobrescrevam a action real.
    const action = String(url.searchParams.get("action") || body?.action || "");
    const handlers: Record<string, () => Promise<any>> = {
      "pets":              () => import("@/game/api-handlers/pets"),
      "relics":            () => import("@/game/api-handlers/relics"),
      "codes-redeem":      () => import("@/game/api-handlers/codes-redeem"),
      "afk-start":         () => import("@/game/api-handlers/afk-start"),
      "afk-claim":         () => import("@/game/api-handlers/afk-claim"),
      "world-exploration": () => import("@/game/api-handlers/world-exploration"),
      "random-event":      () => import("@/game/api-handlers/random-event"),
      "presence":          () => import("@/game/api-handlers/presence"),
      "seed":              () => import("@/game/api-handlers/seed"),
      "craft":             () => import("@/game/api-handlers/craft"),
      "server-settings":   () => import("@/game/api-handlers/server-settings"),
      "rankings":          () => import("@/game/api-handlers/rankings"),
      "season":            () => import("@/game/api-handlers/season"),
      "health":            () => import("@/game/api-handlers/health"),
      "notifications":     () => import("@/game/api-handlers/notifications-check"),
      "craft-recipes":     () => import("@/game/api-handlers/craft-recipes"),
      "daily":             () => import("@/game/api-handlers/missions-daily"),
      "mission-claim":     () => import("@/game/api-handlers/missions-claim"),
      "mission-start":     () => import("@/game/api-handlers/missions-start"),
      "daily-events":      () => import("@/game/api-handlers/daily-events"),
      "daily-login":       () => import("@/game/api-handlers/daily-login"),
      "questlines":        () => import("@/game/api-handlers/questlines"),
      "achievements":      () => import("@/game/api-handlers/achievements"),
      "ascension":         () => import("@/game/api-handlers/ascension"),
      "bestiary":          () => import("@/game/api-handlers/bestiary"),
      "collection":        () => import("@/game/api-handlers/collection"),
      "enchantments":      () => import("@/game/api-handlers/enchantments"),
      "forge":             () => import("@/game/api-handlers/forge"),
      "specialization":    () => import("@/game/api-handlers/specialization"),
      "refinement":        () => import("@/game/api-handlers/refinement"),
      "advanced-class":    () => import("@/game/api-handlers/advanced-class"),
      "inheritance":       () => import("@/game/api-handlers/inheritance"),
      "tower":             () => import("@/game/api-handlers/tower-fight"),
      "tower-challenge":   () => import("@/game/api-handlers/tower-challenge"),
      "pvp-battle":        () => import("@/game/api-handlers/pvp-battle"),
      "pvp-fight":         () => import("@/game/api-handlers/pvp-fight"),
      "region-farm":       () => import("@/game/api-handlers/region-farm"),
      "region-mini-boss":  () => import("@/game/api-handlers/region-mini-boss"),
      "region-boss-fight": () => import("@/game/api-handlers/region-boss-fight"),
      "region-boss":       () => import("@/game/api-handlers/region-boss"),
      "region-audio":      () => import("@/game/api-handlers/region-audio"),
      "region-change":     () => import("@/game/api-handlers/region-change"),
      "world-boss-attack":      () => import("@/game/api-handlers/world-boss-attack"),
      "world-boss-enter":       () => import("@/game/api-handlers/world-boss-enter"),
      "world-boss-leave":       () => import("@/game/api-handlers/world-boss-leave"),
      "world-boss-break-shield":() => import("@/game/api-handlers/world-boss-break-shield"),
      "world-boss-invite":      () => import("@/game/api-handlers/world-boss-invite"),
      "world-boss-respond":     () => import("@/game/api-handlers/world-boss-respond"),
      "survival-arena":    () => import("@/game/api-handlers/survival-arena"),
      "dungeon-start":     () => import("@/game/api-handlers/dungeon-start"),
      "dungeon-collect":   () => import("@/game/api-handlers/dungeon-collect"),
    };
    // Guild actions — forward to guild-all handler
    const guildActions = ["upload_logo","create","donate","upgrade","leave","kick","transfer","invite","accept","decline","my_accept","my_decline","chat","shop","buy_upgrade","buy_bonus","skills","invest_skill","reset_skills","guild_boss","boss_attack","boss_enter","boss_leave","guild_war","war_attack","war_join","war_leave","war_history"];
    if (guildActions.includes(action)) {
      const mod = await import("@/game/api-handlers/guild-all");
      return mod.POST(req);
    }
    if (!handlers[action]) {
      return NextResponse.json({ error: `Action inválida. Disponíveis: ${Object.keys(handlers).join(", ")}` }, { status: 400 });
    }
    const mod = await handlers[action]();
    return (mod.POST || mod.GET)(req);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const handlers: Record<string, () => Promise<any>> = {
      "server-settings": () => import("@/game/api-handlers/server-settings"),
      "rankings":        () => import("@/game/api-handlers/rankings"),
      "season":          () => import("@/game/api-handlers/season"),
      "health":          () => import("@/game/api-handlers/health"),
      "notifications":   () => import("@/game/api-handlers/notifications-check"),
      "craft-recipes":   () => import("@/game/api-handlers/craft-recipes"),
      "craft":           () => import("@/game/api-handlers/craft"),
      "presence":        () => import("@/game/api-handlers/presence"),
      "daily":           () => import("@/game/api-handlers/missions-daily"),
      "daily-events":    () => import("@/game/api-handlers/daily-events"),
      "daily-login":     () => import("@/game/api-handlers/daily-login"),
      "questlines":      () => import("@/game/api-handlers/questlines"),
      "achievements":    () => import("@/game/api-handlers/achievements"),
      "bestiary":        () => import("@/game/api-handlers/bestiary"),
      "collection":      () => import("@/game/api-handlers/collection"),
      "pets":            () => import("@/game/api-handlers/pets"),
      "relics":          () => import("@/game/api-handlers/relics"),
      "specialization":  () => import("@/game/api-handlers/specialization"),
      "refinement":      () => import("@/game/api-handlers/refinement"),
      "advanced-class":  () => import("@/game/api-handlers/advanced-class"),
      "ascension":       () => import("@/game/api-handlers/ascension"),
      "inheritance":     () => import("@/game/api-handlers/inheritance"),
      "enchantments":    () => import("@/game/api-handlers/enchantments"),
      "pvp-history":     () => import("@/game/api-handlers/pvp-history"),
      "pvp-ranking":     () => import("@/game/api-handlers/pvp-ranking"),
      "pvp-season":      () => import("@/game/api-handlers/pvp-season"),
      "pvp-fight":       () => import("@/game/api-handlers/pvp-fight"),
      "tower-challenge": () => import("@/game/api-handlers/tower-challenge"),
      "region-audio":    () => import("@/game/api-handlers/region-audio"),
      "region-boss":     () => import("@/game/api-handlers/region-boss"),
      "region-farm":     () => import("@/game/api-handlers/region-farm"),
      "region-mini-boss":() => import("@/game/api-handlers/region-mini-boss"),
      "world-boss":      () => import("@/game/api-handlers/world-boss"),
      "world-exploration": () => import("@/game/api-handlers/world-exploration"),
      "random-event":    () => import("@/game/api-handlers/random-event"),
      "survival-arena":  () => import("@/game/api-handlers/survival-arena"),
      "dungeon-ranking": () => import("@/game/api-handlers/dungeon-ranking"),
    };
    // Guild GET — forward to guild-all handler (status, chat, skills, shop, boss, war)
    const guildGetActions = ["guild", "guilds", "chat", "skills", "shop", "guild_boss", "guild_war"];
    if (guildGetActions.includes(action) || (!action && new URL(req.url).searchParams.has("characterId"))) {
      const mod = await import("@/game/api-handlers/guild-all");
      return mod.GET(req);
    }
    if (!handlers[action]) {
      return NextResponse.json({ error: "GET action inválida" }, { status: 400 });
    }
    const mod = await handlers[action]();
    return (mod.GET || mod.POST)(req);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
