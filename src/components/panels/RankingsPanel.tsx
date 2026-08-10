"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";

const RANK_TYPES = [
  { id: "power", icon: "⭐" },
  { id: "level", icon: "📊" },
  { id: "pvp", icon: "⚔️" },
  { id: "tower", icon: "🗼" },
  { id: "wealth", icon: "💰" },
  { id: "prestige", icon: "👑" },
] as const;

export default function RankingsPanel() {
  const { locale, characterId } = useGameStore();
  const [type, setType] = useState<string>("power");
  const [rankings, setRankings] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rankings?type=${type}`);
      const data = await res.json();
      setRankings(data.rankings ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const getScore = (r: Record<string, unknown>) => {
    switch (type) {
      case "level": return `Lv.${String(r.level)}`;
      case "pvp": return `⚔️ ${String(r.pvpWins ?? 0)}`;
      case "tower": return `🗼 ${String(r.towerFloor ?? 0)}`;
      case "wealth": return `💰 ${String(r.gold ?? 0)}`;
      case "prestige": return `👑 ${String(r.prestige ?? 0)}`;
      default: return `⭐ ${String(r.power ?? 0)}`;
    }
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4 animate-fadeIn">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <img src="/images/sidebar/menu_rankings.png" alt={t("rank.title", locale)} className="w-8 h-8 object-contain" />
        {t("rank.title", locale)}
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {RANK_TYPES.map(rt => (
          <button key={rt.id} onClick={() => setType(rt.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border transition ${type === rt.id ? "border-[#e94560] text-[#e94560] bg-[#e94560]/10" : "border-white/10 text-gray-400 hover:text-white"}`}>
            {rt.icon} {t(`rank.${rt.id}`, locale)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 game-card skeleton" />)}
        </div>
      ) : rankings.length === 0 ? (
        <div className="game-card p-8 text-center text-gray-400">{t("rank.noPlayers", locale)}</div>
      ) : (
        <div className="space-y-2">
          {rankings.map((r, i) => {
            const isMe = r.id === characterId;
            return (
              <div key={String(r.id)} className={`game-card p-3 flex items-center gap-3 animate-stagger-${Math.min(i + 1, 6)} ${isMe ? "border-[#e94560]/50" : ""}`}>
                <div className="w-8 text-center font-bold text-lg">
                  {i < 3 ? <span className="text-2xl">{medals[i]}</span> : <span className="text-gray-500">{i + 1}</span>}
                </div>
                <img
                  src={classImage((r.classType as ClassName) ?? "warrior", (r.sex as string) ?? "male")}
                  alt={String(r.name)}
                  className="w-10 h-10 rounded-lg border border-white/10 object-cover"
                />
                <div className="flex-1">
                  <div className="font-semibold">{String(r.name)}</div>
                  <div className="text-xs text-gray-400">Lv.{String(r.level)} {t(`class.${String(r.classType)}`, locale)}</div>
                </div>
                <div className="text-sm font-bold text-[#fbbf24]">{getScore(r)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}