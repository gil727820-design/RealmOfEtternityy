"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";
import { BATTLE_PASS_TIERS, battlePassTier } from "@/game/season";

type RankEntry = {
  id: string;
  name: string;
  classType: string;
  sex: string;
  level: number;
  power: number;
  seasonPoints: number;
};

export default function SeasonPanel() {
  const { characterId, locale } = useGameStore();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/season?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const ranking = (Array.isArray(data?.ranking) ? data.ranking : []) as RankEntry[];
  const me = (data?.me as (RankEntry & { position: number | null }) | null) || null;
  const milestones = (Array.isArray(data?.milestones) ? data.milestones : []) as Array<{ points: number; gold: number; crystals: number }>;
  const nextMilestone = (data?.nextMilestone as { points: number; gold: number; crystals: number } | null) || null;
  const daysLeft = Number(data?.daysLeft || 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl">🏆</span>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("season.title", locale)} {String(data?.label || "?")}
          </span>
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">{t("general.loading", locale)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cabeçalho da temporada */}
          <div className="game-card game-card-glow p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-bold text-white">
                  🗓️ {t("season.ends", locale)}: <span className="text-[#ffd700]">{daysLeft} {t("season.days", locale)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {t("season.how", locale)}
                </div>
              </div>
              {me && (
                <div className="text-right">
                  <div className="text-2xl font-black text-[#ffd700] tabular-nums">{me.seasonPoints.toLocaleString()}</div>
                  <div className="text-[11px] text-gray-400">{t("season.points", locale)}</div>
                  {me.position != null && (
                    <div className="text-xs font-bold text-sky-400 mt-1">
                      #{me.position} {t("season.pos", locale)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Battle Pass */}
          <div className="game-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[#ffd700]">🎯 Battle Pass</h3>
              <span className="text-[10px] text-gray-500">Tier {battlePassTier(me?.seasonPoints || 0)}/30</span>
            </div>
            <div className="h-3 bg-black/40 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] rounded-full transition-all" style={{ width: `${Math.min(100, ((me?.seasonPoints || 0) / 5560) * 100)}%` }} />
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {BATTLE_PASS_TIERS.map((tier) => {
                const pts = me?.seasonPoints || 0;
                const unlocked = pts >= tier.pointsNeeded;
                const isCurrent = unlocked && (tier.tier === 30 || pts < BATTLE_PASS_TIERS[tier.tier]?.pointsNeeded);
                return (
                  <div key={tier.tier} className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all ${
                    unlocked ? "bg-[#ffd700]/10 border-[#ffd700]/40" : "bg-black/30 border-white/5 opacity-50"
                  } ${isCurrent ? "ring-2 ring-[#ffd700]/60" : ""}`}>
                    <span className={`text-[9px] font-black ${unlocked ? "text-[#ffd700]" : "text-gray-600"}`}>{tier.tier}</span>
                    <span className="text-sm">{tier.reward.icon}</span>
                    <span className="text-[8px] text-gray-500 truncate w-full">{tier.reward.amount.toLocaleString()}</span>
                    {tier.premium && (
                      <span className="absolute -top-1 -right-1 text-[8px] bg-purple-500/30 border border-purple-500/50 rounded px-0.5 text-purple-300">👑</span>
                    )}
                    {unlocked && <span className="absolute -bottom-0.5 text-[8px]">✅</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 text-center">Complete atividades para ganhar pontos e subir de tier!</p>
          </div>

          {/* Marcos de recompensa (milestones) */}
          <div className="game-card p-5">
            <h3 className="font-bold text-sm text-gray-300 mb-3">🎁 {t("season.milestones", locale)}</h3>
            <div className="space-y-2">
              {milestones.map((m, i) => {
                const pts = me?.seasonPoints || 0;
                const done = pts >= m.points;
                const isNext = nextMilestone && m.points === nextMilestone.points;
                return (
                  <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${
                    done ? "bg-[#00ff88]/5 border-[#00ff88]/30" : isNext ? "bg-[#ffd700]/10 border-[#ffd700]/40" : "bg-white/5 border-white/5"
                  }`}>
                    <div className="text-sm">
                      <span className={done ? "text-[#00ff88]" : "text-gray-300"}>{done ? "✅" : isNext ? "⭐" : "🔒"} {m.points.toLocaleString()} {t("season.points", locale)}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      🪙 {m.gold.toLocaleString()} • 🔷 {m.crystals}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranking da temporada */}
          <div className="game-card p-5">
            <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 {t("season.ranking", locale)}</h3>
            {ranking.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-10">{t("season.empty", locale)}</div>
            ) : (
              <div className="space-y-1">
                {ranking.slice(0, 15).map((r, i) => (
                  <div key={r.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${String(r.id) === characterId ? "bg-[#ffd700]/10 border border-[#ffd700]/40" : "bg-[#0a0a12]"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 text-center font-black ${i === 0 ? "text-[#ffd700]" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>
                        {i + 1}º
                      </span>
                      <img src={classImage((r.classType as ClassName) || "warrior", r.sex || "male")} alt="" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{r.name}</div>
                        <div className="text-[10px] text-gray-500">Lv.{r.level}</div>
                      </div>
                    </div>
                    <span className="text-sm font-black text-[#ffd700] tabular-nums">{r.seasonPoints.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recompensas de fim de temporada */}
          <div className="game-card p-5">
            <h3 className="font-bold text-sm text-gray-300 mb-2">👑 {t("season.endRewards", locale)}</h3>
            <div className="text-xs text-gray-400 space-y-1">
              <div>🥇 1º: 500.000 🪙 + 1.000 🔷 + {t("season.title1", locale)}</div>
              <div>🥈 2º: 300.000 🪙 + 600 🔷 + {t("season.title2", locale)}</div>
              <div>🥉 3º: 200.000 🪙 + 400 🔷 + {t("season.title3", locale)}</div>
              <div>📊 4º-10º: 100.000 🪙 + 250 🔷</div>
              <div>📊 11º-50º: 40.000 🪙 + 100 🔷</div>
              <div>🎖️ Todos: 10.000 🪙 + 30 🔷</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
