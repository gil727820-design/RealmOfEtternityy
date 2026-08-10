"use client";
import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, REGIONS, regionWithAlpha, type ClassName } from "@/game/constants";
import { skinById } from "@/game/skins";
import { effectiveStats, skinBuffDesc } from "@/game/skinBuffs";
import StatHelpModal from "@/components/StatHelpModal";

export default function DashboardPanel() {
  const { character, locale, setTab, setCharacter, notify, characterId } = useGameStore();
  // Os hooks devem ser chamados SEMPRE na mesma ordem (antes de qualquer early return).
  const [allocating, setAllocating] = useState<string | null>(null);
  const [showStatHelp, setShowStatHelp] = useState(false);
  const energyRegenMsRef = useRef(0);
  const energyAtRef = useRef(Date.now());
  const energyRefetchedRef = useRef(false);
  const [, setEnergyTick] = useState(0);

  useEffect(() => {
    if (typeof (character as any)?.energyRegenMs === "number") energyRegenMsRef.current = (character as any).energyRegenMs;
    if (typeof (character as any)?._energyAt === "number") energyAtRef.current = (character as any)._energyAt;
  }, [character]);

  // Contador + refetch silencioso quando a próxima energia "cai".
  useEffect(() => {
    const interval = setInterval(async () => {
      const ms = energyRegenMsRef.current;
      const remaining = ms - (Date.now() - energyAtRef.current);
      if (ms > 0 && remaining <= 0 && !energyRefetchedRef.current) {
        energyRefetchedRef.current = true;
        try {
          if (characterId) {
            const res = await fetch(`/api/character/${characterId}`);
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
  // Stats efetivas (já incluem o buff da skin equipada, ex.: crítico + bônus).
  const eff = effectiveStats(c as any);
  // Avatar: usa a skin equipada se houver, senão a imagem padrão da classe.
  const avatarSrc =
    (() => {
      const sid = (c as any)?.activeSkinId;
      return sid ? skinById(String(sid))?.image : null;
    })() || classImage(cls, c.sex as string);
  const num = (v: unknown, fallback = 0) => typeof v === "number" ? v : fallback;
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

  const quickActions = [
    { icon: "/images/sidebar/menu_missoes.png", label: t("nav.missions", locale), tab: "missions" as const, color: "from-[#4ecdc4] to-[#44b8b0]" },
    { icon: "/images/sidebar/menu_torre.png", label: t("nav.tower", locale), tab: "tower" as const, color: "from-[#a855f7] to-[#9333ea]" },
    { icon: "/images/sidebar/menu_arena.png", label: t("nav.pvp", locale), tab: "pvp" as const, color: "from-[#ff6b6b] to-[#ee5a5a]" },
    { icon: "/images/sidebar/menu_afk.png", label: t("nav.afk", locale), tab: "afk" as const, color: "from-[#3b82f6] to-[#2563eb]" },
  ];

  const stats = [
    { image: "/images/attributes/attr_ataque.png", key: "stat.attack", val: eff.attack, color: "#ff6b6b" },
    { image: "/images/attributes/attr_defesa.png", key: "stat.defense", val: eff.defense, color: "#3b82f6" },
    { image: "/images/attributes/attr_velocidade.png", key: "stat.speed", val: eff.speed, color: "#4ecdc4" },
    { image: "/images/attributes/attr_critico.png", key: "stat.critical", val: `${eff.critical}%`, color: "#ffd700" },
    { image: "/images/attributes/attr_precisao.png", key: "stat.precision", val: eff.precision, color: "#a855f7" },
    { image: "/images/attributes/attr_esquiva.png", key: "stat.dodge", val: eff.dodge, color: "#ec4899" },
  ];

  // === Sistema de Status ===
  const pointsLeft = num(c.unspentStatPoints);

  const allocStats = [
    { stat: "attack", key: "stat.attack", image: "/images/attributes/attr_ataque.png", emoji: "", color: "#ff6b6b", perPoint: 2 },
    { stat: "defense", key: "stat.defense", image: "/images/attributes/attr_defesa.png", emoji: "", color: "#3b82f6", perPoint: 2 },
    { stat: "speed", key: "stat.speed", image: "/images/attributes/attr_velocidade.png", emoji: "", color: "#4ecdc4", perPoint: 2 },
    { stat: "hp", key: "stat.hp", image: "", emoji: "❤️", color: "#22c55e", perPoint: 10 },
    { stat: "mana", key: "stat.mana", image: "", emoji: "🔮", color: "#00d4ff", perPoint: 5 },
    { stat: "critical", key: "stat.critical", image: "/images/attributes/attr_critico.png", emoji: "", color: "#ffd700", perPoint: 1 },
    { stat: "precision", key: "stat.precision", image: "/images/attributes/attr_precisao.png", emoji: "", color: "#a855f7", perPoint: 1 },
    { stat: "dodge", key: "stat.dodge", image: "/images/attributes/attr_esquiva.png", emoji: "", color: "#ec4899", perPoint: 1 },
    { stat: "resistance", key: "stat.resistance", image: "/images/attributes/attr_resistencia.png", emoji: "", color: "#22c55e", perPoint: 1 },
  ];

  const allocatePoint = async (row: (typeof allocStats)[number]) => {
    if (pointsLeft <= 0 || !characterId || allocating) return;
    setAllocating(row.stat);
    try {
      const res = await fetch("/api/character/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, stat: row.stat, amount: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
        return;
      }
      if (data.character) setCharacter(data.character);
      notify(`+${String(row.perPoint)} ${t(row.key, locale)}!`, "success");
    } catch {
      notify("Erro ao distribuir status", "error");
    } finally {
      setAllocating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black">
          <span className="text-gray-400">{t("dash.welcome", locale)}, </span>
          <span className="bg-gradient-to-r from-[#ff6b6b] via-[#ffd700] to-[#4ecdc4] bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
            {c.name as string}
          </span>
          <span className="text-gray-400">!</span>
        </h2>
        <p className="text-gray-500 mt-1">{t("dash.ready", locale)}</p>
      </div>

      {/* Region Banner — topo, tema da ilha atual */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 animate-fadeInDown animate-gradient"
        style={{
          background: `linear-gradient(120deg, ${regionWithAlpha(currentRegion.accent, 0.16)}, rgba(17,17,39,0.55) 60%)`,
          backgroundSize: "200% 200%",
          border: `1px solid ${regionWithAlpha(currentRegion.accent, 0.35)}`,
          boxShadow: `0 0 24px ${regionWithAlpha(currentRegion.accent, 0.10)}`,
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <img
              src={currentRegion.image}
              alt={currentRegion.id}
              className="w-16 h-16 rounded-xl border border-white/15 object-cover"
              style={{ boxShadow: `0 0 16px ${regionWithAlpha(currentRegion.accent, 0.3)}` }}
            />
            <div>
              <div
                className="text-xs uppercase tracking-wider font-bold"
                style={{ color: currentRegion.accent }}
              >
                🗺️ {t("dash.currentRegion", locale)}
              </div>
              <div className="text-2xl font-black text-white">{t(`region.${currentRegion.id}`, locale)}</div>
              <div className="text-sm text-gray-400">{t(`region.${currentRegion.id}.desc`, locale)}</div>
            </div>
          </div>
          <button onClick={() => setTab("map")} className="game-btn-secondary game-btn text-sm">
            🗺️ {t("dash.viewMap", locale)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Character Card */}
        <div className="game-card game-card-glow p-6 animate-fadeInUp relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff6b6b]/10 to-transparent rounded-full blur-2xl" />
          
          <div className="relative text-center mb-6">
            <div className="relative inline-block">
              <img
                src={avatarSrc}
                alt={c.name as string}
                className="w-36 h-36 rounded-2xl border-2 border-[#ff6b6b]/40 object-cover shadow-[0_0_30px_rgba(255,107,107,0.35)] animate-float"
              />
            </div>
            <h3 className="text-2xl font-bold mt-3 text-white">{c.name as string}</h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-gray-400 text-sm">{t(`class.${cls}`, locale)}</span>
              <span className="text-gray-600">•</span>
              <span className="text-[#ffd700] text-sm font-bold">Lv.{String(c.level)}</span>
            </div>
            
            {/* Power Badge */}
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b6b]/20 to-[#ffd700]/20 border border-[#ff6b6b]/30">
              <span className="text-xl animate-pulse-soft">⭐</span>
              <span className="text-sm text-gray-400">{t("stat.power", locale)}:</span>
              <span className="text-xl font-black text-[#ffd700] glow-text">{num(c.power).toLocaleString()}</span>
            </div>
          </div>

          {/* Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1 text-gray-300">❤️ {t("stat.hp", locale)}</span>
                <span className="text-gray-400">{String(c.hp)}/{String(c.maxHp)}</span>
              </div>
              <div className="bar-container h-2.5">
                <div className="hp-bar h-2.5" style={{ width: `${hpPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1 text-gray-300">🔮 {t("stat.mana", locale)}</span>
                <span className="text-gray-400">{String(c.mana)}/{String(c.maxMana)}</span>
              </div>
              <div className="bar-container h-2.5">
                <div className="mana-bar h-2.5" style={{ width: `${manaPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1 text-gray-300">⚡ {t("stat.energy", locale)}</span>
                <span className="text-gray-400">{String(c.energy)}/{String(c.maxEnergy)}</span>
              </div>
              <div className="bar-container h-2.5">
                <div className="energy-bar h-2.5" style={{ width: `${energyPct}%` }} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {Number(c.energy) >= Number(c.maxEnergy) ? "⚡ Cheio" : "⏳ +1 ⚡ em " + energyFormat()}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1 text-gray-300">✨ XP</span>
                <span className="text-gray-400">{String(c.xp)}/{String(c.xpToNext)}</span>
              </div>
              <div className="bar-container h-2.5">
                <div className="xp-bar h-2.5" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
          
          {(c.unspentStatPoints as number) > 0 && (
            <div className="mt-4 text-center animate-pulse">
              <span className="text-[#00ff88] text-sm font-bold">
                ✨ +{String(c.unspentStatPoints)} {t("dash.points", locale)}!
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="game-card p-6 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t("dash.attributes", locale)}</span>
            <button
              onClick={() => setShowStatHelp(true)}
              title={t("statinfo.title", locale)}
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-base font-black text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 hover:text-white hover:scale-105 transition-all"
            >
              ❓
            </button>
          </h3>
          
          {(c.prestige as number) > 0 && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/30 animate-pulse-soft">
              <span className="text-xl">🌟</span>
              <span className="text-[#ffd700] font-bold">{t("stat.prestige", locale)}: {String(c.prestige)}</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s, i) => (
              <div 
                key={s.key} 
                className="stat-card animate-fadeIn"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="stat-icon" style={{ background: `${s.color}20` }}>
                  <img 
                    src={s.image} 
                    alt={t(s.key, locale)} 
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500">{t(s.key, locale)}</div>
                  <div className="text-lg font-bold text-white">{String(s.val)}</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Resistência extra */}
          <div className="stat-card mt-2 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
            <div className="stat-icon" style={{ background: "#22c55e20" }}>
              <img 
                src="/images/attributes/attr_resistencia.png" 
                alt={t("stat.resistance", locale)} 
                className="w-7 h-7 object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">{t("stat.resistance", locale)}</div>
              <div className="text-lg font-bold text-white">{String(c.resistance)}</div>
            </div>
          </div>

          {/* Skin ativa → buff que está valendo de verdade no personagem */}
          {eff.hasSkin && eff.buff && (
            <div className="mt-2 rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 p-3 animate-fadeIn" style={{ animationDelay: "0.35s" }}>
              <div className="flex items-center gap-2 text-xs font-black text-[#e94560] mb-1">
                <span className="text-sm">{eff.buff.icon}</span>
                {t("inv.skinEquipped", locale)}
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {skinBuffDesc((c as any)?.activeSkinId, locale)}
              </p>
            </div>
          )}
        </div>

        {/* Status Allocation */}
        <div className="game-card p-6 animate-fadeInUp" style={{ animationDelay: "0.15s" }}>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="bg-gradient-to-r from-[#00ff88] to-[#00d4aa] bg-clip-text text-transparent">{t("status.title", locale)}</span>
            <button
              onClick={() => setShowStatHelp(true)}
              title={t("statinfo.title", locale)}
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-base font-black text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 hover:text-white hover:scale-105 transition-all"
            >
              ❓
            </button>
            {pointsLeft > 0 && (
              <span className="ml-auto text-xs font-black px-3 py-1 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88] animate-pulse-soft">
                ✨ {String(pointsLeft)} {t("dash.points", locale)}
              </span>
            )}
          </h3>

          {pointsLeft <= 0 ? (
            <div className="text-sm text-gray-500 p-3 rounded-xl bg-white/5 border border-white/10 leading-relaxed">
              {t("status.noPoints", locale)}
            </div>
          ) : (
            <div className="space-y-2">
              {allocStats.map((row) => {
                const currentVal = num(c[row.stat]);
                return (
                  <div
                    key={row.stat}
                    className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="stat-icon" style={{ background: `${row.color}20` }}>
                      {row.image ? (
                        <img src={row.image} alt={t(row.key, locale)} className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="text-lg leading-none">{row.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        {t(row.key, locale)}
                        <span className="text-[10px] text-gray-600">+{String(row.perPoint)} {t("status.perPoint", locale)}</span>
                      </div>
                      <div className="text-base font-bold text-white">{String(currentVal)}</div>
                    </div>
                    <button
                      onClick={() => allocatePoint(row)}
                      disabled={allocating !== null || pointsLeft <= 0}
                      title={t("status.addPoint", locale)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-black text-white bg-gradient-to-br from-[#00ff88] to-[#00b37a] hover:brightness-110 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-[0_0_12px_rgba(0,255,136,0.25)]"
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Currency */}
        <div className="space-y-6">
          <div className="game-card p-6 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>🎮</span>
              {t("dash.quickActions", locale)}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a, i) => (
                <button 
                  key={a.tab} 
                  onClick={() => setTab(a.tab)} 
                  className={`relative overflow-hidden rounded-xl p-4 text-center border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:-translate-y-1 group animate-fadeIn`}
                  style={{ 
                    animationDelay: `${i * 0.05}s`,
                    background: `linear-gradient(135deg, ${a.color.split(" ")[0].replace("from-", "")}, ${a.color.split(" ")[1].replace("to-", "")})20`
                  }}
                >
                  <img 
                    src={a.icon} 
                    alt={a.label} 
                    className="w-12 h-12 mx-auto mb-2 object-contain group-hover:scale-110 group-hover:animate-bounceIn transition-transform"
                  />
                  <div className="text-sm font-semibold text-gray-200">{a.label}</div>
                  <div className={`absolute inset-0 bg-gradient-to-r ${a.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                </button>
              ))}
            </div>
          </div>

          <div className="game-card p-6 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="animate-float">💰</span>
              {t("dash.currencies", locale)}
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#ffd700]/10 border border-[#ffd700]/20">
                <span className="flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  <span className="text-gray-400 text-sm">{t("currency.gold", locale)}</span>
                </span>
                <span className="text-xl font-black text-[#ffd700]">{num(c.gold).toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20">
                <span className="flex items-center gap-2">
                  <span className="text-2xl">💎</span>
                  <span className="text-gray-400 text-sm">{t("currency.diamonds", locale)}</span>
                </span>
                <span className="text-xl font-black text-[#00d4ff]">{num(c.diamonds).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center p-2 rounded-lg bg-[#a855f7]/10">
                <div className="text-sm text-[#a855f7]">🔮 {num(c.crystals).toLocaleString()}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#ff6b6b]/10">
                <div className="text-sm text-[#ff6b6b]">⚔️ {num(c.pvpCoins).toLocaleString()}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#22c55e]/10">
                <div className="text-sm text-[#22c55e]">🏰 {num(c.guildCoins).toLocaleString()}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#4ecdc4]/10">
                <div className="text-sm text-[#4ecdc4]">🗼 {num(c.towerCoins).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Region Banner — movido para o topo (ver acima) */}

      {/* Guia de Status */}
      <StatHelpModal
        open={showStatHelp}
        onClose={() => setShowStatHelp(false)}
        locale={locale}
      />
    </div>
  );
}
