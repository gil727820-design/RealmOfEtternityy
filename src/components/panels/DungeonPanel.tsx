"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import {
  DUNGEON_DAILY_CAP,
  DUNGEON_DURATIONS_SEC,
  computeDungeonRewards,
  computeDungeonStatus,
  dungeonCapFloor,
  dungeonDurationFactor,
  dungeonEnergyCost,
} from "@/game/dungeons";

export default function DungeonPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [selectedSec, setSelectedSec] = useState<number>(7200);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [starting, setStarting] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [, setTick] = useState(0); // força re-render para o countdown

  const refresh = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.character) setCharacter(data.character);
    } catch { /* ignore */ }
  }, [characterId, setCharacter]);

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);

  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const status = character ? computeDungeonStatus(character as any) : null;
  const cap = dungeonCapFloor(Number((character as any)?.level) || 1);
  const attempt = Math.max(1, Math.min(cap, selectedFloor));
  const hours = DUNGEON_DURATIONS_SEC.find((d) => d.sec === selectedSec)?.hours ?? 2;
  const cost = dungeonEnergyCost(hours);
  const preview = character ? computeDungeonRewards(character as any, attempt, hours) : null;
  const energy = Number((character as any)?.energy) || 0;

  const activeRun = status?.active ?? null;
  const activeDone = activeRun ? activeRun.done : false;
  const remaining = status?.daily?.remaining ?? 0;

  const formatClock = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
  };

  const progressPct = activeRun
    ? Math.min(100, (activeRun.elapsedSec / Math.max(1, activeRun.durationSec)) * 100)
    : 0;

  const start = async () => {
    if (!characterId) return;
    setStarting(true);
    try {
      const res = await fetch("/api/dungeon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, durationSec: selectedSec, attemptFloor: attempt }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`🏰 ${t("dungeon.start", locale)}! ${t("dungeon.doing", locale)} ${t("dungeon.for", locale)} ${hours}h.`, "success");
        setResult(null);
        await refresh();
      } else {
        notify(data.error || t("general.error", locale), "error");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setStarting(false);
  };

  const collect = async () => {
    if (!characterId) return;
    setCollecting(true);
    try {
      const res = await fetch("/api/dungeon/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        notify(`🏆 ${t("dungeon.clears", locale)}: ${data.clears ?? 0} — ${t("dungeon.result", locale)}!`, "success");
        await refresh();
      } else {
        notify(data.error || t("general.error", locale), "error");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setCollecting(false);
  };

  if (loading) {
    return <div className="flex flex-col items-center justify-center py-20"><div className="spinner mb-4"></div></div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl animate-float">🕳️</span>
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t("dungeon.title", locale)}</span>
        </h2>
        <p className="text-gray-400 text-sm max-w-md mt-1">{t("dungeon.sub", locale)}</p>
      </div>

      {/* Limite diário */}
      {status && (
        <div className="game-card game-card-glow p-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="text-sm text-gray-400">{t("dungeon.dailyUsed", locale)}</div>
              <div className="font-black text-lg">
                {status.daily.used}/{DUNGEON_DAILY_CAP}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {t("dungeon.remaining", locale)}: <span className={`font-bold ${remaining > 0 ? "text-[#00ff88]" : "text-red-400"}`}>{remaining}</span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-white/5 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span>⚡ {cost} {t("stat.energy", locale)}</span>
            <span className="text-gray-400">({energy})</span>
          </div>
        </div>
      )}

      {/* Expedição em andamento */}
      {activeRun ? (
        <div className="game-card game-card-glow p-6 text-center animate-fadeInUp">
          <div className="text-5xl mb-3">{activeRun.done ? "🏆" : "🏰"}</div>
          <h3 className="text-xl font-bold text-white mb-1">{t("dungeon.inProgress", locale)}</h3>
          <p className="text-gray-400 text-sm mb-4">
            {t("dungeon.doing", locale)} {t("dungeon.for", locale)} <span className="font-bold text-white">{activeRun.hours}h</span> • {t("dungeon.tryFloor", locale)} <span className="font-bold text-white">{activeRun.attemptFloor}</span>
          </p>

          <div className="max-w-md mx-auto mb-4">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#06b6d4] transition-all duration-1000" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{t("dungeon.elapsed", locale)} {Math.floor(progressPct)}%</span>
              <span className={activeRun.done ? "text-[#00ff88] font-bold" : ""}>
                {activeRun.done ? "✓" : `⏳ ${t("dungeon.timeLeft", locale)}: ${formatClock(activeRun.remainingSec)}`}
              </span>
            </div>
          </div>

          {activeRun.done ? (
            <>
              <p className="text-[#00ff88] font-semibold mb-4 animate-pulse">{t("dungeon.finishing", locale)}</p>
              <button onClick={collect} disabled={collecting} className="game-btn-gold game-btn text-lg px-10 py-3 animate-pulse-glow">
                {collecting ? <span className="flex items-center gap-2"><span className="spinner w-5 h-5 border-2 border-[#1a1a2e]"></span>...</span> : `🎁 ${t("dungeon.collect", locale)}`}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">⏰ {t("dungeon.timeLeft", locale)}: <span className="font-mono text-white">{formatClock(activeRun.remainingSec)}</span></p>
          )}
        </div>
      ) : remaining <= 0 ? (
        <div className="game-card p-8 text-center">
          <div className="text-5xl mb-3">🚫</div>
          <p className="text-red-400 font-bold text-lg">{t("dungeon.capNotice", locale)}</p>
        </div>
      ) : (
        <>
          {/* Formulário de nova expedição */}
          <div className="game-card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span>⏱️</span>{t("dungeon.duration", locale)}</h3>
            <div className="grid grid-cols-3 gap-3">
              {DUNGEON_DURATIONS_SEC.map((d) => (
                <button
                  key={d.sec}
                  onClick={() => setSelectedSec(d.sec)}
                  className={`rounded-xl border p-4 text-center transition-all ${selectedSec === d.sec ? "border-[#a855f7] bg-[#a855f7]/15 ring-2 ring-[#a855f7]/40" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <div className="text-3xl mb-1">🕐</div>
                  <div className="font-black text-lg">{d.hours}h</div>
                  <div className="text-[11px] text-gray-400 mt-1">recompensa ×{dungeonDurationFactor(d.hours).toLocaleString("pt-BR")}</div>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><span>🏔️</span>{t("dungeon.tryFloor", locale)}</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedFloor((f) => Math.max(1, f - 1))} className="game-btn px-4 py-2 text-xl">−</button>
                <div className="flex-1 text-center">
                  <div className="text-4xl font-black text-[#a855f7]">{attempt}</div>
                  <div className="text-[11px] text-gray-500">{t("dungeon.tethered", locale)}: {cap}</div>
                </div>
                <button onClick={() => setSelectedFloor((f) => Math.min(cap, f + 1))} className="game-btn px-4 py-2 text-xl">+</button>
              </div>
              <input
                type="range" min={1} max={cap} value={attempt}
                onChange={(e) => setSelectedFloor(Number(e.target.value))}
                className="w-full mt-3 accent-[#a855f7]"
              />
              <p className="text-xs text-gray-500 mt-2">{t("dungeon.tryFloorHint", locale)}</p>
            </div>
          </div>

          {/* Prévia */}
          {preview && (
            <div className="game-card p-5 border-[#a855f7]/30">
              <h3 className="font-bold mb-3 text-sm text-gray-300">🔮 {t("dungeon.result", locale)}: {t("dungeon.clears", locale)} ~{preview.clears}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gradient-to-br from-[#ffd700]/10 to-transparent rounded-xl p-3 border border-[#ffd700]/20">
                  <div className="text-sm text-gray-400">{t("dungeon.estGold", locale)}</div>
                  <div className="text-xl font-black text-[#ffd700]">+{preview.gold.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-[#00ff88]/10 to-transparent rounded-xl p-3 border border-[#00ff88]/20">
                  <div className="text-sm text-gray-400">{t("dungeon.estXp", locale)}</div>
                  <div className="text-xl font-black text-[#00ff88]">+{preview.xp.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-[#06b6d4]/10 to-transparent rounded-xl p-3 border border-[#06b6d4]/20">
                  <div className="text-sm text-gray-400">{t("dungeon.estCrystals", locale)}</div>
                  <div className="text-xl font-black text-[#06b6d4]">+{preview.crystals}</div>
                </div>
                <div className="bg-gradient-to-br from-[#a855f7]/10 to-transparent rounded-xl p-3 border border-[#a855f7]/20">
                  <div className="text-sm text-gray-400">{t("dungeon.estDrops", locale)}</div>
                  <div className="text-xl font-black text-[#a855f7]">{preview.rolls} 🎲</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm">
                <span className="text-gray-400">{t("dungeon.estBest", locale)}:</span>
                <span className="rounded-full px-3 py-1 font-bold text-xs text-black" style={{ background: RARITY_COLORS[preview.bestRarity] || "#9ca3af" }}>
                  {preview.bestRarity.toUpperCase()}
                </span>
              </div>

              <button
                onClick={start}
                disabled={starting || energy < cost}
                className="game-btn-gold game-btn text-lg w-full mt-5 py-4"
              >
                {starting ? (
                  <span className="flex items-center justify-center gap-2"><span className="spinner w-5 h-5 border-2 border-[#1a1a2e]"></span>...</span>
                ) : (
                  `🏰 ${t("dungeon.start", locale)} (−⚡${cost})`
                )}
              </button>
              {energy < cost && (
                <p className="text-red-400 text-xs text-center mt-2">⚡ {t("stat.energy", locale)} insuficiente! Custo: {cost} ⚡</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Resultado da coleta */}
      {result && (
        <div className="game-card p-5 animate-fadeIn border-[#a855f7]/40">
          <h3 className="font-bold text-[#a855f7] mb-3 text-lg">🏆 {t("dungeon.result", locale)}</h3>
          {result.defeat ? (
            <p className="text-red-400">{t("dungeon.defeat", locale)}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <span className="text-gray-400">{t("dungeon.clears", locale)}: <b className="text-white">{String(result.clears)}</b></span>
                <span className="text-[#ffd700]">+{Number(result.gold).toLocaleString()}</span>
                <span className="text-[#00ff88]">+{Number(result.xp).toLocaleString()} XP</span>
                <span className="text-[#06b6d4]">+{Number(result.crystals)} 💎</span>
              </div>
              {Boolean(result.levelUp) && <p className="text-[#a855f7] mt-2 font-bold">🎊 Level Up! → {String(result.newLevel)}</p>}
              {Array.isArray(result.drops) && (result.drops as any[]).length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-400 mb-2">{t("dungeon.found", locale)} ({t("dungeon.inventoryHint", locale)}):</p>
                  <div className="flex flex-wrap gap-2">
                    {(result.drops as any[]).map((d, i) => {
                      const rar = d.rarity || d.template?.rarity || "common";
                      return (
                        <span key={i} className="rounded-lg px-2.5 py-1 text-xs font-bold text-black" style={{ background: RARITY_COLORS[rar] || "#9ca3af" }}>
                          {d.template?.icon || "❔"} {rar.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Estatísticas + como funciona */}
      {status && (
        <div className="game-card p-5">
          <h3 className="font-bold mb-3">📊 {t("dungeon.stats", locale)}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <span>{t("dungeon.totalRuns", locale)}: <b className="text-white">{Number(((character as any)?.dungeonStats?.totalRuns) ?? 0)}</b></span>
            <span>{t("dungeon.bestFloor", locale)}: <b className="text-white">{Number(((character as any)?.dungeonStats?.bestFloor) ?? 0)}</b></span>
            <span>{t("dungeon.totalItems", locale)}: <b className="text-white">{Number(((character as any)?.dungeonStats?.itemsFound) ?? 0)}</b></span>
            <span>{t("dungeon.clears", locale)}: <b className="text-white">{Number(((character as any)?.dungeonStats?.totalClears) ?? 0)}</b></span>
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            <b>{t("dungeon.how", locale)}</b> {t("dungeon.how.text", locale)}
          </p>
        </div>
      )}
    </div>
  );
}