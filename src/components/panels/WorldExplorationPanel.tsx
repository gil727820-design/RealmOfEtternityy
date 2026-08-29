"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { REGIONS } from "@/game/constants";

type ExploreEvent = {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  reward: { gold?: number; crystals?: number; xp?: number; diamonds?: number };
  energyCost: number;
};

export default function WorldExplorationPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exploring, setExploring] = useState(false);
  const [lastEvent, setLastEvent] = useState<ExploreEvent | null>(null);
  const [eventLog, setEventLog] = useState<ExploreEvent[]>([]);

  const currentRegion = REGIONS.find((r) => r.id === (character as any)?.currentRegion);
  const energy = Number((character as any)?.energy) || 0;
  const level = Number((character as any)?.level) || 1;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/world-exploration?characterId=${characterId}`);
      const data = await res.json();
      setStats(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const explore = async () => {
    if (!characterId || exploring) return;
    setExploring(true);
    setLastEvent(null);
    try {
      const res = await fetch("/api/world-exploration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "explore" }),
      });
      const data = await res.json();
      if (data.success) {
        setLastEvent(data.event);
        setEventLog((prev) => [data.event, ...prev].slice(0, 20));

        // Notification based on event type
        if (data.event.type === "treasure") {
          notify(`📦 ${data.event.name}! Ganhou ${data.event.reward.gold || 0} ouro e ${data.event.reward.crystals || 0} cristais!`, "success");
        } else if (data.event.type === "combat") {
          notify(`⚔️ ${data.event.name}! Recompensas coletadas!`, "success");
        } else if (data.event.type === "blessing") {
          notify(`🌟 ${data.event.name}! XP e cristais ganhos!`, "success");
        } else if (data.event.type === "trap") {
          notify(`⚠️ ${data.event.name}! Perdeu um pouco de ouro.`, "error");
        } else {
          notify(`${data.event.icon} ${data.event.name}`, "info");
        }

        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao explorar", "error"); }
    setExploring(false);
  };

  const DAILY_LIMIT = 20;
  const exploredToday = stats?.exploredToday || 0;
  const dailyProgress = (exploredToday / DAILY_LIMIT) * 100;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#22c55e]/20 via-[#4ecdc4]/10 to-[#16213e]/40 border border-[#22c55e]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">🗺️</span>
            <span className="bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] bg-clip-text text-transparent">
              Exploracao do Mundo
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Explore a regiao {currentRegion?.icon} {currentRegion?.id?.replace(/_/g, " ")} e encontre eventos!
          </p>
        </div>
      </div>

      {/* Region Info + Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#22c55e]">{exploredToday}/{DAILY_LIMIT}</div>
          <div className="text-[10px] text-gray-400 uppercase">Hoje</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#4ecdc4]">{stats?.totalExplored || 0}</div>
          <div className="text-[10px] text-gray-400 uppercase">Total</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#ffd700]">{stats?.totalTreasures || 0}</div>
          <div className="text-[10px] text-gray-400 uppercase">Baus</div>
        </div>
      </div>

      {/* Daily Progress */}
      <div className="game-card p-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-gray-400">Progresso Diario</span>
          <span className="text-[#22c55e] font-bold">{exploredToday}/{DAILY_LIMIT}</span>
        </div>
        <div className="bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div className="bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${dailyProgress}%` }} />
        </div>
      </div>

      {/* Energy */}
      <div className="game-card p-4 text-center">
        <div className="text-sm text-gray-400 mb-2">Energia Disponivel</div>
        <div className="text-3xl font-black text-[#fbbf24]">⚡ {energy}</div>
        <div className="text-[10px] text-gray-500 mt-1">Custo por exploracao: 1-8 ⚡</div>
      </div>

      {/* Explore Button */}
      <button
        onClick={explore}
        disabled={exploring || energy < 2 || exploredToday >= DAILY_LIMIT}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
          energy >= 2 && exploredToday < DAILY_LIMIT
            ? "bg-gradient-to-r from-[#22c55e] to-[#4ecdc4] text-white hover:opacity-90 active:scale-95 shadow-lg shadow-[#22c55e]/20"
            : "bg-white/5 text-gray-600 cursor-not-allowed"
        }`}
      >
        {exploring ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Explorando...
          </span>
        ) : exploredToday >= DAILY_LIMIT ? (
          "🚫 Limite diario atingido"
        ) : energy < 2 ? (
          "⚡ Energia insuficiente"
        ) : (
          `🗺️ Explorar Regiao (−⚡${energy >= 5 ? 3 : 1})`
        )}
      </button>

      {/* Last Event */}
      {lastEvent && (
        <div className={`game-card p-5 text-center animate-fadeIn ${
          lastEvent.type === "treasure" ? "border-[#ffd700]/40 bg-[#ffd700]/5" :
          lastEvent.type === "combat" ? "border-[#e94560]/40 bg-[#e94560]/5" :
          lastEvent.type === "blessing" ? "border-[#a855f7]/40 bg-[#a855f7]/5" :
          lastEvent.type === "trap" ? "border-[#f59e0b]/40 bg-[#f59e0b]/5" :
          "border-white/10"
        }`}>
          <div className="text-5xl mb-3">{lastEvent.icon}</div>
          <h3 className="text-xl font-black text-white mb-1">{lastEvent.name}</h3>
          <p className="text-sm text-gray-400 mb-3">{lastEvent.description}</p>

          {/* Rewards */}
          {lastEvent.type !== "nothing" && lastEvent.type !== "trap" && (
            <div className="flex justify-center gap-3 flex-wrap">
              {lastEvent.reward.gold ? (
                <span className="text-sm px-3 py-1 rounded-full bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] font-bold">
                  💰 +{lastEvent.reward.gold.toLocaleString()}
                </span>
              ) : null}
              {lastEvent.reward.crystals ? (
                <span className="text-sm px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] font-bold">
                  🔮 +{lastEvent.reward.crystals}
                </span>
              ) : null}
              {lastEvent.reward.xp ? (
                <span className="text-sm px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] font-bold">
                  ✨ +{lastEvent.reward.xp.toLocaleString()} XP
                </span>
              ) : null}
              {lastEvent.reward.diamonds ? (
                <span className="text-sm px-3 py-1 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] font-bold">
                  💎 +{lastEvent.reward.diamonds}
                </span>
              ) : null}
            </div>
          )}

          {lastEvent.type === "trap" && (
            <span className="text-sm text-[#f59e0b] font-bold">⚠️ Perdeu 5% do seu ouro</span>
          )}
        </div>
      )}

      {/* Event Log */}
      {eventLog.length > 0 && (
        <div className="game-card p-4">
          <h3 className="font-bold text-sm text-gray-300 mb-3">📜 Historico de Exploracao</h3>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {eventLog.map((event, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-white/5">
                <span className="text-lg">{event.icon}</span>
                <span className="flex-1 text-gray-300">{event.name}</span>
                <span className="text-gray-500">-{event.energyCost}⚡</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Types Guide */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">📖 Eventos Possiveis</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#ffd700]/5">
            <span>📦</span><span className="text-gray-400">Baus — ouro e cristais</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#e94560]/5">
            <span>⚔️</span><span className="text-gray-400">Combate — monstros raros</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#a855f7]/5">
            <span>🌟</span><span className="text-gray-400">Bencoes — XP extra</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#f59e0b]/5">
            <span>🧙</span><span className="text-gray-400">Mercador — descontos</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#e94560]/5">
            <span>⚠️</span><span className="text-gray-400">Armadilhas — perda de ouro</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <span>💤</span><span className="text-gray-400">Nada — sem recompensa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
