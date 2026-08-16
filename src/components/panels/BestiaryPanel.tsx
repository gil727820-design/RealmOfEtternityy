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
      const res = await fetch(`/api/bestiary?characterId=${encodeURIComponent(characterId)}`);
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
      const res = await fetch("/api/bestiary", {
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
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0">
                  <div className="font-black text-white">{t("region." + cat.category, locale)}</div>
                  <div className="text-[11px] text-gray-500">
                    {t("bestiary.defeated", locale)}: {cat.defeated}/{cat.total}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">✓</span>
                  )}
                  <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {cat.entries.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-xl border p-2 text-center ${e.defeated ? "border-[#22c55e]/40 bg-[#22c55e]/5" : "border-white/10 bg-[#0a0a12] opacity-50 grayscale"}`}
                      title={t(e.nameKey, locale)}
                    >
                      <div className="text-2xl mb-1">{e.defeated ? e.icon : "❓"}</div>
                      <div className="text-[9px] text-gray-400 font-bold truncate">
                        {e.defeated ? t(e.nameKey, locale) : "???"}
                      </div>
                      <div className="text-[8px] text-gray-600">
                        {TIER_ICONS[e.tier] || ""} {e.defeated ? `${t("bestiary.kills", locale)}: ${e.kills}` : ""}
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
