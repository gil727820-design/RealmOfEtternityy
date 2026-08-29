"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

interface CatUI {
  category: string;
  icon: string;
  nameKey: string;
  total: number;
  unlocked: number;
  complete: boolean;
  claimed: boolean;
}

export default function CollectionPanel() {
  const { characterId, locale, notify, setCharacter } = useGameStore();
  const [progress, setProgress] = useState<{ total: number; unlocked: number; pct: number; categories: CatUI[] } | null>(null);
  const [bonus, setBonus] = useState<{ xpPct: number; goldPct: number; completed: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/progression?action=collection&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setProgress(d.progress ?? null);
      setBonus(d.bonus ?? null);
    } catch { /* ignore */ }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claim = async (category: string) => {
    if (!characterId) return;
    setBusy(category);
    try {
      const res = await fetch("/api/progression?action=collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, category }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else {
        const r = d.reward;
        notify(`📚 ${t("collection.claimed", locale)}: 🪙 ${r.gold} · 💎 ${r.diamonds} · 🔮 ${r.crystals}`, "success");
        if (d.character) setCharacter(d.character);
        await load();
      }
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">📚</span>
        <span className="bg-gradient-to-r from-[#f97316] to-[#ffd700] bg-clip-text text-transparent">
          {t("collection.title", locale)}
        </span>
      </h2>

      {/* Progresso geral */}
      <div className="game-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-white">{t("collection.progress", locale)}</span>
          <span className="text-sm text-gray-400">{progress?.unlocked ?? 0}/{progress?.total ?? 0} ({progress?.pct ?? 0}%)</span>
        </div>
        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#f97316] to-[#ffd700] transition-all" style={{ width: `${progress?.pct ?? 0}%` }} />
        </div>
        {bonus && bonus.completed > 0 && (
          <div className="text-[11px] text-gray-400 mt-2">
            {t("collection.bonus", locale)}: ✨ +{bonus.xpPct}% XP · 🪙 +{bonus.goldPct}% {t("currency.gold", locale)}
          </div>
        )}
      </div>

      {/* Categorias */}
      <div className="grid md:grid-cols-2 gap-3">
        {!progress || progress.categories.length === 0 ? (
          <div className="game-card p-8 text-center text-sm text-gray-500 md:col-span-2">{t("collection.empty", locale)}</div>
        ) : (
          progress.categories.map((cat) => (
            <div key={cat.category} className="game-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span> {t(cat.nameKey, locale)}
                </div>
                <span className="text-[11px] text-gray-400">{cat.unlocked}/{cat.total}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${cat.complete ? "bg-[#22c55e]" : "bg-[#ffd700]"}`}
                  style={{ width: `${cat.total > 0 ? Math.round((cat.unlocked / cat.total) * 100) : 0}%` }}
                />
              </div>
              {cat.complete && !cat.claimed && (
                <button
                  onClick={() => claim(cat.category)}
                  disabled={busy === cat.category}
                  className="text-[10px] px-3 py-1.5 rounded-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black font-black disabled:opacity-40"
                >
                  {busy === cat.category ? "…" : `🎁 ${t("collection.claim", locale)}`}
                </button>
              )}
              {cat.claimed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">✓ {t("ach.claimed", locale)}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
