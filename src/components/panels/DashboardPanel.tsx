"use client";
import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, classStatCap, CLASS_LIST, CLASS_ICONS, CLASS_REPRESENTATIVE, REGIONS, regionWithAlpha, STAT_RESET_COST, type ClassName, type AllocStatKey } from "@/game/constants";
import { skinById } from "@/game/skins";
import { effectiveStats, skinBuffDesc } from "@/game/skinBuffs";
import StatHelpModal from "@/components/StatHelpModal";
import ClassChangeScreen from "@/components/admin/ClassChangeScreen";

export default function DashboardPanel() {
  const { character, locale, setTab, setCharacter, notify, characterId } = useGameStore();
  const [allocating, setAllocating] = useState<string | null>(null);
  const [showStatHelp, setShowStatHelp] = useState(false);
  const [allocQty, setAllocQty] = useState(1);
  const energyRegenMsRef = useRef(0);
  const energyAtRef = useRef(Date.now());
  const energyRefetchedRef = useRef(false);
  const [, setEnergyTick] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [changingClass, setChangingClass] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showClassChangeScreen, setShowClassChangeScreen] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(true);

  useEffect(() => {
    if (typeof (character as any)?.energyRegenMs === "number") energyRegenMsRef.current = (character as any).energyRegenMs;
    if (typeof (character as any)?._energyAt === "number") energyAtRef.current = (character as any)._energyAt;
  }, [character]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const ms = energyRegenMsRef.current;
      const remaining = ms - (Date.now() - energyAtRef.current);
      if (ms > 0 && remaining <= 0 && !energyRefetchedRef.current) {
        energyRefetchedRef.current = true;
        try {
          if (characterId) {
            const res = await fetch(`/api/character?id=${characterId}`);
            const data = await res.json();
            if (data?.character) setCharacter({ ...data.character, _energyAt: Date.now() });
          }
        } catch {}
      } else if (remaining > 0) {
        energyRefetchedRef.current = false;
      }
      setEnergyTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [characterId, setCharacter]);

  if (!character) return null;

  const c = character;
  const cls = (c.classType as ClassName) || "warrior";
  const eff = effectiveStats(c as any);
  const avatarSrc =
    (() => {
      const sid = (c as any)?.activeSkinId;
      return sid ? skinById(String(sid))?.image : null;
    })() || classImage(cls, c.sex as string);
  const num = (v: unknown, fallback = 0) => typeof v === "number" ? v : fallback;
  const fmtNum = (v: unknown): string => {
    const n = Number(v) || 0;
    if (!Number.isFinite(n)) return String(v);
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
    return Math.floor(n).toString();
  };
  const energyFormat = () => {
    const ms = energyRegenMsRef.current;
    const remainingMs = Math.max(0, ms - (Date.now() - energyAtRef.current));
    const sec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + s.toString().padStart(2, "0");
  };
  const xpPct = Math.min(100, (num(c.xp) / Math.max(1, num(c.xpToNext, 100))) * 100);
  const hpPct = Math.min(100, (num(c.hp) / Math.max(1, num(c.maxHp))) * 100);
  const manaPct = Math.min(100, (num(c.mana) / Math.max(1, num(c.maxMana))) * 100);
  const energyPct = Math.min(100, (num(c.energy) / Math.max(1, num(c.maxEnergy))) * 100);
  const currentRegion = REGIONS.find((r) => r.id === c.currentRegion) || REGIONS[0];

  // XP Ring calculation (circle progress)
  const levelProgress = xpPct;
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (levelProgress / 100) * ringCircumference;

  const quickActions = [
    { icon: "/images/sidebar/menu_missoes.png", label: t("nav.missions", locale), tab: "missions" as const, color: "#4ecdc4", emoji: "📜" },
    { icon: "/images/sidebar/menu_torre.png", label: t("nav.tower", locale), tab: "tower" as const, color: "#a855f7", emoji: "🗼" },
    { icon: "/images/sidebar/menu_arena.png", label: t("nav.pvp", locale), tab: "pvp" as const, color: "#ff6b6b", emoji: "⚔️" },
    { icon: "/images/sidebar/menu_afk.png", label: t("nav.afk", locale), tab: "afk" as const, color: "#3b82f6", emoji: "💤" },
    { icon: "/images/sidebar/menu_inventario.png", label: t("nav.inventory", locale), tab: "inventory" as const, color: "#ffd700", emoji: "🎒" },
    { icon: "/images/sidebar/menu_mapa.png", label: t("nav.map", locale), tab: "map" as const, color: "#22c55e", emoji: "🗺️" },
  ];

  // Radar chart data — normalizado para 0–100 com mínimo visual de 12%
  // para que o polígono sempre tenha forma interessante.
  const radarStats = [
    { label: t("stat.attack", locale), value: Math.max(12, Math.min(100, (eff.attack / 200) * 100)), raw: eff.attack, color: "#ff6b6b" },
    { label: t("stat.defense", locale), value: Math.max(12, Math.min(100, (eff.defense / 200) * 100)), raw: eff.defense, color: "#3b82f6" },
    { label: t("stat.speed", locale), value: Math.max(12, Math.min(100, (eff.speed / 100) * 100)), raw: eff.speed, color: "#4ecdc4" },
    { label: t("stat.critical", locale), value: Math.max(12, Math.min(100, eff.critical)), raw: eff.critical, color: "#ffd700" },
    { label: t("stat.precision", locale), value: Math.max(12, Math.min(100, (eff.precision / 50) * 100)), raw: eff.precision, color: "#a855f7" },
    { label: t("stat.dodge", locale), value: Math.max(12, Math.min(100, (eff.dodge / 50) * 100)), raw: eff.dodge, color: "#ec4899" },
  ];

  const radarPoints = radarStats.map((s, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    const r = (s.value / 100) * 42;
    return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
  });

  const stats = [
    { image: "/images/attributes/attr_ataque.png", key: "stat.attack", val: eff.attack, color: "#ff6b6b", icon: "⚔️", label: t("stat.attack", locale) },
    { image: "/images/attributes/attr_defesa.png", key: "stat.defense", val: eff.defense, color: "#3b82f6", icon: "🛡️", label: t("stat.defense", locale) },
    { image: "/images/attributes/attr_velocidade.png", key: "stat.speed", val: eff.speed, color: "#4ecdc4", icon: "💨", label: t("stat.speed", locale) },
    { image: "/images/attributes/attr_critico.png", key: "stat.critical", val: `${eff.critical}%`, color: "#ffd700", icon: "💥", label: t("stat.critical", locale) },
    { image: "/images/attributes/attr_precisao.png", key: "stat.precision", val: eff.precision, color: "#a855f7", icon: "🎯", label: t("stat.precision", locale) },
    { image: "/images/attributes/attr_esquiva.png", key: "stat.dodge", val: eff.dodge, color: "#ec4899", icon: "💨", label: t("stat.dodge", locale) },
  ];

  const pointsLeft = num(c.unspentStatPoints);

  const allocStats = [
    { stat: "attack", key: "stat.attack", image: "/images/attributes/attr_ataque.png", emoji: "", color: "#ff6b6b", perPoint: 2 },
    { stat: "defense", key: "stat.defense", image: "/images/attributes/attr_defesa.png", emoji: "", color: "#3b82f6", perPoint: 2 },
    { stat: "speed", key: "stat.speed", image: "/images/attributes/attr_velocidade.png", emoji: "", color: "#4ecdc4", perPoint: 2 },
    { stat: "hp", key: "stat.hp", image: "", emoji: "❤️", color: "#22c55e", perPoint: 10 },
    { stat: "mana", key: "stat.mana", image: "", emoji: "🔮", color: "#00d4ff", perPoint: 5 },
    { stat: "critical", key: "stat.critical", image: "/images/attributes/attr_critico.png", emoji: "", color: "#ffd700", perPoint: 1, cap: 90 },
    { stat: "precision", key: "stat.precision", image: "/images/attributes/attr_precisao.png", emoji: "", color: "#a855f7", perPoint: 1 },
    { stat: "dodge", key: "stat.dodge", image: "/images/attributes/attr_esquiva.png", emoji: "", color: "#ec4899", perPoint: 1, cap: 50 },
    { stat: "resistance", key: "stat.resistance", image: "/images/attributes/attr_resistencia.png", emoji: "", color: "#22c55e", perPoint: 1 },
  ];

  const allocatePoint = async (row: (typeof allocStats)[number], qtyOverride?: number) => {
    if (pointsLeft <= 0 || !characterId || allocating) return;
    const amount = Math.max(1, Math.min(qtyOverride ?? allocQty, pointsLeft));
    setAllocating(row.stat);
    try {
      const res = await fetch("/api/character?action=allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, stat: row.stat, amount }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Erro", "error"); return; }
      if (data.character) setCharacter(data.character);
      notify(`+${String(data.added ?? row.perPoint * amount)} ${t(row.key, locale)}!`, "success");
    } catch {
      notify("Erro ao distribuir status", "error");
    } finally {
      setAllocating(null);
    }
  };

  const investedBase = (row: (typeof allocStats)[number]) => {
    const baseStats = (c as any)?.baseStats as Record<string, number> | undefined;
    const map: Record<string, string> = { attack: "attack", defense: "defense", speed: "speed", hp: "maxHp", critical: "critical" };
    if (baseStats && map[row.stat]) return num(baseStats[map[row.stat]]);
    if (row.stat === "mana") return num(c.maxMana);
    return num(c[row.stat]);
  };

  const resetAttributes = async () => {
    if (resetting || !characterId) return;
    const confirmMsg = t("dash.resetStatsConfirm", locale).replace(
      "{cost}",
      STAT_RESET_COST.toLocaleString(locale === "en" ? "en-US" : "pt-BR")
    );
    if (!window.confirm(confirmMsg)) return;
    setResetting(true);
    try {
      const res = await fetch("/api/character?action=reset-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Erro ao resetar atributos", "error"); return; }
      if (data.character) setCharacter(data.character);
      notify(data.message || t("dash.resetStatsDone", locale), "success");
    } catch {
      notify("Erro ao resetar atributos", "error");
    } finally {
      setResetting(false);
    }
  };

  /** Trocar classe base do personagem (cobra ouro). */
  const changeClass = async (newClassType: string) => {
    if (changingClass || !characterId) return;
    const level = Math.max(1, Number(c.level) || 1);
    const cost = 5000 + level * 100;
    const currentGold = Number(c.gold) || 0;
    const currentClass = String(c.classType || "warrior");

    if (newClassType === currentClass) {
      notify("Você já é dessa classe!", "error");
      return;
    }

    if (currentGold < cost) {
      notify(`Ouro insuficiente! Necessário: ${cost.toLocaleString("pt-BR")} 💰`, "error");
      return;
    }

    const confirmMsg = `🔄 Trocar de ${currentClass} para ${newClassType}?\n\nCusto: ${cost.toLocaleString("pt-BR")} 💰\n\n⚠️ Stats voltam ao padrão da nova classe e pontos de atributo são devolvidos!`;
    if (!window.confirm(confirmMsg)) return;

    setChangingClass(true);
    try {
      const res = await fetch("/api/character?action=change-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, newClassType }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Erro ao trocar classe", "error"); return; }
      if (data.character) setCharacter(data.character);
      notify(data.message || `🔄 Classe trocada para ${newClassType}!`, "success");
      setShowClassModal(false);
    } catch {
      notify("Erro ao trocar classe", "error");
    } finally {
      setChangingClass(false);
    }
  };

  const classChangeCost = 5000 + (Math.max(1, Number(c.level) || 1) * 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="animate-fadeInDown px-1">
        <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-wide">
          <span className="text-gray-400">{t("dash.welcome", locale)}, </span>
          <span className="gradient-text">
            {c.name as string}
          </span>
          <span className="text-gray-400">!</span>
        </h2>
        <p className="text-gray-500 mt-1">{t("dash.ready", locale)}</p>
      </div>

      {/* Region Banner */}
      <div
        className="relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 animate-fadeInDown"
        style={{
          background: `linear-gradient(120deg, ${regionWithAlpha(currentRegion.accent, 0.16)}, rgba(17,17,39,0.55) 60%)`,
          border: `1px solid ${regionWithAlpha(currentRegion.accent, 0.35)}`,
          boxShadow: `0 0 24px ${regionWithAlpha(currentRegion.accent, 0.10)}`,
        }}
      >
        <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={currentRegion.image}
              alt={currentRegion.id}
              className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-lg sm:rounded-xl border border-white/15 object-cover"
              style={{ boxShadow: `0 0 16px ${regionWithAlpha(currentRegion.accent, 0.3)}` }}
            />
            <div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold" style={{ color: currentRegion.accent }}>
                🗺️ {t("dash.currentRegion", locale)}
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-black text-white">{t(`region.${currentRegion.id}`, locale)}</div>
              <div className="text-[11px] sm:text-sm text-gray-400 hidden sm:block">{t(`region.${currentRegion.id}.desc`, locale)}</div>
            </div>
          </div>
          <button onClick={() => setTab("map")} className="game-btn-secondary game-btn text-xs sm:text-sm">
            🗺️ {t("dash.viewMap", locale)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* ═══════════════════════════════════════════════════════════
            CHARACTER CARD — Hero section with XP ring + avatar
            ═══════════════════════════════════════════════════════════ */}
        <div className="game-card game-card-glow p-4 sm:p-5 lg:p-6 animate-fadeInUp relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#d4a843]/8 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#a855f7]/6 to-transparent rounded-full blur-3xl" />

          <div className="relative text-center mb-5">
            {/* XP Progress Ring + Avatar */}
            <div className="relative inline-block mb-3">
              <svg className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] lg:w-[160px] lg:h-[160px] -rotate-90" viewBox="0 0 120 120">
                {/* Background ring */}
                <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                {/* XP progress ring */}
                <circle
                  cx="60" cy="60" r={ringRadius} fill="none"
                  stroke="url(#xpGradient)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={ringCircumference} strokeDashoffset={ringOffset}
                  className="transition-all duration-700 ease-out"
                />
                {/* Glow filter */}
                <defs>
                  <linearGradient id="xpGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00ff88" />
                    <stop offset="50%" stopColor="#00d4aa" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <filter id="ringGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
              </svg>
              {/* Avatar inside ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={avatarSrc}
                  alt={c.name as string}
                  className="w-[80px] h-[80px] sm:w-[95px] sm:h-[95px] lg:w-[110px] lg:h-[110px] rounded-full border-3 border-[#ff6b6b]/60 object-cover shadow-[0_0_35px_rgba(255,107,107,0.45)] animate-float"
                />
              </div>
              {/* Level badge on ring */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#0a0a12] border border-[#00ff88]/40 shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                <span className="text-[10px] sm:text-xs font-black text-[#00ff88]">Lv.{String(c.level)}</span>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{c.name as string}</h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-gray-400 text-xs sm:text-sm">{t(`class.${cls}`, locale)}</span>
              <span className="text-gray-600">•</span>
              <span className="text-[#ffd700] text-xs sm:text-sm font-bold">{c.sex === "male" ? "♂️" : "♀️"}</span>
            </div>

            {/* Power Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 mt-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-[#ff6b6b]/15 to-[#ffd700]/15 border border-[#ff6b6b]/30 hover:border-[#ffd700]/50 transition-all hover:scale-105 cursor-default">
              <span className="text-lg sm:text-xl animate-pulse-soft">⭐</span>
              <span className="text-[10px] sm:text-xs text-gray-400">{t("stat.power", locale)}</span>
              <span className="text-base sm:text-lg lg:text-xl font-black text-[#ffd700] glow-text">{num(c.power).toLocaleString()}</span>
            </div>
          </div>

          {/* Bars */}
          <div className="space-y-2.5 sm:space-y-3">
            <StatBar emoji="❤️" label={t("stat.hp", locale)} current={c.hp} max={c.maxHp} pct={hpPct} barClass="hp-bar" />
            <StatBar emoji="🔮" label={t("stat.mana", locale)} current={c.mana} max={c.maxMana} pct={manaPct} barClass="mana-bar" />
            <div>
              <div className="flex justify-between text-[10px] sm:text-xs mb-1.5">
                <span className="flex items-center gap-1 text-gray-300">⚡ {t("stat.energy", locale)}</span>
                <span className="text-gray-400">{String(c.energy)}/{String(c.maxEnergy)}</span>
              </div>
              <div className="bar-container h-2 sm:h-2.5">
                <div className="energy-bar h-2 sm:h-2.5 transition-all duration-500" style={{ width: `${energyPct}%` }} />
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">
                {Number(c.energy) >= Number(c.maxEnergy) ? "⚡ Cheio!" : "⏳ +1 ⚡ em " + energyFormat()}
              </div>
            </div>
            <StatBar emoji="✨" label="XP" current={fmtNum(c.xp)} max={fmtNum(c.xpToNext)} pct={xpPct} barClass="xp-bar" />
          </div>

          {/* Point notifications */}
          <div className="mt-3 sm:mt-4 space-y-2">
            {(c.unspentStatPoints as number) > 0 && (
              <button onClick={() => {}} className="w-full text-center animate-pulse cursor-default">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-[11px] sm:text-xs font-bold">
                  ✨ +{String(c.unspentStatPoints)} {t("dash.points", locale)}
                </span>
              </button>
            )}
            {(c.skillPoints as number) > 0 && (
              <button onClick={() => setTab("skills")} className="w-full text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] text-[11px] sm:text-xs font-bold hover:bg-[#a855f7]/20 transition touch-target">
                  🌳 +{String(c.skillPoints)} {t("skill.points", locale)} — {t("skill.title", locale)}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            STATS CARD — Radar chart + attribute grid
            ═══════════════════════════════════════════════════════════ */}
        <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
          <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                      <span className="text-xl sm:text-2xl">📊</span>
                      <span className="gradient-text">{t("dash.attributes", locale)}</span>
            <button
              onClick={() => setShowStatHelp(true)}
              title={t("statinfo.title", locale)}
              className="ml-auto w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-base font-black text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 hover:text-white hover:scale-110 transition-all"
            >
              ❓
            </button>
          </h3>

          {/* Prestige badge */}
          {(c.prestige as number) > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/30 animate-pulse-soft">
              <span className="text-lg">🌟</span>
              <span className="text-[#ffd700] font-bold text-xs sm:text-sm">{t("stat.prestige", locale)}: {String(c.prestige)}</span>
            </div>
          )}

          {/* Prestige button */}
          {(c.level as number) >= 999 && (
            <button
              onClick={() => {
                if (!window.confirm(t("prestige.confirm", locale).replace("{n}", String(c.prestige || 0)).replace("{n2}", String((Number(c.prestige) || 0) + 1)))) return;
                fetch("/api/character?action=prestige", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ characterId: c.id }),
                })
                  .then((r) => r.json())
                  .then((d) => {
                    if (!d.success) { notify(d.error || t("general.error", locale), "error"); return; }
                    notify(d.message || "🌟 Renasceu!", "success");
                    if (d.character) setCharacter(d.character);
                  })
                  .catch(() => notify(t("general.error", locale), "error"));
              }}
              className="mb-3 w-full rounded-xl border border-[#ffd700]/50 bg-gradient-to-r from-[#ffd700]/15 to-[#f59e0b]/10 px-4 py-2.5 text-xs sm:text-sm font-black text-[#ffd700] hover:bg-[#ffd700]/20 transition-all hover:scale-[1.02] active:scale-[0.98] touch-target"
            >
              🌟 {t("prestige.btn", locale)}
            </button>
          )}

          {/* Radar Chart Toggle */}
          <button
            onClick={() => setShowRadar(!showRadar)}
            className="w-full mb-3 text-[10px] sm:text-[11px] text-gray-500 hover:text-gray-300 transition flex items-center justify-center gap-1"
          >
            {showRadar ? "📊 Ocultar Radar" : "📊 Mostrar Radar"} 
            <span className="text-[8px]">{showRadar ? "▲" : "▼"}</span>
          </button>

          {/* Radar Chart — redesigned: always visually rich */}
          {showRadar && (
            <div className="mb-4 flex justify-center">
              <div className="relative w-[200px] h-[200px] sm:w-[230px] sm:h-[230px]">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(233,69,96,0.15)]">
                  <defs>
                    {/* Polígono: gradiente animado */}
                    <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(233,69,96,0.3)" />
                      <stop offset="50%" stopColor="rgba(168,85,247,0.2)" />
                      <stop offset="100%" stopColor="rgba(59,130,246,0.25)" />
                    </linearGradient>
                    <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff6b6b" />
                      <stop offset="50%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    {/* Glow para cada ponto */}
                    {radarStats.map((s, i) => (
                      <filter key={`glow-${i}`} id={`glow-${i}`} x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feFlood floodColor={s.color} floodOpacity="0.6" />
                        <feComposite in2="blur" operator="in" />
                        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    ))}
                  </defs>

                  {/* Círculos de grade — com valor visível */}
                  {[25, 50, 75, 100].map((pct, idx) => (
                    <circle key={pct} cx="50" cy="50" r={pct * 0.42}
                      fill="none"
                      stroke={`rgba(255,255,255,${idx === 0 ? 0.03 : 0.05})`}
                      strokeWidth="0.3"
                      strokeDasharray={idx % 2 === 0 ? "none" : "1 1"}
                    />
                  ))}

                  {/* Linhas radiais */}
                  {radarStats.map((s, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    return (
                      <line key={i}
                        x1="50" y1="50"
                        x2={50 + 42 * Math.cos(angle)}
                        y2={50 + 42 * Math.sin(angle)}
                        stroke={hoveredStat === s.label ? `${s.color}40` : "rgba(255,255,255,0.06)"}
                        strokeWidth={hoveredStat === s.label ? "0.8" : "0.4"}
                        className="transition-all duration-300"
                      />
                    );
                  })}

                  {/* Polígono de dados com glow */}
                  <polygon
                    points={radarPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="url(#radarFill)"
                    stroke="url(#radarStroke)"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                    className="transition-all duration-700 ease-out"
                  />

                  {/* Segundo polígono (contorno brilhante sutil) */}
                  <polygon
                    points={radarPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                    className="transition-all duration-700"
                  />

                  {/* Pontos de dados com glow */}
                  {radarPoints.map((p, i) => (
                    <g key={i} filter={`url(#glow-${i})`}>
                      <circle cx={p.x} cy={p.y} r="2.5" fill={radarStats[i].color}
                        className="transition-all duration-700" />
                      <circle cx={p.x} cy={p.y} r="1" fill="white" opacity="0.8"
                        className="transition-all duration-700" />
                    </g>
                  ))}

                  {/* Centro brilhante */}
                  <circle cx="50" cy="50" r="1.5" fill="rgba(255,255,255,0.15)" />
                  <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.3)" />
                </svg>

                {/* Labels ao redor — com valor numérico */}
                {radarStats.map((s, i) => {
                  const angle = (i * 60 - 90) * (Math.PI / 180);
                  const lx = 50 + 56 * Math.cos(angle);
                  const ly = 50 + 56 * Math.sin(angle);
                  const isActive = hoveredStat === s.label;
                  return (
                    <div
                      key={s.label}
                      className="absolute text-center pointer-events-none select-none"
                      style={{
                        left: `${lx}%`,
                        top: `${ly}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="text-[7px] sm:text-[8px] font-bold transition-colors duration-200"
                        style={{ color: isActive ? s.color : "rgba(255,255,255,0.4)" }}>
                        {s.label}
                      </div>
                      <div className="text-[8px] sm:text-[9px] font-black transition-colors duration-200"
                        style={{ color: isActive ? s.color : "rgba(255,255,255,0.6)" }}>
                        {s.raw}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {stats.map((s, i) => (
              <div
                key={s.key}
                className="stat-card animate-fadeIn p-1.5 sm:p-2.5 hover:border-white/25 transition-all cursor-default group"
                style={{ animationDelay: `${i * 0.05}s` }}
                onMouseEnter={() => setHoveredStat(s.label)}
                onMouseLeave={() => setHoveredStat(null)}
              >
                <div className="stat-icon group-hover:scale-110 transition-transform" style={{ background: `${s.color}20` }}>
                  <img src={s.image} alt={t(s.key, locale)} className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">{t(s.key, locale)}</div>
                  <div className="text-sm sm:text-base lg:text-lg font-bold text-white group-hover:text-[color:var(--stat-color)] transition-colors" style={{ "--stat-color": s.color } as any}>{String(s.val)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Resistance */}
          <div className="stat-card mt-2 animate-fadeIn p-1.5 sm:p-2.5 hover:border-white/25 transition-all cursor-default">
            <div className="stat-icon" style={{ background: "#22c55e20" }}>
              <img src="/images/attributes/attr_resistencia.png" alt={t("stat.resistance", locale)} className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] sm:text-xs text-gray-500">{t("stat.resistance", locale)}</div>
              <div className="text-sm sm:text-base lg:text-lg font-bold text-white">{String(c.resistance)}</div>
            </div>
          </div>

          {/* Skin buff */}
          {eff.hasSkin && eff.buff && (
            <div className="mt-2 rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 p-2.5 sm:p-3 animate-fadeIn hover:border-[#e94560]/60 transition-all">
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-[#e94560] mb-1">
                <span className="text-sm">{eff.buff.icon}</span>
                {t("inv.skinEquipped", locale)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-300 leading-relaxed">
                {skinBuffDesc((c as any)?.activeSkinId, locale)}
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            STAT ALLOCATION — Interactive point distribution
            ═══════════════════════════════════════════════════════════ */}
        <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp" style={{ animationDelay: "0.15s" }}>
          <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                      <span className="text-xl sm:text-2xl">🎯</span>
                      <span className="gradient-text">{t("status.title", locale)}</span>
            <button
              onClick={() => setShowStatHelp(true)}
              title={t("statinfo.title", locale)}
              className="ml-auto w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-base font-black text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 hover:text-white hover:scale-110 transition-all"
            >
              ❓
            </button>
            {pointsLeft > 0 && (
              <span className="ml-auto text-[10px] sm:text-xs font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88] animate-pulse-soft">
                ✨ {String(pointsLeft)} {t("dash.points", locale)}
              </span>
            )}
          </h3>

          {pointsLeft <= 0 ? (
            <div className="text-xs sm:text-sm text-gray-500 p-3 rounded-xl bg-white/5 border border-white/10 leading-relaxed">
              {t("status.noPoints", locale)}
            </div>
          ) : (
            <>
              {/* Quantity selector */}
              <div className="mb-3 flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-[#00ff88]/5 border border-[#00ff88]/20">
                <span className="text-[10px] sm:text-xs text-gray-400 font-bold whitespace-nowrap">{t("dash.allocQty", locale)}</span>
                <input
                  type="number"
                  min={1}
                  max={pointsLeft}
                  value={allocQty}
                  onChange={(e) => setAllocQty(Math.max(1, Math.min(pointsLeft, Math.floor(Number(e.target.value) || 1))))}
                  className="w-16 sm:w-20 bg-[#0a0a12] border border-[#00ff88]/30 rounded-lg px-2 py-1 sm:py-1.5 text-center text-white text-xs sm:text-sm font-black focus:outline-none focus:border-[#00ff88]"
                />
                <span className="text-[9px] sm:text-[10px] text-gray-500">{t("dash.allocMax", locale)} {String(pointsLeft)}</span>
                <button
                  onClick={() => setAllocQty(pointsLeft)}
                  className="ml-auto text-[10px] sm:text-[11px] font-black text-[#00ff88] hover:underline"
                >
                  {t("dash.allocAll", locale)}
                </button>
              </div>

              {/* Stat rows */}
              <div className="space-y-1 sm:space-y-1.5">
                {allocStats.map((row) => {
                  const currentVal = num(c[row.stat]);
                  const classCap = classStatCap(cls, row.stat as AllocStatKey);
                  const cap = classCap ?? (row as any).cap ?? undefined;
                  const invested = investedBase(row);
                  const atCap = cap !== undefined && invested >= cap;
                  return (
                    <div
                      key={row.stat}
                      className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all group"
                    >
                      <div className="stat-icon w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" style={{ background: `${row.color}20` }}>
                        {row.image ? (
                          <img src={row.image} alt={t(row.key, locale)} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                        ) : (
                          <span className="text-sm sm:text-base leading-none">{row.emoji}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1.5">
                          <span className="truncate">{t(row.key, locale)}</span>
                          <span className="text-[9px] sm:text-[10px] text-gray-600 whitespace-nowrap">+{String(row.perPoint)}</span>
                          {cap !== undefined && (
                            <span className="text-[9px] sm:text-[10px] text-[#ffd700]/80 whitespace-nowrap">/{String(cap)}</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-white">{String(currentVal)}</div>
                      </div>
                      <button
                        onClick={() => allocatePoint(row, allocQty)}
                        disabled={allocating !== null || pointsLeft <= 0 || atCap}
                        title={t("status.addPoint", locale)}
                        className="min-w-[32px] sm:min-w-[36px] h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-black text-white bg-gradient-to-br from-[#00ff88] to-[#00b37a] hover:brightness-110 hover:scale-105 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-[0_0_8px_rgba(0,255,136,0.2)]"
                      >
                        +{String(allocQty)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Reset button */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between gap-2 sm:gap-3">
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <span>🔄</span> {t("dash.resetStats", locale)}
              </div>
              <div className="text-[9px] sm:text-[11px] text-gray-500">💰 {t("dash.resetStatsCost", locale)}</div>
            </div>
            <button
              onClick={resetAttributes}
              disabled={resetting || num(c.gold) < STAT_RESET_COST}
              title={num(c.gold) < STAT_RESET_COST ? t("dash.resetStatsNoGold", locale) : t("dash.resetStats", locale)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-black transition-all border active:scale-95 ${
                num(c.gold) < STAT_RESET_COST
                  ? "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-[#ffd700] to-[#ff8c00] text-black hover:brightness-110 hover:scale-105 shadow-[0_0_12px_rgba(255,215,0,0.3)]"
              }`}
            >
              {resetting ? t("general.loading", locale) : t("dash.resetStatsBtn", locale)}
            </button>
          </div>
        </div>        {/* ═══════════════════════════════════════════════════════════
            CHANGE CLASS — Trocar classe base (cobra ouro)
            ═══════════════════════════════════════════════════════════ */}
        {!showClassChangeScreen ? (
          <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp" style={{ animationDelay: "0.18s" }}>
            <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">🔄</span>
              <span className="gradient-text">Trocar Classe</span>
            </h3>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div>
                <div className="text-xs sm:text-sm text-gray-300 font-bold flex items-center gap-2">
                  <img src={CLASS_REPRESENTATIVE[(c.classType as ClassName) || "warrior"]} alt="" className="w-6 h-6 rounded object-cover" />
                  <span>Classe atual: <span className="text-white capitalize">{String(c.classType)}</span></span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1">
                  Custo: {classChangeCost.toLocaleString("pt-BR")} 💰 • Stats resetam para padrão da nova classe
                </div>
              </div>
              <button
                onClick={() => setShowClassChangeScreen(true)}
                disabled={changingClass || num(c.gold) < classChangeCost}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-black transition-all border active:scale-95 ${
                  num(c.gold) < classChangeCost
                    ? "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-br from-[#ff9500] to-[#ff6b00] text-black hover:brightness-110 hover:scale-105 shadow-[0_0_12px_rgba(255,149,0,0.3)]"
                }`}>
                🔄 Trocar
              </button>
            </div>
          </div>
        ) : (
          <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp">
            <ClassChangeScreen
              currentClass={(c.classType as ClassName) || "warrior"}
              cost={classChangeCost}
              gold={num(c.gold)}
              locale={locale}
              onSelect={(newClass) => changeClass(newClass)}
              onBack={() => setShowClassChangeScreen(false)}
              changing={changingClass}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            QUICK ACTIONS + CURRENCIES
            ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Actions */}
          <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-sm sm:text-base lg:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-base sm:text-lg">🎮</span>
              {t("dash.quickActions", locale)}
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {quickActions.map((a, i) => (
                <button
                  key={a.tab}
                  onClick={() => setTab(a.tab)}
                  className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 text-center border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 group animate-fadeIn touch-target active:scale-95"
                  style={{
                    animationDelay: `${i * 0.04}s`,
                    background: `linear-gradient(135deg, ${a.color}12, ${a.color}08)`,
                  }}
                >
                  <div className="text-xl sm:text-2xl mb-1 group-hover:scale-110 group-hover:animate-bounceIn transition-transform">
                    {a.emoji}
                  </div>
                  <div className="text-[9px] sm:text-[10px] lg:text-xs font-semibold text-gray-200 truncate">{a.label}</div>
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(circle at center, ${a.color}15, transparent 70%)` }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Currencies */}
          <div className="game-card p-4 sm:p-5 lg:p-6 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
            <h3 className="text-sm sm:text-base lg:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="animate-float text-base sm:text-lg">💰</span>
              {t("dash.currencies", locale)}
            </h3>

            <div className="space-y-2">
              <CurrencyRow emoji="💰" label={t("currency.gold", locale)} value={num(c.gold)} color="#ffd700" bg="bg-[#ffd700]/10" border="border-[#ffd700]/20" />
              <CurrencyRow emoji="💎" label={t("currency.diamonds", locale)} value={num(c.diamonds)} color="#00d4ff" bg="bg-[#00d4ff]/10" border="border-[#00d4ff]/20" />
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-2.5 sm:mt-3">
              <MiniCurrency emoji="🔮" value={num(c.crystals)} color="#a855f7" />
              <MiniCurrency emoji="⚔️" value={num(c.pvpCoins)} color="#ff6b6b" />
              <MiniCurrency emoji="🏰" value={num(c.guildCoins)} color="#22c55e" />
              <MiniCurrency emoji="🗼" value={num(c.towerCoins)} color="#4ecdc4" />
            </div>
          </div>
        </div>
      </div>

      <StatHelpModal open={showStatHelp} onClose={() => setShowStatHelp(false)} locale={locale} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function StatBar({ emoji, label, current, max, pct, barClass }: {
  emoji: string; label: string; current: unknown; max: unknown; pct: number; barClass: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] sm:text-xs mb-1.5">
        <span className="flex items-center gap-1 text-gray-300">{emoji} {label}</span>
        <span className="text-gray-400">{String(current)}/{String(max)}</span>
      </div>
      <div className="bar-container h-2 sm:h-2.5">
        <div className={`${barClass} h-2 sm:h-2.5 transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CurrencyRow({ emoji, label, value, color, bg, border }: {
  emoji: string; label: string; value: number; color: string; bg: string; border: string;
}) {
  return (
    <div className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl ${bg} border ${border} hover:scale-[1.01] transition-all cursor-default`}>
      <span className="flex items-center gap-2">
        <span className="text-xl sm:text-2xl">{emoji}</span>
        <span className="text-gray-400 text-xs sm:text-sm">{label}</span>
      </span>
      <span className="text-base sm:text-lg lg:text-xl font-black" style={{ color }}>{value.toLocaleString()}</span>
    </div>
  );
}

function MiniCurrency({ emoji, value, color }: { emoji: string; value: number; color: string }) {
  return (
    <div className="text-center p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all cursor-default">
      <div className="text-[10px] sm:text-xs sm:text-sm" style={{ color }}>{emoji} {value.toLocaleString()}</div>
    </div>
  );
}
