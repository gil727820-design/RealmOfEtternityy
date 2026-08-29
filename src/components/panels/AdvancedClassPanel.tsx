"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

type AdvDef = {
  id: string;
  cls: string;
  nameKey: string;
  descKey: string;
  icon: string;
  minLevel: number;
  goldCost: number;
  diamondCost: number;
  attackPct?: number;
  defensePct?: number;
  maxHpPct?: number;
  critical?: number;
  speed?: number;
  xpMult?: number;
  goldMult?: number;
  skillDmgMult?: number;
  mechanic: string;
};

export default function AdvancedClassPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/progression?action=advanced-class&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const evolve = async () => {
    if (!characterId) return;
    const def = data?.definition as AdvDef | null;
    if (!def) return;
    if (!window.confirm(t("adv.confirm", locale))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/progression?action=advanced-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await res.json();
      if (!d.success) { notify(d.error, "error"); return; }
      notify(t("adv.evolved", locale), "success");
      await load();
      const res2 = await fetch(`/api/character?id=${characterId}`);
      const d2 = await res2.json();
      if (d2.character) setCharacter(d2.character);
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusy(false);
    }
  };

  const def = (data?.definition as AdvDef) || null;
  const current = (data?.current as AdvDef) || null;
  const catalog = (Array.isArray(data?.catalog) ? (data.catalog as AdvDef[]) : []) as (AdvDef & { mine?: boolean })[];
  const canEvolve = !!data?.canEvolve;
  const gold = Number(data?.gold || 0);
  const diamonds = Number(data?.diamonds || 0);
  const level = Number(data?.level || 1);
  const minLevel = Number(data?.minLevel || 50);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl">🌟</span>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t("adv.title", locale)}</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">{t("general.loading", locale)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Estado atual */}
          <div className="game-card game-card-glow p-6">
            {current ? (
              <div className="text-center">
                <div className="text-6xl mb-2 animate-float">{current.icon}</div>
                <div className="text-2xl font-black text-[#ffd700]">{t(current.nameKey, locale)}</div>
                <div className="text-sm text-gray-400 mt-1">{t(current.descKey, locale)}</div>
                <div className="inline-block mt-3 text-xs font-bold bg-[#ffd700]/10 border border-[#ffd700]/40 text-[#ffd700] rounded-full px-4 py-1.5">
                  🌟 {t("adv.unlocked", locale)}
                </div>
              </div>
            ) : def ? (
              <div className="text-center">
                <div className="text-6xl mb-2 animate-float">{def.icon}</div>
                <div className="text-2xl font-black text-white">{t(def.nameKey, locale)}</div>
                <div className="text-sm text-gray-400 mt-1">{t(def.descKey, locale)}</div>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {def.attackPct ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">⚔️ +{def.attackPct}% {t("stat.attack", locale)}</span> : null}
                  {def.defensePct ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">🛡️ +{def.defensePct}% {t("stat.defense", locale)}</span> : null}
                  {def.maxHpPct ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">❤️ +{def.maxHpPct}% {t("stat.hp", locale)}</span> : null}
                  {def.critical ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">💥 +{def.critical} {t("stat.critical", locale)}</span> : null}
                  {def.speed ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">💨 +{def.speed} {t("stat.speed", locale)}</span> : null}
                  {def.xpMult ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">📈 +{Math.round((def.xpMult - 1) * 100)}% XP</span> : null}
                  {def.goldMult ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">💰 +{Math.round((def.goldMult - 1) * 100)}% {t("stat.gold", locale)}</span> : null}
                  {def.skillDmgMult ? <span className="bg-white/5 rounded-full px-3 py-1 text-xs text-gray-300">✨ +{Math.round((def.skillDmgMult - 1) * 100)}% {t("adv.skillBoost", locale)}</span> : null}
                </div>
                <div className="text-[11px] text-gray-500 mt-2">{t(def.mechanic, locale)}</div>
                {!canEvolve && (
                  <div className="text-sm text-red-400 font-bold mt-4">🔒 {t("adv.levelReq", locale)} {minLevel}+ (atual: {level})</div>
                )}
                {canEvolve && (
                  <div className="mt-4">
                    <div className={`text-xs mb-2 ${gold >= def.goldCost ? "text-[#00ff88]" : "text-red-400"}`}>
                      {gold >= def.goldCost ? "✅" : "❌"} 🪙 {def.goldCost.toLocaleString()}
                      <span className="mx-2 text-gray-500">•</span>
                      <span className={diamonds >= def.diamondCost ? "text-[#00ff88]" : "text-red-400"}>
                        {diamonds >= def.diamondCost ? "✅" : "❌"} 💎 {def.diamondCost}
                      </span>
                    </div>
                    <button onClick={evolve} disabled={busy}
                      className="game-btn px-6 disabled:opacity-40">
                      {busy ? "..." : `🌟 ${t("adv.evolve", locale)} (🪙 ${def.goldCost.toLocaleString()} • 💎 ${def.diamondCost})`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">{t("adv.none", locale)}</div>
            )}
          </div>

          {/* Catálogo */}
          <div>
            <h3 className="font-bold text-lg mb-3">📚 {t("adv.catalog", locale)}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.map((a) => (
                <div key={a.id} className={`game-card p-4 ${a.mine ? "border-[#ffd700]/50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        {t(a.nameKey, locale)}
                        {a.mine && <span className="text-[9px] bg-[#ffd700]/20 text-[#ffd700] rounded-full px-2 py-0.5">✓ {t("adv.unlocked", locale)}</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{t(a.descKey, locale)}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {CLASS_ICON(a.cls)} Lv.{a.minLevel}+ • 🪙 {a.goldCost.toLocaleString()} • 💎 {a.diamondCost}
                      </div>
                      {a.cls === def?.cls && a.mine ? null : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CLASS_ICON(cls: string): string {
  const map: Record<string, string> = {
    warrior: "⚔️", paladin: "🛡️", berserker: "🪓", mage: "🔮", necromancer: "💀",
    assassin: "🗡️", hunter: "🏹", monk: "🥋", samurai: "⛩️", knight: "🏰",
    summoner: "✨", templar: "✝️", archer: "🎯",
  };
  return map[cls] ?? "⭐";
}
