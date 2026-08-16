"use client";
import { useState, useCallback, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { DAILY_REWARDS } from "@/game/dailyLogin";

interface DailyStatus {
  canClaim: boolean;
  streak: number;
  nextDay: number;
  todayKey: string;
}

export default function DailyLoginPanel() {
  const { characterId, locale, notify, setCharacter } = useGameStore();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/daily-login?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (d.status) setStatus(d.status);
    } catch { /* ignore */ }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    if (!characterId || !status?.canClaim) return;
    setBusy(true);
    try {
      const res = await fetch("/api/daily-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else {
        const r = d.reward;
        const parts: string[] = [];
        if (r.gold) parts.push(`🪙 ${r.gold}`);
        if (r.diamonds) parts.push(`💎 ${r.diamonds}`);
        if (r.crystals) parts.push(`🔮 ${r.crystals}`);
        if (r.energy) parts.push(`⚡ ${r.energy}`);
        notify(`🎁 ${t("dailyLogin.claimed", locale)}: ${parts.join(" · ")}`, "success");
        if (d.character) setCharacter(d.character);
        setStatus(d.status ?? null);
      }
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(false);
  };

  const streak = status?.streak || 0;
  const nextDay = status?.nextDay || 1;

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">📅</span>
        <span className="bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] bg-clip-text text-transparent">
          {t("dailyLogin.title", locale)}
        </span>
      </h2>

      {/* Cabeçalho: streak */}
      <div className="game-card p-5 text-center">
        <div className="text-5xl mb-2 animate-float">🔥</div>
        <div className="text-2xl font-black text-white">
          {t("dailyLogin.streak", locale)}: <span className="text-[#ff6b35]">{streak}</span> {t("dailyLogin.days", locale)}
        </div>
        <div className="text-xs text-gray-500 mt-1">{t("dailyLogin.hint", locale)}</div>
      </div>

      {/* Ciclo de 7 dias */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-gray-300 mb-3">📆 {t("dailyLogin.cycle", locale)}</h3>
        <div className="grid grid-cols-7 gap-2">
          {DAILY_REWARDS.map((r) => {
            const isNext = r.day === nextDay && status?.canClaim;
            const isDone = r.day < nextDay || (status?.canClaim === false && r.day <= nextDay);
            return (
              <div
                key={r.day}
                className={`rounded-xl border p-2 text-center ${isNext
                  ? "border-[#22c55e] bg-[#22c55e]/15 shadow-[0_0_12px_rgba(34,197,94,0.4)] animate-pulse-soft"
                  : isDone
                    ? "border-white/10 bg-[#0a0a12] opacity-60"
                    : "border-white/10 bg-[#0a0a12]"}`}
              >
                <div className="text-[9px] text-gray-500 font-bold mb-1">{t("dailyLogin.day", locale)} {r.day}</div>
                <div className="text-2xl">{r.icon}</div>
                {r.gold ? <div className="text-[9px] text-[#ffd700] font-bold">{r.gold.toLocaleString()}</div> : null}
                {r.diamonds ? <div className="text-[9px] text-[#38bdf8] font-bold">{r.diamonds}💎</div> : null}
                {r.crystals ? <div className="text-[9px] text-[#c084fc] font-bold">{r.crystals}🔮</div> : null}
                {r.energy ? <div className="text-[9px] text-[#4ecdc4] font-bold">{r.energy}⚡</div> : null}
                {isNext && <div className="text-[8px] text-[#22c55e] font-black mt-1">◀ {t("dailyLogin.now", locale)}</div>}
                {isDone && !isNext && <div className="text-[8px] text-gray-600 mt-1">✅</div>}
              </div>
            );
          })}
        </div>
        <button
          onClick={claim}
          disabled={busy || !status?.canClaim}
          className={`mt-4 w-full py-3 text-sm font-black rounded-xl transition ${
            status?.canClaim
              ? "bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] text-black hover:opacity-90"
              : "bg-white/10 text-gray-500 cursor-not-allowed"
          }`}
        >
          {busy
            ? t("forge.busy", locale)
            : status?.canClaim
              ? `🎁 ${t("dailyLogin.claimBtn", locale)} (${t("dailyLogin.day", locale)} ${nextDay})`
              : `✅ ${t("dailyLogin.done", locale)}`}
        </button>
      </div>
    </div>
  );
}
