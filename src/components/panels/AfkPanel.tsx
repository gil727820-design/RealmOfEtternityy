"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

const AFK_MAX_SEC = 43200; // 12h — máximo acumulado (cap do servidor)

interface AfkPreview {
  gold: number;
  xp: number;
  duration: number;
  goldPerMin: number;
  xpPerMin: number;
}

export default function AfkPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [afk, setAfk] = useState<AfkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimResult, setClaimResult] = useState<Record<string, unknown> | null>(null);
  const [startingAFK, setStartingAFK] = useState(false);
  const [collecting, setCollecting] = useState(false);
  // Tem sessão ativa (afkSince setado). Após coletar, o servidor zera → false.
  const [hasSession, setHasSession] = useState(false);
  const [, setTick] = useState(0); // força re-render a cada 1s
  // Base do último fetch — a partir dela o painel conta o tempo ao vivo.
  const base = useRef<{ at: number; preview: AfkPreview } | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/character?id=${characterId}`);
      const data = await res.json();
      if (data.character) {
        setCharacter(data.character);
        const since = data.character.afkSince;
        // Sessão ativa se afkSince existir (o claim zera para null). Não importa
        // se passou do cap de 12h: recompensas pendentes ainda precisam ser coletadas.
        setHasSession(!!since && !Number.isNaN(new Date(since).getTime()));
      }
      const preview = data.afkRewards ?? null;
      setAfk(preview);
      base.current = preview ? { at: Date.now(), preview } : null;
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId, setCharacter]);

  useEffect(() => { load(); }, [load]);

  // Contador ao vivo enquanto houver sessão ativa
  useEffect(() => {
    if (!hasSession) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [hasSession]);

  // Preview atualizado em tempo real (base do último fetch + taxas por minuto)
  const live = (): { gold: number; xp: number; duration: number } => {
    const b = base.current;
    if (!b) return { gold: 0, xp: 0, duration: 0 };
    const extraSec = Math.max(0, Math.floor((Date.now() - b.at) / 1000));
    return {
      gold: b.preview.gold + Math.floor((b.preview.goldPerMin || 0) * (extraSec / 60)),
      xp: b.preview.xp + Math.floor((b.preview.xpPerMin || 0) * (extraSec / 60)),
      duration: Math.min(AFK_MAX_SEC, b.preview.duration + extraSec),
    };
  };

  const startAFK = async () => {
    setStartingAFK(true);
    try {
      const res = await fetch("/api/game?action=afk-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.success) {
        setHasSession(true);
        setClaimResult(null);
        notify("💤 Modo AFK ativado! Suas recompensas acumularão enquanto você estiver offline.", "success");
        load();
      } else {
        notify(data.error || t("general.error", locale), "error");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setStartingAFK(false);
  };

  const claim = async () => {
    if (collecting) return;
    setCollecting(true);
    try {
      const res = await fetch("/api/game?action=afk-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao coletar", "error");
      } else if (data.gold > 0 || data.xp > 0) {
        setClaimResult(data);
        setHasSession(false);
        setAfk(null);
        base.current = null;
        notify(`🎉 +${Number(data.gold).toLocaleString()} 💰 +${Number(data.xp).toLocaleString()} XP`, "success");
        load();
      } else {
        notify("⏰ Menos de 1 minuto acumulado. Aguarde mais!", "info");
      }
    } catch { notify(t("general.error", locale), "error"); }
    setCollecting(false);
  };

  const formatDuration = (sec: number) => {
    sec = Math.max(0, Math.floor(sec));
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  };

  if (loading && !afk) {
    return <div className="flex flex-col items-center justify-center py-20"><div className="spinner mb-4"></div></div>;
  }

  const cur = live();
  const canCollect = cur.duration >= 60;
  const waiting = hasSession && !canCollect;
  const resultDuration = Number(claimResult?.duration) || 0;

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
          {hasSession ? (
            <>🟢 Descansando — <span className="text-white font-bold">{formatDuration(cur.duration)}</span> acumulado <span className="text-gray-600">(máx. 12h)</span></>
          ) : (
            "⚪ Modo AFK inativo"
          )}
        </p>
      </div>

      {!hasSession ? (
        <>
          {claimResult && (
            <div className="game-card p-6 animate-fadeInUp border-[#00ff88]/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🎉</div>
                <h3 className="font-bold text-[#00ff88] text-lg">Recompensas Coletadas!</h3>
              </div>
              <div className="text-sm text-gray-400 mb-4">
                Você ficou offline por <span className="text-white font-bold">{formatDuration(resultDuration)}</span>
              </div>
              <div className="flex gap-5 text-sm mb-5">
                <span className="text-[#ffd700] flex items-center gap-1.5">
                  +{Number(claimResult.gold).toLocaleString()} <img src="/images/icons/icone_moeda.png" alt="ouro" className="w-4 h-4 object-contain" />
                </span>
                <span className="text-[#00ff88]">+{Number(claimResult.xp).toLocaleString()} XP</span>
                {Boolean(claimResult.levelUp) && (
                  <span className="text-[#a855f7]">🎊 Level Up! → {String(claimResult.newLevel)}</span>
                )}
              </div>
              <button onClick={startAFK} disabled={startingAFK} className="game-btn-gold game-btn">
                {startingAFK ? "Ativando..." : "💤 Descansar novamente (Modo AFK)"}
              </button>
            </div>
          )}

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
        </>
      ) : waiting ? (
        <div className="game-card p-8 text-center animate-fadeInUp">
          <div className="text-5xl mb-3">⏳</div>
          <p className="text-gray-400">Acumulando recompensas...</p>
          <p className="text-gray-600 text-sm mt-2">
            Tempo acumulado: <span className="text-white font-bold">{formatDuration(cur.duration)}</span> — falta{" "}
            <span className="text-[#ffd700] font-bold">{formatDuration(60 - cur.duration)}</span> para poder coletar
          </p>
          <button onClick={load} className="game-btn mt-4">🔄 Atualizar</button>
        </div>
      ) : (
        <div className="game-card game-card-glow p-6 text-center animate-fadeInUp">
          <div className="text-6xl mb-3">🌙</div>
          <h3 className="text-xl font-bold text-white mb-2">{t("afk.title", locale)}</h3>
          <div className="text-gray-400 text-sm mb-6">
            {t("afk.timeAway", locale)}: <span className="text-white font-bold">{formatDuration(cur.duration)}</span>
            <span className="text-gray-600 text-xs ml-2">(máx. 12h)</span>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
            <div className="bg-gradient-to-br from-[#ffd700]/10 to-transparent rounded-xl p-4 border border-[#ffd700]/20">
              <div className="text-sm text-gray-400">{t("afk.goldEarned", locale)}</div>
              <div className="text-2xl font-black text-[#ffd700]">+{cur.gold.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-[#00ff88]/10 to-transparent rounded-xl p-4 border border-[#00ff88]/20">
              <div className="text-sm text-gray-400">{t("afk.xpEarned", locale)}</div>
              <div className="text-2xl font-black text-[#00ff88]">+{cur.xp.toLocaleString()}</div>
            </div>
          </div>

          <button onClick={claim} disabled={collecting}
            className="game-btn-gold game-btn text-lg animate-pulse-glow px-10 py-3">
            {collecting ? "Coletando..." : `🎁 ${t("afk.collect", locale)}`}
          </button>
        </div>
      )}
    </div>
  );
}
