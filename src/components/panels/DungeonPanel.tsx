"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import {
  DUNGEON_DAILY_CAP,
  DUNGEON_DURATIONS_SEC,
  DUNGEON_DIFFICULTIES,
  difficultyDef,
  computeDungeonRewards,
  computeDungeonStatus,
  dungeonCapFloor,
  DUNGEON_BOSSES,
  getDungeonBoss,
  dungeonDurationFactor,
  dungeonEnergyCostWithDiff,
  type DungeonDifficulty,
} from "@/game/dungeons";

export default function DungeonPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [selectedSec, setSelectedSec] = useState<number>(7200);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<DungeonDifficulty>("normal");
  const [starting, setStarting] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [bossPreview, setBossPreview] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [, setTick] = useState(0); // força re-render para o countdown

  const refresh = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character?id=${characterId}`);
      const data = await res.json();
      if (data.character) setCharacter(data.character);
    } catch { /* ignore */ }
  }, [characterId, setCharacter]);

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);

  

  useEffect(() => {
    fetch("/api/combat?action=dungeon-ranking").then(r => r.json()).then(d => setRanking(d.ranking || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const status = character ? computeDungeonStatus(character as any) : null;
  const cap = dungeonCapFloor(Number((character as any)?.level) || 1);
  const attempt = Math.max(1, Math.min(cap, selectedFloor));

  useEffect(() => {
    const boss = getDungeonBoss(attempt);
    setBossPreview(boss || null);
  }, [attempt]);
  const hours = DUNGEON_DURATIONS_SEC.find((d) => d.sec === selectedSec)?.hours ?? 2;
  const diff = difficultyDef(difficulty);
  const cost = dungeonEnergyCostWithDiff(hours, diff);
  const preview = character ? computeDungeonRewards(character as any, attempt, hours, diff) : null;
  const energy = Number((character as any)?.energy) || 0;
  const level = Number((character as any)?.level) || 1;

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
      const res = await fetch("/api/combat?action=dungeon-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, durationSec: selectedSec, attemptFloor: attempt, difficulty }),
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
      const res = await fetch("/api/combat?action=dungeon-collect", {
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
          <img src="/images/sidebar/menu_masmorras.png" alt={t("dungeon.title", locale)} className="w-10 h-10 object-contain animate-float" />
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
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><span>🎚️</span>{t("dungeon.difficulty", locale)}</h3>
              <div className="grid grid-cols-4 gap-2">
                {DUNGEON_DIFFICULTIES.map((d) => {
                  const locked = level < d.minLevel;
                  const active = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => !locked && setDifficulty(d.id as DungeonDifficulty)}
                      disabled={locked}
                      className={`rounded-xl border p-2.5 text-center transition-all ${active && !locked ? "border-[#a855f7] bg-[#a855f7]/15 ring-2 ring-[#a855f7]/40" : locked ? "border-white/5 bg-white/5 opacity-40 cursor-not-allowed" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                    >
                      <div className="text-xl">{d.icon}</div>
                      <div className="text-[10px] font-black text-white">{t(d.nameKey, locale)}</div>
                      <div className="text-[9px] text-gray-500">×{d.rewardMult}{locked ? ` · Lv.${d.minLevel}` : ""}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{t("dungeon.difficultyHint", locale)}</p>
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
                {Number(preview.rolls) > 0 && (
                  <div className="bg-gradient-to-br from-[#a855f7]/10 to-transparent rounded-xl p-3 border border-[#a855f7]/20">
                    <div className="text-sm text-gray-400">{t("dungeon.estDrops", locale)}</div>
                    <div className="text-xl font-black text-[#a855f7]">{preview.rolls} 🎲</div>
                  </div>
                )}
              </div>
              {Number(preview.rolls) > 0 && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm">
                  <span className="text-gray-400">{t("dungeon.estBest", locale)}:</span>
                  <span className="rounded-full px-3 py-1 font-bold text-xs text-black" style={{ background: RARITY_COLORS[preview.bestRarity] || "#9ca3af" }}>
                    {String(preview.bestRarity).toUpperCase()}
                  </span>
                </div>
              )}

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

      
      {/* Boss Preview */}
      {bossPreview && (
        <div className="game-card p-5 border-[#e94560]/30 bg-gradient-to-r from-[#e94560]/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{bossPreview.icon}</div>
            <div>
              <h3 className="text-lg font-black text-[#e94560]">Boss: {bossPreview.name}</h3>
              <p className="text-sm text-gray-400">{bossPreview.description}</p>
              <div className="flex gap-3 mt-2 text-xs flex-wrap">
                <span className="text-[#ffd700]">💰 +{bossPreview.bonusGold.toLocaleString()}</span>
                <span className="text-[#00ff88]">✨ +{bossPreview.bonusXp.toLocaleString()} XP</span>
                <span className="text-[#06b6d4]">💎 +{bossPreview.bonusCrystals}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boss Guide */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">👹 Bosses da Masmorra</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {DUNGEON_BOSSES.map((b) => {
            const bestFloor = Number(((character as any)?.dungeonStats?.bestFloor) ?? 0);
            const beaten = bestFloor >= b.floor;
            return (
              <div key={b.floor} className={"text-center p-2 rounded-lg border " + (beaten ? "border-[#00ff88]/40 bg-[#00ff88]/5" : "border-white/10 bg-white/5")}>
                <div className="text-xl">{b.icon}</div>
                <div className="text-[9px] font-bold text-white truncate">{b.name}</div>
                <div className="text-[8px] text-gray-500">Andar {b.floor}</div>
                {beaten && <div className="text-[8px] text-[#00ff88]">✓ Derrotado</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="game-card p-4">
          <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 Ranking de Masmorras</h3>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map((r: any, i: number) => (
              <div key={r.id} className={"flex items-center gap-3 p-2 rounded-lg " + (r.id === characterId ? "bg-[#a855f7]/10 border border-[#a855f7]/30" : "bg-white/5")}>
                <div className="w-6 text-center font-bold text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-gray-500">{i + 1}</span>}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{r.name}</div>
                  <div className="text-[10px] text-gray-500">Lv.{r.level} • {r.totalRuns} runs</div>
                </div>
                <div className="text-sm font-bold text-[#a855f7]">🗼 Andar {r.bestFloor}</div>
              </div>
            ))}
          </div>
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