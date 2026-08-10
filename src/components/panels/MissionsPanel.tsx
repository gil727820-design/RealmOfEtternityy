"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { missionImage } from "@/game/constants";

export default function MissionsPanel() {
  const { characterId, locale, notify, character, setCharacter } = useGameStore();
  const [available, setAvailable] = useState<Array<Record<string, unknown>>>([]);
  const [active, setActive] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [startingMission, setStartingMission] = useState<number | null>(null);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');
  const [, setTick] = useState(0);
  const energyRegenMsRef = useRef(0);
  const energyAtRef = useRef(Date.now());
  const crossedRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (!characterId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/character/${characterId}`);
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
      const res = await fetch("/api/missions/start", {
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
      const res = await fetch("/api/missions/claim", {
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
      notify("🎉 +" + r.xp + " XP, +" + r.gold + " " + t("currency.gold", locale) + (r.levelUp ? " 🆙 " + t("stat.level", locale) + " " + r.newLevel + "!" : ""), "success");
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <img src="/images/sidebar/menu_missoes.png" alt={t("nav.missions", locale)} className="w-10 h-10 object-contain" />
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("nav.missions", locale)}
          </span>
        </h2>
        <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-xl px-4 py-2 border border-gray-800">
          <span className="text-xl">⚡</span>
          <span className="flex flex-col leading-tight text-left">
            <span className="text-[#ffcc00] font-bold">{String(character?.energy ?? 0)}<span className="text-gray-500 text-xs font-normal"> / {String(character?.maxEnergy ?? 100)}</span></span>
            <span className={"text-[10px] " + ((Number(character?.energy) || 0) >= (Number(character?.maxEnergy) || 100) ? "text-[#22c55e]" : "text-gray-500")}>
              {(Number(character?.energy) || 0) >= (Number(character?.maxEnergy) || 100) ? "⚡ Cheio" : "+1 ⚡ em " + formatEnergyTime()}
            </span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 pb-1 flex-wrap">
        <button
          onClick={() => setActiveTab('available')}
          className={`bg-transparent text-lg font-bold px-6 py-3 rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 ${activeTab === 'available' ? "border-white/60 bg-white/10" : ""}`}
        >
          {t("mission.available", locale)} ({available.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`bg-transparent text-lg font-bold px-6 py-3 rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 ${activeTab === 'active' ? "border-white/60 bg-white/10" : ""}`}
        >
          {t("mission.active", locale)} ({active.length})
        </button>
      </div>

      {activeTab === 'available' ? (
        <div className="grid md:grid-cols-2 gap-4 animate-fadeIn">
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
                  className="game-card p-4 hover:border-gray-600 transition-all stagger-item"
                  style={{ animationDelay: (index * 0.05) + 's' }}
                >
                  <div className="flex items-start gap-4">
                    {missionImage(mission.nameKey as string) ? (
                      <img
                        src={missionImage(mission.nameKey as string)}
                        alt={t(mission.nameKey as string, locale)}
                        className="w-11 h-11 object-cover rounded-lg shrink-0"
                        draggable={false}
                      />
                    ) : (
                      <div className="text-4xl leading-none">{mission.icon as string}</div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-lg text-white">{t(mission.nameKey as string, locale)}</div>
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
                        "w-full mt-4 py-3 rounded-xl font-black text-sm transition-all " +
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
                <div key={mission.active.id as string} className="game-card-accent p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white flex items-center gap-2">
                      {missionImage(mission.template.nameKey as string) ? (
                        <img
                          src={missionImage(mission.template.nameKey as string)}
                          alt={t(mission.template.nameKey as string, locale)}
                          className="w-8 h-8 object-cover rounded-md shrink-0"
                          draggable={false}
                        />
                      ) : (
                        <span>{mission.template.icon as string}</span>
                      )}
                      {t(mission.template.nameKey as string, locale)}
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
