"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

interface BestiaryEntryUI {
  id: string;
  nameKey: string;
  icon: string;
  image: string;
  tier: number;
  kills: number;
  defeated: boolean;
}
interface BestiaryCategory {
  category: string;
  total: number;
  defeated: number;
  complete: boolean;
  claimed: boolean;
  entries: BestiaryEntryUI[];
}
interface BestiaryProgress {
  defeated: number;
  total: number;
  pct: number;
}

const TIER_ICONS: Record<number, string> = { 1: "▪️", 2: "⭐", 3: "💀", 4: "👑" };
const TIER_HINTS: Record<number, string> = {
  1: "Lute contra monstros comuns na região para descobrir",
  2: "Encontre e derrote monstros ELITE na região (5% chance)",
  3: "Enfrente o MINI-BOSS da região (cooldown 30 min)",
  4: "Derrote o BOSS REGIONAL da região (1x por dia)",
};
const TIER_COLORS: Record<number, string> = { 1: "text-gray-400", 2: "text-green-400", 3: "text-purple-400", 4: "text-amber-400" };

export default function BestiaryPanel() {
  const { characterId, locale, notify, setCharacter } = useGameStore();
  const [progress, setProgress] = useState<BestiaryProgress | null>(null);
  const [categories, setCategories] = useState<BestiaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/progression?action=bestiary&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setProgress(d.progress ?? null);
      setCategories(Array.isArray(d.categories) ? d.categories : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claim = async (category: string) => {
    if (!characterId) return;
    setBusy(category);
    try {
      const res = await fetch("/api/progression?action=bestiary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, category }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else {
        const r = d.reward;
        notify(`🏆 ${t("bestiary.claimed", locale)}: 🪙 ${r.gold} · 🔮 ${r.crystals} · 🗼 ${r.towerCoins}`, "success");
        if (d.character) setCharacter(d.character);
        await load();
      }
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
        <div className="spinner mb-4"></div>
        <p className="text-gray-400">{t("general.loading", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">📖</span>
        <span className="bg-gradient-to-r from-[#22c55e] to-[#84cc16] bg-clip-text text-transparent">
          {t("bestiary.title", locale)}
        </span>
      </h2>

      {/* Progresso geral */}
      <div className="game-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-white">{t("bestiary.progress", locale)}</span>
          <span className="text-sm text-gray-400">
            {progress?.defeated ?? 0}/{progress?.total ?? 0} ({progress?.pct ?? 0}%)
          </span>
        </div>
        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#22c55e] to-[#84cc16] transition-all"
            style={{ width: `${progress?.pct ?? 0}%` }}
          />
        </div>
        <div className="text-[11px] text-gray-500 mt-2">{t("bestiary.bonusHint", locale)}</div>
      </div>

      {/* Categorias */}
      <div className="space-y-3">
        {categories.length === 0 && (
          <div className="game-card p-8 text-center text-sm text-gray-500">{t("bestiary.empty", locale)}</div>
        )}
        {categories.map((cat) => {
          const isOpen = expanded === cat.category;
          const pct = cat.total > 0 ? Math.round((cat.defeated / cat.total) * 100) : 0;
          return (
            <div key={cat.category} className="game-card p-4">
              <button
                onClick={() => setExpanded(isOpen ? null : cat.category)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">{t("region." + cat.category, locale)}</span>
                    {cat.complete && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-bold">✅ Completo</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[120px]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cat.complete ? "linear-gradient(90deg, #22c55e, #84cc16)" : "linear-gradient(90deg, #6366f1, #a855f7)" }} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">{cat.defeated}/{cat.total} ({pct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cat.complete && !cat.claimed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); claim(cat.category); }}
                      disabled={busy === cat.category}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black font-black disabled:opacity-40"
                    >
                      {busy === cat.category ? "…" : `🎁 ${t("bestiary.claim", locale)}`}
                    </button>
                  )}
                  {cat.claimed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">✓ Coletado</span>
                  )}
                  <span className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {cat.entries.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-xl border p-2.5 text-center transition-all ${e.defeated ? "border-[#22c55e]/40 bg-[#22c55e]/8 shadow-[0_0_10px_rgba(34,197,94,0.1)]" : "border-white/10 bg-[#0a0a12] opacity-60"}`}
                      title={e.defeated ? t(e.nameKey, locale) : TIER_HINTS[e.tier] || "Derrote para descobrir"}
                    >
                      <div className="text-2xl mb-1">{e.defeated ? e.icon : "❓"}</div>
                      <div className={`text-[9px] font-bold truncate ${e.defeated ? "text-gray-200" : "text-gray-500"}`}>
                        {e.defeated ? t(e.nameKey, locale) : "???"}
                      </div>
                      <div className="text-[8px] mt-0.5">
                        {e.defeated ? (
                          <span className="text-gray-500">{TIER_ICONS[e.tier]} {t("bestiary.kills", locale)}: {e.kills}</span>
                        ) : (
                          <span className={`italic ${TIER_COLORS[e.tier] || "text-gray-600"}`}>{TIER_HINTS[e.tier]?.slice(0, 30)}...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
