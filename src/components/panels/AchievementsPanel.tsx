"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import { ACHIEVEMENT_CATEGORIES } from "@/game/achievements";

type AchItem = {
  category: string;
  id: string; nameKey: string; descKey: string; icon: string; rarity: string;
  reward: { gold?: number; crystals?: number; xp?: number; diamonds?: number };
  unlocked: boolean; claimed: boolean;
};
type TitleItem = {
  id: string; nameKey: string; icon: string; rarity: string;
  unlocked: boolean; owned: boolean; active: boolean;
};

export default function AchievementsPanel() {
  const { characterId, locale, notify, setCharacter, character } = useGameStore();
  const [achievements, setAchievements] = useState<AchItem[]>([]);
  const [titles, setTitles] = useState<TitleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/achievements?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setAchievements(d.achievements ?? []);
      setTitles(d.titles ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claim = async (id: string) => {
    if (!characterId) return;
    setBusy(`claim_${id}`);
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", characterId, achievementId: id }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error, "error"); setBusy(null); return; }
      const parts = [];
      if (d.reward?.gold) parts.push(`💰 +${d.reward.gold}`);
      if (d.reward?.crystals) parts.push(`🔮 +${d.reward.crystals}`);
      if (d.reward?.xp) parts.push(`✨ +${d.reward.xp} XP`);
      notify(`🎉 ${t("ach.claimSuccess", locale)} ${parts.join(" ")}`, "success");
      if (d.character) setCharacter(d.character);
      await load();
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(null);
  };

  const equipTitle = async (id: string) => {
    if (!characterId) return;
    setBusy(`title_${id}`);
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip_title", characterId, titleId: id }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error, "error"); setBusy(null); return; }
      notify(t("ach.equipSuccess", locale), "success");
      if (d.character) setCharacter(d.character);
      await load();
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(null);
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const claimedCount = achievements.filter((a) => a.claimed).length;
  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <img src="/images/sidebar/menu_conquistas.png" alt={t("ach.title", locale)} className="w-10 h-10 object-contain" />
        <span className="bg-gradient-to-r from-[#8b5cf6] to-[#facc15] bg-clip-text text-transparent">{t("ach.title", locale)}</span>
      </h2>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">{t("general.loading", locale)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progresso */}
          <div className="game-card p-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-300">🏅 {unlockedCount} / {achievements.length} {t("ach.unlocked", locale)}</span>
              <span className="text-[#8b5cf6] font-bold">{Math.round((unlockedCount / Math.max(1, achievements.length)) * 100)}%</span>
            </div>
            <div className="bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-[#8b5cf6] to-[#facc15] h-2.5 rounded-full transition-all"
                style={{ width: `${(unlockedCount / Math.max(1, achievements.length)) * 100}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">{t("ach.reward", locale)} 💰 / 🔮 ao coletar cada conquista desbloqueada.</p>
          </div>

          {/* Grade de conquistas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map((a) => {
              const color = RARITY_COLORS[a.rarity] || "#9ca3af";
              return (
                <div key={a.id}
                  className={`game-card p-4 relative flex flex-col gap-2 ${a.unlocked ? "" : "opacity-70"}`}
                  style={{ borderColor: a.unlocked ? color + "66" : "rgba(255,255,255,0.08)" }}>
                  <div className="flex items-start gap-3">
                    <span className="text-4xl shrink-0">{a.unlocked ? a.icon : "🔒"}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white leading-tight">{t(a.nameKey, locale)}</div>
                      <span className="text-[10px] font-black uppercase tracking-wide" style={{ color }}>
                        {t(`rarity.${a.rarity}`, locale)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{t(a.descKey, locale)}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#ffd700]">
                      {a.reward.gold ? `💰 ${a.reward.gold.toLocaleString()}` : ""}
                      {a.reward.crystals ? ` 🔮 ${a.reward.crystals}` : ""}
                      {a.reward.xp ? ` ✨ ${a.reward.xp} XP` : ""}
                    </span>
                    {a.unlocked ? (
                      a.claimed ? (
                        <span className="bg-green-500/20 border border-green-500/40 text-green-300 rounded-lg px-2 py-1 font-bold">✓ {t("ach.claimed", locale)}</span>
                      ) : (
                        <button onClick={() => claim(a.id)} disabled={busy === `claim_${a.id}`}
                          className="bg-gradient-to-r from-[#8b5cf6] to-[#facc15] text-black rounded-lg px-3 py-1.5 font-black disabled:opacity-40">
                          {busy === `claim_${a.id}` ? "..." : t("ach.claim", locale)}
                        </button>
                      )
                    ) : (
                      <span className="text-gray-600">{t("ach.locked", locale)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Títulos */}
          <div>
            <h3 className="text-xl font-black mb-3 flex items-center gap-2">
              👑 {t("ach.titles", locale)}
              {character?.activeTitle
                ? (() => {
                    const at = titles.find((x) => x.id === character.activeTitle);
                    return at ? <span className="text-xs text-[#facc15]">• {at.icon} {t(at.nameKey, locale)}</span> : null;
                  })()
                : null}
            </h3>
            {titles.length === 0 ? (
              <div className="game-card p-8 text-center text-gray-500 text-sm">{t("ach.noTitles", locale)}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {titles.map((tt) => (
                  <div key={tt.id}
                    className={`game-card p-3 text-center flex flex-col items-center gap-1 ${tt.unlocked ? "" : "opacity-60"}`}>
                    <span className="text-3xl">{tt.unlocked ? tt.icon : "🔒"}</span>
                    <div className="text-sm font-bold text-white">{t(tt.nameKey, locale)}</div>
                    <span className="text-[9px] uppercase tracking-wide" style={{ color: RARITY_COLORS[tt.rarity] || "#9ca3af" }}>
                      {t(`rarity.${tt.rarity}`, locale)}
                    </span>
                    {tt.active ? (
                      <span className="mt-1 text-xs bg-green-500/20 border border-green-500/40 text-green-300 rounded-full px-3 py-1 font-bold">
                        ✓ {t("ach.equipped", locale)}
                      </span>
                    ) : tt.unlocked ? (
                      <button onClick={() => equipTitle(tt.id)} disabled={busy === `title_${tt.id}`}
                        className="mt-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-1 font-bold disabled:opacity-40">
                        {busy === `title_${tt.id}` ? "..." : t("ach.equip", locale)}
                      </button>
                    ) : (
                      <span className="mt-1 text-[10px] text-gray-600">{t("ach.locked", locale)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}