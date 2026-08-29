"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { missionImage } from "@/game/constants";
import { missionTitle } from "@/game/generatedMissions";

export default function MissionsPanel() {
  const { characterId, locale, notify, character, setCharacter } = useGameStore();
  const [available, setAvailable] = useState<Array<Record<string, unknown>>>([]);
  const [active, setActive] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [startingMission, setStartingMission] = useState<number | null>(null);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');
  // Missões Diárias + Semanais (reset automático)
  const [daily, setDaily] = useState<Array<Record<string, unknown>>>([]);
  const [weekly, setWeekly] = useState<Array<Record<string, unknown>>>([]);
  const [weeklyBonus, setWeeklyBonus] = useState<Record<string, unknown> | null>(null);
  const [claimingDaily, setClaimingDaily] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const energyRegenMsRef = useRef(0);
  const energyAtRef = useRef(Date.now());
  const crossedRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (!characterId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/character?id=${characterId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setAvailable(data.availableMissions ?? []);
      setActive(data.activeMissions ?? []);
      if (data.character) setCharacter({ ...data.character, _energyAt: Date.now() });
    } catch (e) {
      console.error("Load error:", e);
      notify(t("mission.loadError", locale), "error");
    }
    setLoading(false);
  }, [characterId, setCharacter, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Carrega as missões diárias/semanais com progresso.
  const loadDaily = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/missions?action=daily&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setDaily(Array.isArray(d.daily) ? d.daily : []);
      setWeekly(Array.isArray(d.weekly) ? d.weekly : []);
      setWeeklyBonus(d.weeklyBonus ?? null);
    } catch { /* silencioso */ }
  }, [characterId]);

  useEffect(() => { loadDaily(); }, [loadDaily]);

  const claimDailyMission = async (kind: string, list: "daily" | "weekly") => {
    if (!characterId || claimingDaily) return;
    setClaimingDaily(`${list}_${kind}`);
    try {
      const res = await fetch("/api/missions?action=daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, kind, list }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error, "error"); setClaimingDaily(null); return; }
      notify(d.message || "🎁 Recompensa coletada!", "success");
      if (d.character) setCharacter(d.character);
      await loadDaily();
    } catch { notify(t("general.error", locale), "error"); }
    setClaimingDaily(null);
  };

  /** Renderiza uma lista de missões (diárias ou semanais) com progresso + coletar. */
  const renderMissionList = (list: Array<Record<string, unknown>>, listType: "daily" | "weekly") => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        {list.map((m) => {
          const id = String(m.id);
          const target = Number(m.target) || 1;
          const progress = Number(m.progress) || 0;
          const pct = Math.min(100, (progress / target) * 100);
          const done = !!m.done;
          const claimed = !!m.claimed;
          const rw = (m.reward || {}) as Record<string, number>;
          return (
            <div key={id} className={`rounded-xl border p-3 transition-all ${done && !claimed ? "border-[#ffd700]/50 bg-[#ffd700]/5 shadow-[0_0_15px_rgba(255,215,0,0.1)]" : claimed ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-[#1a1a2e]"}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: done ? "rgba(34,197,94,0.15)" : "rgba(255,215,0,0.1)" }}>
                  {String(m.icon || "📋")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{t(String(m.nameKey), locale)}</span>
                    {done && !claimed && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ffd700]/20 text-[#ffd700] font-bold animate-pulse">PRONTO!</span>}
                    {claimed && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">✓ Coletado</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{t(String(m.descKey), locale).replace("{n}", String(target))}</div>
                </div>
                {claimed ? null : done ? (
                  <button
                    onClick={() => claimDailyMission(id, listType)}
                    disabled={claimingDaily !== null}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black disabled:opacity-40 hover:scale-105 transition-transform"
                  >
                    {claimingDaily === `${listType}_${id}` ? "…" : "🎁 Coletar"}
                  </button>
                ) : null}
              </div>
              {/* Barra de progresso */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? "bg-gradient-to-r from-[#22c55e] to-[#84cc16]" : "bg-gradient-to-r from-[#ffd700] to-[#f59e0b]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 tabular-nums font-bold min-w-[40px] text-right">{progress}/{target}</span>
              </div>
              {/* Recompensas */}
              <div className="mt-2 flex gap-3 text-[10px] flex-wrap">
                {rw.gold ? <span className="text-[#ffd700] font-bold">💰 {String(rw.gold)}</span> : null}
                {rw.crystals ? <span className="text-[#a855f7] font-bold">🔮 {String(rw.crystals)}</span> : null}
                {rw.towerCoins ? <span className="text-[#60a5fa] font-bold">🗼 {String(rw.towerCoins)}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (typeof (character as any)?.energyRegenMs === "number") energyRegenMsRef.current = (character as any).energyRegenMs;
    if (typeof (character as any)?._energyAt === "number") energyAtRef.current = (character as any)._energyAt;
  }, [character]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Quando a próxima energia "caia", busca dados novos silenciosamente para
      // atualizar o valor/contador sem piscar a tela.
      const ms = energyRegenMsRef.current;
      const remaining = ms - (Date.now() - energyAtRef.current);
      if (ms > 0 && remaining <= 0 && !crossedRef.current) {
        crossedRef.current = true;
        loadData(true);
      } else if (remaining > 0) {
        crossedRef.current = false;
      }
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const startMission = async (missionId: number) => {
    setStartingMission(missionId);
    try {
      const res = await fetch("/api/missions?action=start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, missionId }),
      });
      const data = await res.json();
      if (!res.ok) { 
        notify(data.error, "error"); 
        setStartingMission(null);
        return; 
      }
      notify("🚀 " + t("mission.start", locale) + "!", "success");
      loadData();
    } catch { 
      notify(t("general.error", locale), "error"); 
    }
    setStartingMission(null);
  };

  const claimMission = async (activeMissionId: string) => {
    setClaimingMission(activeMissionId);
    try {
      const res = await fetch("/api/missions?action=claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMissionId }),
      });
      const data = await res.json();
      if (!res.ok) { 
        notify(data.error, "error"); 
        setClaimingMission(null);
        return; 
      }
      const r = data.rewards;
      let msg = "🎉 +" + r.xp + " XP, +" + r.gold + " " + t("currency.gold", locale) + (r.levelUp ? " 🆙 " + t("stat.level", locale) + " " + r.newLevel + "!" : "");
      // Drops de missão (equipamento/poção) aparecem na notificação.
      if (r.drops && r.drops.length > 0) {
        const names = r.drops.map((d: any) => (d.icon || "📦") + " " + t(d.nameKey, locale)).join(", ");
        msg += " 🎁 Drop: " + names + "!";
      }
      notify(msg, "success");
      loadData();
    } catch { 
      notify(t("general.error", locale), "error"); 
    }
    setClaimingMission(null);
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ":" + m.toString().padStart(2, "0") + ":" + s.toString().padStart(2, "0");
    return m + ":" + s.toString().padStart(2, "0");
  };

  // Quanto falta (em segundos) para ganhar +1 energia, usando o msToNext do servidor.
  const formatEnergyTime = () => {
    const ms = energyRegenMsRef.current;
    const remainingMs = Math.max(0, ms - (Date.now() - energyAtRef.current));
    return formatTime(Math.ceil(remainingMs / 1000));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
        <div className="spinner mb-4"></div>
        <p className="text-gray-400">{t("general.loading", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2 sm:gap-3">
          <img src="/images/sidebar/menu_missoes.png" alt={t("nav.missions", locale)} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("nav.missions", locale)}
          </span>
        </h2>
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1a1a2e] rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-gray-800 flex-shrink-0">
          <span className="text-xl">⚡</span>
          <span className="flex flex-col leading-tight text-left">
            <span className="text-[#ffcc00] font-bold">{String(character?.energy ?? 0)}<span className="text-gray-500 text-xs font-normal"> / {String(character?.maxEnergy ?? 100)}</span></span>
            <span className={"text-[10px] " + ((Number(character?.energy) || 0) >= (Number(character?.maxEnergy) || 100) ? "text-[#22c55e]" : "text-gray-500")}>
              {(Number(character?.energy) || 0) >= (Number(character?.maxEnergy) || 100) ? "⚡ Cheio" : "+1 ⚡ em " + formatEnergyTime()}
            </span>
          </span>
        </div>
      </div>

      {/* Missões Diárias + Semanais (reset automático) */}
      <div className="space-y-4">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-black flex items-center gap-2">
              <span className="text-xl">🔁</span> {t("daily.title", locale)}
            </h3>
            <span className="text-[10px] text-gray-500">{t("daily.subtitle", locale)}</span>
          </div>
          {renderMissionList(daily, "daily") ?? (
            <div className="game-card p-4 text-center text-xs text-gray-500">{t("general.loading", locale)}</div>
          )}
        </section>
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-black flex items-center gap-2">
              <span className="text-xl">🗓️</span> {t("weekly.title", locale)}
            </h3>
            <span className="text-[10px] text-gray-500">{t("weekly.subtitle", locale)}</span>
          </div>
          {renderMissionList(weekly, "weekly") ?? (
            <div className="game-card p-4 text-center text-xs text-gray-500">{t("general.loading", locale)}</div>
          )}
          {/* Bônus por completar TODAS as semanais */}
          {weeklyBonus && (
            <div className={`mt-3 rounded-xl border p-4 ${(weeklyBonus as any).done && !(weeklyBonus as any).claimed ? "border-[#ffd700]/60 bg-[#ffd700]/10" : "border-white/10 bg-[#0a0a12]"}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-black text-[#ffd700]">🏆 {t("weekly.bonus", locale)}</div>
                  <div className="text-[11px] text-gray-400">{t("weekly.bonus.desc", locale)}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    💰 {String((weeklyBonus as any).reward?.gold || 0)} · 💎 {String((weeklyBonus as any).reward?.diamonds || 0)} · 🗼 {String((weeklyBonus as any).reward?.towerCoins || 0)}
                  </div>
                </div>
                {(weeklyBonus as any).claimed ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">✓ {t("ach.claimed", locale)}</span>
                ) : (weeklyBonus as any).done ? (
                  <button
                    onClick={() => claimDailyMission("weekly_bonus", "weekly")}
                    disabled={claimingDaily !== null}
                    className="text-[10px] px-3 py-1.5 rounded-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black font-black disabled:opacity-40"
                  >
                    {claimingDaily === "weekly_weekly_bonus" ? "…" : "🎁 " + t("mission.claim", locale)}
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-500 font-bold">🔒 {t("weekly.bonus.locked", locale)}</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 sm:gap-3 pb-1 flex-wrap">
        <button
          onClick={() => setActiveTab('available')}
          className={`bg-transparent text-sm sm:text-base lg:text-lg font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 touch-target ${activeTab === 'available' ? "border-white/60 bg-white/10" : ""}`}
        >
          {t("mission.available", locale)} ({available.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`bg-transparent text-sm sm:text-base lg:text-lg font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 touch-target ${activeTab === 'active' ? "border-white/60 bg-white/10" : ""}`}
        >
          {t("mission.active", locale)} ({active.length})
        </button>
      </div>

      {activeTab === 'available' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-fadeIn">
          {available.length === 0 ? (
            <div className="md:col-span-2 empty-state p-10 text-center">
              {t("mission.noMissions", locale)}
            </div>
          ) : (
            available.map((m, index) => {
              const mission = m as Record<string, unknown>;
              const canStart = (character?.energy as number) >= (mission.energyCost as number);
              const playerLevel = (character?.level as number) || 1;
              const levelOk = playerLevel >= (mission.minLevel as number);
              const canStartAll = levelOk && ((character?.energy as number) >= (mission.energyCost as number));
              const diff = Math.min(5, Math.ceil((mission.minLevel as number) / 10));

              return (
                <div 
                  key={mission.id as number} 
                  className="game-card p-3 sm:p-4 hover:border-gray-600 transition-all stagger-item card-hover"
                  style={{ animationDelay: (index * 0.05) + 's' }}
                >
                  <div className="flex items-start gap-4">
                    {missionImage(mission.nameKey as string) ? (
                      <img
                        src={missionImage(mission.nameKey as string)}
                        alt={missionTitle(mission, locale)}
                        className="w-11 h-11 object-cover rounded-lg shrink-0"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <div className="text-4xl leading-none">{mission.icon as string}</div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-lg text-white">{missionTitle(mission, locale)}</div>
                        {(mission.minLevel as number) === ((character?.level as number) || 1) + 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-red-500 text-white">
                            {t("mission.challenge", locale)} Lv.{(mission.minLevel as number)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{t(mission.descKey as string, locale)}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1">⏱️ {String(mission.durationSec)}s</div>
                        <div className="flex items-center gap-1 text-[#00ff88]">✨ {String((mission as any).effectiveXp ?? mission.xpReward)} XP</div>
                        <div className="flex items-center gap-1 text-[#ffd700]">💰 {String(mission.goldReward)}</div>
                        <div className={"flex items-center gap-1 " + (canStart ? 'text-[#ffcc00]' : 'text-red-400')}>⚡ {String(mission.energyCost)}</div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex text-xs">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={(i < diff ? 'text-yellow-500' : 'text-gray-700')}>⭐</span>
                          ))}
                        </div>
                        <div className="badge-level">Lv.{String(mission.minLevel)}+</div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                      onClick={() => startMission(mission.id as number)} 
                      disabled={!canStartAll || startingMission === mission.id}
                      className={
                        "w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all touch-target " +
                        (startingMission === mission.id
                          ? "bg-blue-600 text-white cursor-wait"
                          : canStartAll
                            ? "bg-transparent border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50"
                            : "bg-transparent border border-white/10 text-gray-600 cursor-not-allowed")
                      }
                      title={!canStartAll ? (!levelOk ? t("mission.minLevel", locale) + " " + String(mission.minLevel) : t("mission.energy", locale)) : ''}
                    >
                      {startingMission === mission.id ? (
                        <span className="flex items-center justify-center gap-2">⏳ {t("general.loading", locale)}</span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">⚡ {t("mission.start", locale)}</span>
                      )}
                    </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {active.length === 0 ? (
            <div className="empty-state p-10 text-center">
              {t("mission.noMissions", locale)}
            </div>
          ) : (
            active.map((m) => {
              const mission = m as { active: Record<string, unknown>; template: Record<string, unknown> };
              const endsAt = new Date(mission.active.endsAt as string).getTime();
              const startedAt = new Date(mission.active.startedAt as string).getTime();
              const now = Date.now();
              const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));
              const completed = remaining <= 0;
              const total = (endsAt - startedAt) / 1000;
              const elapsed = (now - startedAt) / 1000;
              const progress = Math.min(100, (elapsed / total) * 100);

              return (
                <div key={mission.active.id as string} className="game-card-accent p-4 border border-white/25">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white flex items-center gap-2">
                      {missionImage(mission.template.nameKey as string) ? (
                        <img
                          src={missionImage(mission.template.nameKey as string)}
                          alt={missionTitle(mission.template, locale)}
                          className="w-8 h-8 object-cover rounded-md shrink-0"
                          draggable={false}
                        />
                      ) : (
                        <span>{mission.template.icon as string}</span>
                      )}
                      {missionTitle(mission.template, locale)}
                    </span>
                    <span className={"font-mono font-bold " + (completed ? 'text-green-400' : 'text-[#4ecdc4]')}>
                      {completed ? t("mission.completed", locale) + "!" : formatTime(remaining)}
                    </span>
                  </div>
                  
                  <div className="bar-container mb-3">
                    <div className="mission-bar" style={{ width: progress + '%' }} />
                  </div>

                  {completed && (
                    <button 
                      onClick={() => claimMission(mission.active.id as string)} 
                      disabled={claimingMission === mission.active.id}
                      className="w-full py-3 rounded-xl font-black text-sm transition-all transform hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black shadow-[0_0_18px_rgba(255,215,0,0.35)] animate-pulse disabled:animate-none disabled:opacity-50"
                    >
                      {claimingMission === mission.active.id ? (
                        <span className="flex items-center justify-center gap-2">⏳ {t("general.loading", locale)}</span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">🎁 {t("mission.claim", locale)}</span>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
