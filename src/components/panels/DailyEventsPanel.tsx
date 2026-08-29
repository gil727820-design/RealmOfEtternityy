"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_ICONS = ["☀️", "🐉", "🏰", "⚔️", "🎪", "🗺️", "👹"];
const TYPE_LABELS: Record<string, { icon: string; color: string; label: string }> = {
  active: { icon: "⚔️", color: "#e94560", label: "Ativo" },
  passive: { icon: "🎁", color: "#22c55e", label: "Passivo" },
  boss: { icon: "👹", color: "#ef4444", label: "Boss" },
  shop: { icon: "🎪", color: "#f59e0b", label: "Loja" },
  pvp: { icon: "⚔️", color: "#a855f7", label: "PvP" },
};

export default function DailyEventsPanel() {
  const { locale, characterId } = useGameStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [rewards, setRewards] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-events?characterId=${characterId}`);
      const json = await res.json();
      setData(json);
      // Check if already claimed
      if (json.todayEvent && json.playerLevel) {
        const today = new Date().toDateString();
        const lastClaim = json.lastClaimDate;
        setClaimed(lastClaim === today);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claimRewards = async () => {
    if (claiming || !characterId) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/daily-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "claim_rewards" }),
      });
      const json = await res.json();
      if (json.success) {
        setRewards(json.rewards);
        setClaimed(true);
      }
    } catch { /* ignore */ }
    setClaiming(false);
  };

  const now = new Date();
  const today = now.getDay();
  const timeUntil = data?.timeUntil || { hours: 0, minutes: 0 };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#22c55e]/20 via-[#0f3460]/30 to-[#16213e]/40 border border-[#22c55e]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">📅</span>
            <span className="bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] bg-clip-text text-transparent">
              Eventos Diários
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Eventos especiais que mudam todo dia!</p>
        </div>
      </div>

      {/* Today's Event - Featured */}
      {data?.todayEvent && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#e94560]/20 to-[#a855f7]/20 border border-[#e94560]/40 p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-[#e94560]/20 border border-[#e94560]/40 rounded-full text-[#e94560] font-bold">
                  HOJE
                </span>
                <span className="text-xs text-gray-400">{DAY_NAMES[today]}</span>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full font-bold`}
                style={{ backgroundColor: TYPE_LABELS[data.todayEvent.type]?.color + "20", color: TYPE_LABELS[data.todayEvent.type]?.color, border: `1px solid ${TYPE_LABELS[data.todayEvent.type]?.color}40` }}>
                {TYPE_LABELS[data.todayEvent.type]?.icon} {TYPE_LABELS[data.todayEvent.type]?.label}
              </div>
            </div>

            <div className="text-4xl mb-2">{data.todayEvent.icon}</div>
            <h3 className="text-xl font-black text-white mb-1">{data.todayEvent.name}</h3>
            <p className="text-sm text-gray-300 mb-4">{data.todayEvent.description}</p>

            {/* Rewards */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(data.todayEvent.rewards || {}).map(([key, value]) => (
                <span key={key} className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white font-medium">
                  {key === "gold" ? "💰" : key === "crystals" ? "🔮" : key === "diamonds" ? "💎" : key === "towerCoins" ? "🗼" : key === "pvpCoins" ? "⚔️" : "🎁"} {Number(value).toLocaleString()}
                </span>
              ))}
            </div>

            {/* Claim Button */}
            {!claimed ? (
              <button
                onClick={claimRewards}
                disabled={claiming}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#e94560] to-[#fbbf24] text-white font-black text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
              >
                {claiming ? "⏳ Processando..." : "🎁 Reivindicar Recompensas"}
              </button>
            ) : rewards ? (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                <div className="text-green-400 font-bold text-sm">✅ Recompensas coletadas!</div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {Object.entries(rewards).map(([key, value]) => (
                    <span key={key} className="text-xs px-2 py-1 bg-green-500/20 rounded-full text-green-300 font-medium">
                      {key === "gold" ? "💰" : key === "crystals" ? "🔮" : key === "diamonds" ? "💎" : "🎁"} +{Number(value).toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center text-gray-400 text-sm">
                ✅ Já reivindicou hoje
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown to next event */}
      {data?.nextEvent && (
        <div className="game-card p-4 text-center">
          <div className="text-xs text-gray-500 mb-2">PRÓXIMO EVENTO</div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">{data.nextEvent.icon}</span>
            <div>
              <div className="font-bold text-white">{data.nextEvent.name}</div>
              <div className="text-sm text-gray-400">
                Em {timeUntil.hours}h {timeUntil.minutes}min ({DAY_NAMES[(today + 1) % 7]})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Week Calendar */}
      <div className="game-card p-4">
        <h3 className="text-sm font-bold text-gray-400 mb-3">📅 Calendário da Semana</h3>
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((day, i) => {
            const event = DAILY_EVENTS_MAP[i];
            const isToday = i === today;
            return (
              <div key={i} className={`text-center p-2 rounded-xl transition-all ${
                isToday
                  ? "bg-[#e94560]/20 border border-[#e94560]/40 shadow-lg"
                  : "bg-white/5 border border-white/5"
              }`}>
                <div className={`text-[10px] font-bold mb-1 ${isToday ? "text-[#e94560]" : "text-gray-500"}`}>
                  {day.slice(0, 3)}
                </div>
                <div className="text-xl">{event?.icon || "📅"}</div>
                {isToday && <div className="text-[8px] text-[#e94560] font-bold mt-1">HOJE</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* All Events List */}
      {data?.allEvents && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-400">📋 Todos os Eventos</h3>
          {data.allEvents.map((event: any, i: number) => {
            const isToday = event.dayOfWeek === today;
            const typeInfo = TYPE_LABELS[event.type] || TYPE_LABELS.active;
            return (
              <div key={event.id} className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                isToday
                  ? "bg-gradient-to-r from-[#e94560]/10 to-[#a855f7]/10 border border-[#e94560]/30"
                  : "game-card hover:border-white/20"
              }`}>
                <div className="text-2xl">{event.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${isToday ? "text-white" : "text-gray-300"}`}>
                      {event.name}
                    </span>
                    {isToday && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#e94560]/20 border border-[#e94560]/40 rounded-full text-[#e94560] font-bold">
                        HOJE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{DAY_NAMES[event.dayOfWeek]}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: typeInfo.color + "20", color: typeInfo.color }}>
                    {typeInfo.icon} {typeInfo.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="game-card p-4 text-center">
        <div className="text-xs text-gray-500">
          📅 Eventos mudam todo dia à meia-noite • Recompensas escalam com seu nível
        </div>
      </div>
    </div>
  );
}

// Helper map
const DAILY_EVENTS_MAP: Record<number, { icon: string; name: string }> = {
  0: { icon: "🎁", name: "Dia de Descanso" },
  1: { icon: "🐉", name: "Invasão de Monstros" },
  2: { icon: "🏰", name: "Masmorra Especial" },
  3: { icon: "⚔️", name: "Torneio PvP" },
  4: { icon: "🎪", name: "Mercador Viajante" },
  5: { icon: "🗺️", name: "Caça ao Tesouro" },
  6: { icon: "👹", name: "Boss Mundial" },
};
