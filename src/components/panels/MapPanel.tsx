"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { REGIONS, regionWithAlpha } from "@/game/constants";

export default function MapPanel() {
  const { character, characterId, locale, notify, setCharacter } = useGameStore();
  const [changing, setChanging] = useState<string | null>(null);
  const [regionToConfirm, setRegionToConfirm] = useState<string | null>(null);

  if (!character) return null;

  const currentLevel = character.level as number;
  const currentRegionId = character.currentRegion as string;
  const currentRegion = REGIONS.find((r) => r.id === currentRegionId);

  const handleRegionChange = async (regionId: string) => {
    setChanging(regionId);
    setRegionToConfirm(null);
    try {
      const res = await fetch("/api/region/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, regionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || t("map.travelError", locale), "error");
        setChanging(null);
        return;
      }
      
      const charRes = await fetch(`/api/character/${characterId}`);
      const charData = await charRes.json();
      if (charData.character) {
        setCharacter(charData.character);
      }
      notify("🗺️ Viajou para " + t("region." + regionId, locale) + "!", "success");
    } catch {
      notify(t("map.connectionError", locale), "error");
    }
    setChanging(null);
  };

  return (
    <div className="p-6 space-y-8 animate-fadeIn">
      <div className="flex items-center gap-4">
        <img src="/images/sidebar/menu_mapa.png" alt={t("map.title", locale)} className="w-12 h-12 object-contain" />
        <div>
          <h2 className="text-3xl font-black text-white">{t("map.title", locale)}</h2>
          <p className="text-gray-400">{t("map.subtitle", locale)}</p>
        </div>
      </div>

      {currentRegion && (
        <div
          className="relative overflow-hidden rounded-2xl p-6 flex items-center gap-6 border"
          style={{
            borderColor: regionWithAlpha(currentRegion.accent, 0.45),
            boxShadow: `0 0 26px ${regionWithAlpha(currentRegion.accent, 0.12)}`,
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url(${currentRegion.bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(10,10,24,0.88) 0%, rgba(10,10,24,0.55) 100%)" }}
          />
          <img
            src={currentRegion.image}
            alt={currentRegion.id}
            className="relative w-24 h-24 rounded-2xl border object-cover shadow-lg island-float"
            style={{ borderColor: regionWithAlpha(currentRegion.accent, 0.6), boxShadow: `0 0 20px ${regionWithAlpha(currentRegion.accent, 0.3)}` }}
          />
          <div className="relative">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: currentRegion.accent }}>
              {t("map.currentRegion", locale)}
            </span>
            <h3 className="text-2xl font-bold text-white">{t("region." + currentRegion.id, locale)}</h3>
            <p className="text-gray-300 text-sm">{t("region." + currentRegion.id + ".desc", locale)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REGIONS.map((region) => {
          const unlocked = currentLevel >= region.minLevel;
          const isCurrent = currentRegionId === region.id;
          const isChanging = changing === region.id;

          return (
            <div
              key={region.id}
              className={"relative p-4 rounded-xl border transition-all duration-300 group " +
                (isCurrent 
                  ? "bg-indigo-900/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                  : unlocked 
                    ? "bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:-translate-y-1 cursor-pointer"
                    : "bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed")}
              onClick={() => unlocked && !isCurrent && setRegionToConfirm(region.id)}
            >
              {isChanging && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10 backdrop-blur-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <img
                  src={region.image}
                  alt={region.id}
                  className="w-16 h-16 rounded-lg border border-white/15 object-cover transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 img-glow"
                  style={{ boxShadow: `0 0 14px ${regionWithAlpha(region.accent, 0.18)}` }}
                />
                <div className="flex-1">
                  <h4 className="font-bold text-white">{t("region." + region.id, locale)}</h4>
                  <div className="text-xs text-gray-400">Lv. {region.minLevel}+</div>
                </div>
                {!unlocked && <span className="text-xl">🔒</span>}
                {isCurrent && (
                  <span className="text-xs bg-transparent border border-white/25 text-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    {t("map.currentRegion", locale)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {regionToConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/60 backdrop-blur-2xl p-6 rounded-xl border border-indigo-500/40 max-w-sm w-full">
            <h3 className="text-xl font-bold text-white mb-4">{t("map.travelTo", locale)} {t("region." + regionToConfirm, locale)}?</h3>
            <p className="text-gray-400 mb-6">{t("map.confirmTravel", locale)}</p>
            <div className="flex gap-4">
              <button 
                className="flex-1 bg-slate-700/50 hover:bg-slate-600/60 text-white py-2 rounded-lg backdrop-blur-md border border-white/10"
                onClick={() => setRegionToConfirm(null)}
              >
                {t("general.cancel", locale)}
              </button>
              <button 
                className="flex-1 bg-indigo-600/50 hover:bg-indigo-500/60 text-white py-2 rounded-lg backdrop-blur-md border border-white/10"
                onClick={() => handleRegionChange(regionToConfirm)}
              >
                {t("map.travel", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}