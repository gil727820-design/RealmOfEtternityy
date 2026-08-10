"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

export default function AfkPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [afk, setAfk] = useState<{ gold: number; xp: number; duration: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimResult, setClaimResult] = useState<Record<string, unknown> | null>(null);
  const [startingAFK, setStartingAFK] = useState(false);
  const [afkActive, setAfkActive] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.character) {
        setCharacter(data.character);
        // Check if afkSince is recent (started)
        const now = Date.now();
        const afkTime = new Date(data.character.afkSince).getTime();
        const diff = Math.floor((now - afkTime) / 1000);
        if (diff < 43200 && diff > 30) setAfkActive(true);
        else setAfkActive(false);
      }
      setAfk(data.afkRewards ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId, setCharacter]);

  useEffect(() => { load(); }, [load]);

  const startAFK = async () => {
    setStartingAFK(true);
    try {
      const res = await fetch("/api/afk/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.success) {
        setAfkActive(true);
        notify("💤 Modo AFK ativado! Suas recompensas acumularão enquanto você estiver offline.", "success");
        load();
      } else {
        notify(data.error, "error");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setStartingAFK(false);
  };

  const claim = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/afk/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.gold > 0 || data.xp > 0) {
        setClaimResult(data);
        setAfkActive(false);
        notify(`🎉 +${data.gold.toLocaleString()} 💰 +${data.xp.toLocaleString()} XP`, "success");
        load();
      } else {
        notify("⏰ Menos de 1 minuto acumulado. Aguarde mais!", "info");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setLoading(false);
  };

  const formatDuration = (sec: number) => {
    if (sec < 60) return "Menos de 1 min";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} minutos`;
  };

  if (loading && !afk) {
    return <div className="flex flex-col items-center justify-center py-20"><div className="spinner mb-4"></div></div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <img src="/images/sidebar/menu_afk.png" alt={t("afk.title", locale)} className="w-10 h-10 object-contain animate-float" />
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("afk.title", locale)}
          </span>
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {afkActive ? "🟢 Modo AFK ativo! Recompensas acumulando..." : "⚪ Modo AFK inativo"}
        </p>
      </div>

      {!afkActive ? (
        <div className="game-card p-8 text-center animate-bounceIn">
          <div className="text-7xl mb-4 animate-floatSlow">😴</div>
          <h3 className="text-xl font-bold text-white mb-3">Ativar Modo Descanso</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            Ao ativar, seu personagem continuará acumulando ouro e experiência mesmo offline.
            Volte depois para coletar!
          </p>
          <button onClick={startAFK} disabled={startingAFK}
            className="game-btn-gold game-btn text-lg px-10 py-4">
            {startingAFK ? (
              <span className="flex items-center gap-2"><span className="spinner w-5 h-5 border-2 border-[#1a1a2e]"></span> Ativando...</span>
            ) : (
              <span>💤 Descansar (Modo AFK)</span>
            )}
          </button>
        </div>
      ) : (
        <>
          {afk && afk.duration > 59 && (
            <div className="game-card game-card-glow p-6 text-center animate-fadeInUp">
              <div className="text-6xl mb-3">🌙</div>
              <h3 className="text-xl font-bold text-white mb-2">{t("afk.title", locale)}</h3>
              <div className="text-gray-400 text-sm mb-6">
                {t("afk.timeAway", locale)}: <span className="text-white font-bold">{formatDuration(afk.duration)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
                <div className="bg-gradient-to-br from-[#ffd700]/10 to-transparent rounded-xl p-4 border border-[#ffd700]/20">
                  <div className="text-sm text-gray-400">{t("afk.goldEarned", locale)}</div>
                  <div className="text-2xl font-black text-[#ffd700]">+{afk.gold.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-[#00ff88]/10 to-transparent rounded-xl p-4 border border-[#00ff88]/20">
                  <div className="text-sm text-gray-400">{t("afk.xpEarned", locale)}</div>
                  <div className="text-2xl font-black text-[#00ff88]">+{afk.xp.toLocaleString()}</div>
                </div>
              </div>

              {!claimResult ? (
                <button onClick={claim} className="game-btn-gold game-btn text-lg animate-pulse-glow px-10 py-3">
                  🎁 {t("afk.collect", locale)}
                </button>
              ) : (
                <div className="text-[#00ff88] font-bold text-lg animate-bounceIn">✅ Recompensas coletadas!</div>
              )}
            </div>
          )}

          {afk && afk.duration <= 59 && (
            <div className="game-card p-8 text-center">
              <div className="text-5xl mb-3">⏳</div>
              <p className="text-gray-400">Aguarde pelo menos 1 minuto para acumular recompensas.</p>
              <p className="text-gray-600 text-sm mt-2">Tempo atual: {formatDuration(afk.duration)}</p>
              <button onClick={claim} className="game-btn mt-4">🔄 Atualizar</button>
            </div>
          )}
        </>
      )}

      {claimResult && (
        <div className="game-card p-5 animate-fadeIn border-[#00ff88]/30">
          <h3 className="font-bold text-[#00ff88] mb-3 text-lg">🎉 Recompensas Coletadas</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-[#ffd700] flex items-center gap-1.5">+{Number(claimResult.gold).toLocaleString()} <img src="/images/icons/icone_moeda.png" alt="ouro" className="w-4 h-4 object-contain" /></span>
            <span className="text-[#00ff88]">+{Number(claimResult.xp).toLocaleString()} XP</span>
            {Boolean(claimResult.levelUp) && (
              <span className="text-[#a855f7]">🎊 Level Up! → {String(claimResult.newLevel)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
