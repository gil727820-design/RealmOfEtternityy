"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

interface EventDef {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
  goldCost: number;
  crystalCost: number;
  goldReward?: number;
  diamondReward?: number;
  crystalReward?: number;
  energyReward?: number;
  towerCoinReward?: number;
  xpRewardBase?: number;
  gamble?: boolean;
}

/** Modal de evento aleatório: aparece quando há um evento pendente no servidor. */
export default function RandomEventModal() {
  const { characterId, locale, notify, setCharacter } = useGameStore();
  const [event, setEvent] = useState<EventDef | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/game?action=random-event&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setEvent(d.event ?? null);
    } catch { /* ignore */ }
  }, [characterId]);

  // Checa ao montar e a cada 60s (o evento expira em 5 min no servidor).
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const resolve = async (action: "accept" | "ignore") => {
    if (!characterId || !event || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/game?action=random-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else if (action === "ignore") {
        notify("🚶 Você ignorou o evento.", "info");
      } else if (d.failed) {
        notify(`😅 ${t("event.fail", locale)}`, "error");
      } else {
        const r = d.reward || {};
        const parts: string[] = [];
        if (r.gold) parts.push(`🪙 ${r.gold}`);
        if (r.diamonds) parts.push(`💎 ${r.diamonds}`);
        if (r.crystals) parts.push(`🔮 ${r.crystals}`);
        if (r.energy) parts.push(`⚡ ${r.energy}`);
        if (r.towerCoins) parts.push(`🗼 ${r.towerCoins}`);
        if (r.xp) parts.push(`✨ ${r.xp} XP`);
        notify(`🎉 ${t("event.accepted", locale)}: ${parts.join(" · ")}`, "success");
        if (d.character) setCharacter(d.character);
      }
      setEvent(null);
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(false);
  };

  if (!event) return null;

  const canAfford =
    (!event.goldCost || true) &&
    (!event.crystalCost || true);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="game-card p-6 max-w-sm w-full text-center animate-pop">
        <div className="text-6xl mb-3 animate-float">{event.icon}</div>
        <h3 className="text-xl font-black text-white mb-1">{t(event.nameKey, locale)}</h3>
        <p className="text-sm text-gray-400 mb-4">{t(event.descKey, locale)}</p>

        {/* Custo */}
        <div className="flex justify-center gap-2 mb-2 text-xs font-bold flex-wrap">
          {event.goldCost > 0 && (
            <span className="bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700] rounded-full px-3 py-1">🪙 {event.goldCost.toLocaleString()}</span>
          )}
          {event.crystalCost > 0 && (
            <span className="bg-[#c084fc]/15 border border-[#c084fc]/40 text-[#c084fc] rounded-full px-3 py-1">🔮 {event.crystalCost}</span>
          )}
        </div>

        {/* Recompensa */}
        <div className="flex justify-center gap-2 mb-4 text-xs font-bold flex-wrap">
          {event.goldReward ? <span className="bg-white/10 rounded-full px-3 py-1">🪙 +{event.goldReward.toLocaleString()}</span> : null}
          {event.diamondReward ? <span className="bg-white/10 rounded-full px-3 py-1">💎 +{event.diamondReward}</span> : null}
          {event.crystalReward ? <span className="bg-white/10 rounded-full px-3 py-1">🔮 +{event.crystalReward}</span> : null}
          {event.energyReward ? <span className="bg-white/10 rounded-full px-3 py-1">⚡ +{event.energyReward}</span> : null}
          {event.towerCoinReward ? <span className="bg-white/10 rounded-full px-3 py-1">🗼 +{event.towerCoinReward}</span> : null}
          {event.xpRewardBase ? <span className="bg-white/10 rounded-full px-3 py-1">✨ +{event.xpRewardBase}% XP</span> : null}
          {event.gamble ? <span className="bg-white/10 rounded-full px-3 py-1 text-[#ff6b35]">🎲 50/50</span> : null}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => resolve("accept")}
            disabled={busy || !canAfford}
            className="flex-1 py-3 text-sm font-black rounded-xl bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] text-black disabled:opacity-40"
          >
            {busy ? t("forge.busy", locale) : `✅ ${t("event.accept", locale)}`}
          </button>
          <button
            onClick={() => resolve("ignore")}
            disabled={busy}
            className="flex-1 py-3 text-sm font-black rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-40"
          >
            🚶 {t("event.ignore", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
