"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

export default function AscensionPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ascension?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const ascend = async () => {
    if (!characterId) return;
    const cost = (data?.nextCost as Record<string, number>) || null;
    if (!cost) return;
    if (!window.confirm(t("ascension.confirm", locale))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ascension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await res.json();
      if (!d.success) { notify(d.error, "error"); return; }
      notify(`🌌 ${t("ascension.done", locale)} ${d.ascension}!`, "success");
      await load();
      const res2 = await fetch(`/api/character/${characterId}`);
      const d2 = await res2.json();
      if (d2.character) setCharacter(d2.character);
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusy(false);
    }
  };

  const asc = Number(data?.ascension || 0);
  const max = Number(data?.max || 5);
  const nextLevel = Number(data?.nextLevel || 0);
  const level = Number(data?.level || 1);
  const canAscend = !!data?.canAscend;
  const maxed = !!data?.maxed;
  const cost = (data?.nextCost as Record<string, number>) || null;
  const gold = Number(data?.gold || 0);
  const crystals = Number(data?.crystals || 0);
  const buffs = (data?.buffs as Record<string, number>) || {};

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl">🌌</span>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t("ascension.title", locale)}</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">{t("general.loading", locale)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Patamar atual */}
          <div className="game-card game-card-glow p-6 text-center">
            <div className="text-6xl mb-2 animate-float">
              {asc >= 5 ? "🌟" : asc >= 3 ? "🌠" : asc >= 1 ? "✨" : "🌑"}
            </div>
            <div className={`text-2xl font-black ${asc > 0 ? "text-[#c084fc]" : "text-gray-500"}`}>
              {t(String(data?.nameKey || "ascension.none"), locale)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {t("ascension.patamar", locale)}: {asc}/{max}
            </div>
            {/* Barras de patamares */}
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: max }, (_, i) => (
                <div key={i} className={`w-10 h-2 rounded-full ${i < asc ? "bg-[#c084fc]" : "bg-white/10"}`} />
              ))}
            </div>

            {/* Buffs atuais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-gray-500">⚔️ {t("stat.attack", locale)}</div>
                <div className="text-lg font-black text-red-400">+{buffs.damagePct || 0}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-gray-500">❤️ {t("stat.hp", locale)}</div>
                <div className="text-lg font-black text-rose-400">+{buffs.maxHpPct || 0}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-gray-500">💨 {t("stat.speed", locale)}</div>
                <div className="text-lg font-black text-sky-400">+{buffs.speed || 0}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-gray-500">📈 XP</div>
                <div className="text-lg font-black text-emerald-400">+{buffs.xpPct || 0}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-gray-500">💰 {t("currency.gold", locale)}</div>
                <div className="text-lg font-black text-[#ffd700]">+{buffs.goldPct || 0}%</div>
              </div>
            </div>
          </div>

          {/* Ação */}
          {maxed ? (
            <div className="game-card p-6 text-center">
              <div className="text-3xl mb-2">🌟</div>
              <div className="text-lg font-black text-[#ffd700]">{t("ascension.maxed", locale)}</div>
            </div>
          ) : (
            <div className="game-card p-6">
              <h3 className="font-bold text-lg mb-3">
                🌠 {t("ascension.next", locale)} {asc + 1}
              </h3>
              <div className="text-sm text-gray-400 mb-4">
                {t("ascension.needLevel", locale)} <b className="text-white">{nextLevel}</b>{" "}
                <span className="text-gray-600">({t("ascension.atual", locale)}: {level})</span>
              </div>
              {cost && (
                <div className="flex flex-wrap gap-3 items-center">
                  <div className={`text-sm ${gold >= cost.gold ? "text-[#00ff88]" : "text-red-400"}`}>
                    {gold >= cost.gold ? "✅" : "❌"} 🪙 {cost.gold.toLocaleString()}
                  </div>
                  <div className={`text-sm ${crystals >= cost.crystals ? "text-[#00ff88]" : "text-red-400"}`}>
                    {crystals >= cost.crystals ? "✅" : "❌"} 🔷 {cost.crystals} {t("currency.crystals", locale)}
                  </div>
                  <button onClick={ascend} disabled={busy || !canAscend}
                    className="game-btn ml-auto disabled:opacity-40">
                    {busy ? "..." : `🌌 ${t("ascension.btn", locale)}`}
                  </button>
                </div>
              )}
              {!canAscend && nextLevel > 0 && (
                <div className="text-xs text-gray-500 mt-3">
                  🔒 {t("ascension.levelReq", locale)} {nextLevel}
                </div>
              )}
            </div>
          )}

          {/* Como funciona */}
          <div className="game-card p-5">
            <h3 className="font-bold text-sm text-gray-300 mb-2">❓ {t("ascension.how", locale)}</h3>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• {t("ascension.how1", locale)}</li>
              <li>• {t("ascension.how2", locale)}</li>
              <li>• {t("ascension.how3", locale)}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
