"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { REGIONS, regionWithAlpha } from "@/game/constants";
import BossBattle from "@/components/ui/BossBattle";

export default function MapPanel() {
  const { character, characterId, locale, notify, setCharacter } = useGameStore();
  const [changing, setChanging] = useState<string | null>(null);
  const [regionToConfirm, setRegionToConfirm] = useState<string | null>(null);
  const [bossStatus, setBossStatus] = useState<any>(null);
  const [bossFighting, setBossFighting] = useState(false);
  const [bossResult, setBossResult] = useState<any>(null);
  const [regionMobs, setRegionMobs] = useState<any[]>([]);
  const [farming, setFarming] = useState(false);
  const [farmResult, setFarmResult] = useState<any>(null);
  // Farm AUTOMÁTICO: 5 lutas seguidas com menos recompensa.
  const [autoFarming, setAutoFarming] = useState(false);
  const [autoFarmResult, setAutoFarmResult] = useState<any>(null);
  const [miniBossStatus, setMiniBossStatus] = useState<any>(null);
  const [miniBossFighting, setMiniBossFighting] = useState(false);
  const [miniBossResult, setMiniBossResult] = useState<any>(null);
  // Batalha em tela cheia igual à TORRE (não é mais só o log instantâneo).
  const [miniBossBattle, setMiniBossBattle] = useState(false);
  const [regionBossBattle, setRegionBossBattle] = useState(false);

  const currentLevel = character ? ((character.level as number) ?? 1) : 0;
  const currentRegionId = (character?.currentRegion as string) || "eldoria";
  const currentRegion = REGIONS.find((r) => r.id === currentRegionId);

  const loadBoss = async () => {
    if (!characterId) return;
    try {
      const r = await fetch(`/api/region-boss?characterId=${characterId}`);
      const d = await r.json();
      if (r.ok) setBossStatus(d);
    } catch {
      /* ignora */
    }
  };

  const loadRegionMobs = async () => {
    if (!characterId) return;
    try {
      const r = await fetch(`/api/game?action=region-farm&characterId=${characterId}`);
      const d = await r.json();
      if (r.ok) setRegionMobs(d.mobs || []);
    } catch {
      /* ignora */
    }
  };

  const loadMiniBoss = async () => {
    if (!characterId) return;
    try {
      const r = await fetch(`/api/game?action=region-mini-boss&characterId=${characterId}`);
      const d = await r.json();
      if (r.ok) setMiniBossStatus(d);
    } catch {
      /* ignora */
    }
  };

  useEffect(() => {
    loadBoss();
    loadRegionMobs();
    loadMiniBoss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, character?.currentRegion]);

  if (!character) return null;

  const farmMob = async () => {
    if (!characterId || farming) return;
    setFarming(true);
    setFarmResult(null);
    try {
      const r = await fetch("/api/game?action=region-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro ao farmar", "error");
        return;
      }
      setFarmResult(d);
      const charRes = await fetch(`/api/character?id=${characterId}`);
      const charData = await charRes.json();
      if (charData.character) setCharacter(charData.character);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setFarming(false);
    }
  };

  // Farm AUTOMÁTICO: 5 lutas seguidas, com menos recompensa (servidor resolve tudo de uma vez).
  const autoFarm = async () => {
    if (!characterId || autoFarming) return;
    setAutoFarming(true);
    setAutoFarmResult(null);
    try {
      const r = await fetch("/api/game?action=region-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, auto: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro no farm automático", "error");
        return;
      }
      setAutoFarmResult(d);
      const charRes = await fetch(`/api/character?id=${characterId}`);
      const charData = await charRes.json();
      if (charData.character) setCharacter(charData.character);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setAutoFarming(false);
    }
  };

  const fightMiniBoss = async () => {
    if (!characterId || miniBossFighting) return;
    setMiniBossFighting(true);
    setMiniBossResult(null);
    try {
      const r = await fetch("/api/game?action=region-mini-boss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro", "error");
        return;
      }
      setMiniBossResult(d);
      loadMiniBoss();
      const charRes = await fetch(`/api/character?id=${characterId}`);
      const charData = await charRes.json();
      if (charData.character) setCharacter(charData.character);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setMiniBossFighting(false);
    }
  };

  const fightBoss = async () => {
    if (!characterId || bossFighting) return;
    setBossFighting(true);
    setBossResult(null);
    try {
      const r = await fetch("/api/game?action=region-boss-fight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro ao lutar", "error");
        return;
      }
      setBossResult(d);
      loadBoss();
      const charRes = await fetch(`/api/character?id=${characterId}`);
      const charData = await charRes.json();
      if (charData.character) setCharacter(charData.character);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setBossFighting(false);
    }
  };

  const handleRegionChange = async (regionId: string) => {
    setChanging(regionId);
    setRegionToConfirm(null);
    try {
      const res = await fetch("/api/game?action=region-change", {
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
      
      const charRes = await fetch(`/api/character?id=${characterId}`);
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
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="flex items-center gap-3 sm:gap-4">
        <img src="/images/sidebar/menu_mapa.png" alt={t("map.title", locale)} className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{t("map.title", locale)}</h2>
          <p className="text-gray-400">{t("map.subtitle", locale)}</p>
        </div>
      </div>

      {currentRegion && (
        <div
          className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center gap-4 sm:gap-6 border"
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
            className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl border object-cover shadow-lg island-float"
            style={{ borderColor: regionWithAlpha(currentRegion.accent, 0.6), boxShadow: `0 0 20px ${regionWithAlpha(currentRegion.accent, 0.3)}` }}
          />
          <div className="relative">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: currentRegion.accent }}>
              {t("map.currentRegion", locale)}
            </span>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{t("region." + currentRegion.id, locale)}</h3>
            <p className="text-gray-300 text-sm">{t("region." + currentRegion.id + ".desc", locale)}</p>
          </div>
        </div>
      )}

      {/* ⚔️ Farm de Mobs da região — luta contra monstros por XP/ouro/drops */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 border bg-gradient-to-br from-emerald-950/40 to-black/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.1),transparent_70%)]" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="text-4xl">⚔️</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">🗺️ {t("map.farmArea", locale)}</div>
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-white">{t("map.farmTitle", locale)}</h3>
            <div className="text-xs text-gray-400 mt-0.5">{t("map.farmDesc", locale)}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={farmMob}
              disabled={farming || autoFarming}
              className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${
                farming
                  ? "border-white/15 bg-white/5 text-gray-400"
                  : "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
              }`}
            >
              {farming ? t("map.farming", locale) + "…" : "⚔️ " + t("map.farmBtn", locale)}
            </button>
            <button
              onClick={autoFarm}
              disabled={autoFarming || farming}
              title={t("map.autoFarmHint", locale)}
              className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${
                autoFarming
                  ? "border-white/15 bg-white/5 text-gray-400"
                  : "border-[#38bdf8]/60 bg-[#38bdf8]/15 text-sky-200 hover:bg-[#38bdf8]/25 cursor-pointer"
              }`}
            >
              {autoFarming ? "⚡ " + t("map.autoFarming", locale) + "…" : "⚡ " + t("map.autoFarmBtn", locale)}
            </button>
          </div>
        </div>

        {/* Mobs da região */}
        <div className="relative mt-3 flex flex-wrap gap-2">
          {regionMobs.map((m) => (
            <span
              key={m.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${
                m.elite
                  ? "border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#f59e0b]"
                  : "border-white/10 bg-white/5 text-gray-300"
              }`}
            >
              {m.icon} {t(m.nameKey, locale)}
              {m.elite && " ⭐"}
            </span>
          ))}
        </div>

        {/* Resultado do farm */}
        {farmResult && (
          <div className={`relative mt-3 rounded-xl border p-3 text-sm ${farmResult.won ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"}`}>
            <div className="font-black">
              {farmResult.won
                ? (farmResult.elite ? "⭐ " : "✅ ") + t("map.farmWin", locale)
                : "💀 " + t("map.farmLose", locale)}
              {" "}{farmResult.mob?.icon} {t(farmResult.mob?.nameKey || "", locale)}
            </div>
            {farmResult.won && (
              <div className="text-xs text-gray-300 mt-0.5">
                ✨ +{farmResult.rewards?.xp} XP · 🪙 +{farmResult.rewards?.gold} {t("currency.gold", locale)}
                {farmResult.drops?.length > 0 && (
                  <span className="text-[#f59e0b] font-bold"> 🎁 {farmResult.drops.map((dd: any) => dd.icon + " " + t(dd.nameKey, locale)).join(", ")}</span>
                )}
                {farmResult.materialDrop && (
                  <span className="text-[#a78bfa] font-bold"> 🧪 {farmResult.materialDrop.icon} {t(farmResult.materialDrop.nameKey, locale)}</span>
                )}
              </div>
            )}
            <div className="mt-1 max-h-16 overflow-y-auto font-mono text-[9px] text-gray-500 space-y-0.5">
              {farmResult.log.slice(-4).map((l: string, i: number) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        {/* Resultado do farm AUTOMÁTICO (5 lutas, menos recompensa) */}
        {autoFarmResult && (
          <div className="relative mt-3 rounded-xl border border-sky-500/40 bg-sky-500/5 p-3 text-sm animate-fadeIn">
            <div className="font-black text-sky-300">⚡ {t("map.autoFarmDone", locale)}</div>
            <div className="text-xs text-gray-300 mt-1">
              🥊 {autoFarmResult.wins} {t("map.autoWins", locale)} · 💀 {autoFarmResult.losses} {t("map.autoLosses", locale)} · ⚡ -{autoFarmResult.energyCost} {t("general.energy", locale)}
            </div>
            {autoFarmResult.rewards && (
              <div className="text-xs text-gray-300 mt-0.5">
                ✨ +{autoFarmResult.rewards.xp} XP · 🪙 +{autoFarmResult.rewards.gold} {t("currency.gold", locale)}
                {autoFarmResult.rewards.levelUp && (
                  <span className="text-blue-300 font-bold"> ⬆️ {t("map.levelUp", locale)} {autoFarmResult.rewards.newLevel}!</span>
                )}
              </div>
            )}
            {(autoFarmResult.drops?.length > 0 || autoFarmResult.materialDrop) && (
              <div className="text-xs mt-0.5">
                {autoFarmResult.drops?.length > 0 && (
                  <span className="text-[#f59e0b] font-bold"> 🎁 {autoFarmResult.drops.map((dd: any) => dd.icon + " " + t(dd.nameKey, locale)).join(", ")}</span>
                )}
                {autoFarmResult.materialDrop && (
                  <span className="text-[#a78bfa] font-bold"> 🧪 {autoFarmResult.materialDrop.icon} {t(autoFarmResult.materialDrop.nameKey, locale)}</span>
                )}
              </div>
            )}
            {/* Resumo das 5 lutas */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {autoFarmResult.battles?.map((b: any, i: number) => (
                <span
                  key={i}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    b.won
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
                  }`}
                >
                  {b.won ? "✅" : "💀"} {b.mob?.icon} {t(b.mob?.nameKey || "", locale)}{b.mob?.elite ? " ⭐" : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 🐲 Mini-boss da região — respawn com cooldown */}
      {miniBossStatus?.miniBoss && (miniBossBattle ? (
        <BossBattle
          apiUrl="/api/game?action=region-mini-boss"
          monster={miniBossStatus.miniBoss}
          title={`🐲 ${t("map.miniBoss", locale)}`}
          fightLabel={`⚔️ ${t("map.challengeMiniBoss", locale)}`}
          accent="#f59e0b"
          onFinished={() => { loadMiniBoss(); }}
          onExit={() => setMiniBossBattle(false)}
          renderResult={(r) => {
            const drops: React.ReactNode[] = [];
            if (r.grantedDrop) drops.push(<div key="d" className="text-[#f59e0b] font-bold mt-0.5">🎁 {t("map.bossDrop", locale)}: {r.grantedDrop.icon} {t(r.grantedDrop.nameKey, locale)}</div>);
            if (r.materialDrop) drops.push(<div key="m" className="text-[#a78bfa] font-bold mt-0.5">🧪 {r.materialDrop.icon} {t(r.materialDrop.nameKey, locale)}</div>);
            if (r.relicDrop) drops.push(<div key="r" className="text-[#a855f7] font-bold mt-0.5">🗿 {t(r.relicDrop.nameKey, locale)}</div>);
            if (r.petDrop) drops.push(<div key="p" className="text-[#4ecdc4] font-bold mt-0.5">{r.petDrop.icon} {r.petDrop.added ? t("pet.hatched", locale) : t("pet.duplicate", locale)}: {t(r.petDrop.nameKey, locale)}</div>);
            return drops.length ? <div className="text-left mx-auto max-w-md">{drops}</div> : null;
          }}
        />
      ) : (
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 border bg-gradient-to-br from-orange-950/40 to-black/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(249,115,22,0.12),transparent_70%)]" />
          <div className="relative flex flex-wrap items-center gap-4">
            <img
              src={miniBossStatus.miniBoss.image}
              alt={t(miniBossStatus.miniBoss.nameKey, locale)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-2 border-orange-500/60 object-cover shadow-[0_0_20px_rgba(249,115,22,0.35)] animate-float"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">🐲 {t("map.miniBoss", locale)}</div>
              <h3 className="text-base sm:text-lg font-black text-white">{t(miniBossStatus.miniBoss.nameKey, locale)}</h3>
              <div className="text-xs text-gray-400 mt-0.5">{t("map.miniBossDesc", locale)}</div>
              {miniBossStatus.available ? (
                <button
                  onClick={() => setMiniBossBattle(true)}
                  className={`mt-2 px-4 py-1.5 rounded-xl text-sm font-black border transition-all border-orange-500/60 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25 cursor-pointer`}
                >
                  ⚔️ {t("map.challengeMiniBoss", locale)}
                </button>
              ) : (
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black bg-orange-500/10 border border-orange-500/40 text-orange-300">
                  ⏳ {t("map.miniBossRespawn", locale)}
                </span>
              )}
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{t("map.bossHp", locale)}: <span className="text-orange-300 font-black">{miniBossStatus.miniBoss.stats.maxHp}</span></div>
              <div>{t("map.bossAtk", locale)}: <span className="text-orange-300 font-black">{miniBossStatus.miniBoss.stats.attack}</span></div>
            </div>
          </div>

          {miniBossResult && (
            <div className={`relative mt-3 rounded-xl border p-3 text-sm ${miniBossResult.won ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}>
              <div className="font-black">{miniBossResult.won ? "🏆 " + t("map.miniBossWin", locale) : "💀 " + t("map.miniBossLose", locale)}</div>
              {miniBossResult.won && (
                <div className="text-xs text-gray-300 mt-0.5">
                  ✨ +{miniBossResult.rewards?.xp} XP · 🪙 +{miniBossResult.rewards?.gold} {t("currency.gold", locale)}
                  {miniBossResult.grantedDrop && (
                    <div className="text-[#f59e0b] font-bold mt-0.5">
                      🎁 {t("map.bossDrop", locale)}: {miniBossResult.grantedDrop.icon} {t(miniBossResult.grantedDrop.nameKey, locale)}
                    </div>
                  )}
                  {miniBossResult.materialDrop && (
                    <div className="text-[#a78bfa] font-bold mt-0.5">
                      🧪 {miniBossResult.materialDrop.icon} {t(miniBossResult.materialDrop.nameKey, locale)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 👹 Boss da Região — chefe permanente com cooldown diário */}
      {bossStatus?.boss && (regionBossBattle ? (
        <BossBattle
          apiUrl="/api/game?action=region-boss-fight"
          monster={bossStatus.boss}
          title={`👹 ${t("map.regionBoss", locale)}`}
          fightLabel={`⚔️ ${t("map.challengeBoss", locale)}`}
          accent="#ef4444"
          onFinished={() => { loadBoss(); }}
          onExit={() => setRegionBossBattle(false)}
          renderResult={(r) => {
            const drops: React.ReactNode[] = [];
            if (r.grantedDrop) drops.push(<div key="d" className="text-[#f59e0b] font-bold mt-0.5">🎁 {t("map.bossDrop", locale)}: {r.grantedDrop.icon} {t(r.grantedDrop.nameKey, locale)}{r.grantedDrop.enchant ? ` · ✦ ${r.grantedDrop.enchant.icon} +${r.grantedDrop.enchant.amount}` : ""}</div>);
            if (r.relicDrop) drops.push(<div key="r" className="text-[#a855f7] font-bold mt-0.5">🗿 {t(r.relicDrop.nameKey, locale)}</div>);
            if (r.petDrop) drops.push(<div key="p" className="text-[#4ecdc4] font-bold mt-0.5">{r.petDrop.icon} {r.petDrop.added ? t("pet.hatched", locale) : t("pet.duplicate", locale)}: {t(r.petDrop.nameKey, locale)}</div>);
            return drops.length ? <div className="text-left mx-auto max-w-md">{drops}</div> : null;
          }}
        />
      ) : (
        <div className="relative overflow-hidden rounded-2xl p-5 border bg-gradient-to-br from-red-950/40 to-black/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.12),transparent_70%)]" />
          <div className="relative flex flex-wrap items-center gap-4">
            <img
              src={bossStatus.boss.image}
              alt={t(bossStatus.boss.nameKey, locale)}
              className="w-20 h-20 rounded-2xl border-2 border-red-500/60 object-cover shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-float"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-400">👹 {t("map.regionBoss", locale)}</div>
              <h3 className="text-xl font-black text-white">{t(bossStatus.boss.nameKey, locale)}</h3>
              <div className="text-xs text-gray-400 mt-0.5">Lv. {bossStatus.boss.regionLevel}+ · {t("map.bossDaily", locale)}</div>
              {bossStatus.killedToday ? (
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black bg-green-500/15 border border-green-500/50 text-green-300">
                  ✅ {t("map.bossDefeated", locale)}
                </span>
              ) : (
                <button
                  onClick={() => setRegionBossBattle(true)}
                  className={`mt-2 px-4 py-2 rounded-xl text-sm font-black border transition-all border-red-500/60 bg-red-500/15 text-red-200 hover:bg-red-500/25 cursor-pointer`}
                >
                  ⚔️ {t("map.challengeBoss", locale)}
                </button>
              )}
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{t("map.bossHp", locale)}: <span className="text-red-300 font-black">{bossStatus.boss.stats.maxHp}</span></div>
              <div>{t("map.bossAtk", locale)}: <span className="text-red-300 font-black">{bossStatus.boss.stats.attack}</span></div>
              <div>{t("map.bossDef", locale)}: <span className="text-red-300 font-black">{bossStatus.boss.stats.defense}</span></div>
            </div>
          </div>

          {/* Resultado da batalha */}
          {bossResult && (
            <div className={`relative mt-4 rounded-xl border p-4 ${bossResult.won ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}>
              <div className="text-lg font-black mb-1">{bossResult.won ? "🏆 " + t("map.bossWin", locale) : "💀 " + t("map.bossLose", locale)}</div>
              {bossResult.won && (
                <div className="text-sm text-gray-300">
                  <div>✨ +{bossResult.rewards?.xp} XP · 🪙 +{bossResult.rewards?.gold} {t("currency.gold", locale)}</div>
                  {bossResult.grantedDrop && (
                    <div className="mt-1 font-bold text-[#f59e0b]">
                      🎁 {t("map.bossDrop", locale)}: {bossResult.grantedDrop.icon} {t(bossResult.grantedDrop.nameKey, locale)}
                      {bossResult.grantedDrop.enchant && ` · ✦ ${bossResult.grantedDrop.enchant.icon} +${bossResult.grantedDrop.enchant.amount}`}
                    </div>
                  )}
                  {bossResult.potionGranted && (
                    <div className="text-xs text-gray-400 mt-0.5">🧪 + {t(bossResult.potionGranted.nameKey, locale)}</div>
                  )}
                </div>
              )}
              <div className="mt-2 max-h-24 overflow-y-auto font-mono text-[10px] text-gray-500 space-y-0.5">
                {bossResult.log.slice(-6).map((l: string, i: number) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

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