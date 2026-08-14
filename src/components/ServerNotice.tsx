"use client";
import { useEffect, useRef, useState } from "react";

type ServerSettings = {
  announcement: string;
  announcementStyle: "banner" | "popup";
  announcementId: string;
  maintenance: boolean;
  maintenanceMessage: string;
  maintenanceUntil: string;
};

const SEEN_KEY = "serverNoticeSeenIds"; // ids de popup já exibidos (mensagem única)

/**
 * Avisos globais exibidos para TODOS os jogadores:
 *  - "banner": faixa fixa no topo, bonita, animada, que fica enquanto o admin não remover;
 *  - "popup":  notificação central que aparece UMA única vez por mensagem e some sozinha;
 *  - manutenção ativa → tela de bloqueio para todos.
 * Atualiza sozinho a cada 30s (polling) para detectar novas mensagens.
 */
/** Formata milissegundos em cooldown legível (ex.: 02:31:07 ou 2d 3h 12m). */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function ServerNotice() {
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seenRef = useRef<string[]>([]);
  // Modo teste do admin: ignora a manutenção e mostra um selo 🧪 no jogo.
  const [testMode, setTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("adminTestMode") === "1";
    } catch {
      return false;
    }
  });

  // Lê os popups já vistos neste navegador (persiste entre recarregamentos).
  useEffect(() => {
    try {
      seenRef.current = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      seenRef.current = [];
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/server/settings");
        if (!res.ok) return;
        const d = await res.json();
        if (!active) return;
        setSettings(d);

        if (d.announcement) {
          if (d.announcementStyle === "popup" && d.announcementId) {
            // Mensagem única: só mostra se ainda não viu este id.
            if (!seenRef.current.includes(d.announcementId)) {
              seenRef.current = [...seenRef.current, d.announcementId];
              localStorage.setItem(SEEN_KEY, JSON.stringify(seenRef.current));
              setPopupVisible(true);
              setTimeout(() => setPopupVisible(false), 9000);
            }
          } else {
            setBannerVisible(true); // faixa persistente até remover
          }
        }
      } catch {
        /* rede fora — ignora */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Relógio do cooldown: atualiza a cada segundo enquanto a manutenção tiver hora marcada.
  const maintenanceUntilMs = settings?.maintenanceUntil ? new Date(settings.maintenanceUntil).getTime() : 0;
  const hasCountdown = !!settings?.maintenance && Number.isFinite(maintenanceUntilMs) && maintenanceUntilMs > 0;
  useEffect(() => {
    if (!hasCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasCountdown]);

  // ---- Manutenção ativa: bloqueia o jogo para todos (exceto modo teste do admin) ----
  if (settings?.maintenance && testMode) {
    return (
      <div className="fixed top-2 left-2 z-[95] flex items-center gap-2 bg-[#4ecdc4]/15 border border-[#4ecdc4]/50 text-[#4ecdc4] rounded-full px-3 py-1.5 text-[11px] font-bold backdrop-blur-md shadow-[0_0_20px_rgba(78,205,196,0.25)] animate-fadeInDown">
        <span>🧪</span>
        <span>Modo teste — manutenção ignorada</span>
      </div>
    );
  }

  if (settings?.maintenance) {
    const remainingMs = maintenanceUntilMs ? maintenanceUntilMs - now : 0;
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0a0a12]/95 backdrop-blur-xl p-6">
        <div className="relative max-w-md w-full text-center rounded-3xl border-2 border-[#ff6b8a]/40 bg-gradient-to-b from-[#1a1030]/95 to-[#0f0a1c]/95 p-10 shadow-[0_0_70px_rgba(233,69,96,0.35)] animate-scaleIn overflow-hidden">
          <div
            className="animate-gradient absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff6b8a] to-transparent"
            style={{ backgroundSize: "200% 100%" }}
          />
          <div className="text-7xl mb-5 animate-heartbeat">🛠️</div>
          <div className="text-[10px] uppercase tracking-[0.35em] text-[#ff6b8a]/80 mb-3">Realm of Eternity</div>
          <h2 className="text-2xl font-black text-white mb-3">Servidor em manutenção</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            {settings.maintenanceMessage || "Estamos realizando melhorias. Volte em breve!"}
          </p>
          {hasCountdown ? (
            remainingMs > 0 ? (
              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff6b8a]/70 mb-2">
                  ⏳ Volta em
                </p>
                <div className="text-4xl font-black text-white tabular-nums tracking-widest" style={{ textShadow: "0 0 20px rgba(255,107,138,0.5)" }}>
                  {formatCountdown(remainingMs)}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Entre em <b className="text-[#ffd700]">{new Date(maintenanceUntilMs).toLocaleString("pt-BR")}</b>
                </p>
              </div>
            ) : (
              <div className="mt-6 flex items-center justify-center gap-2 text-[#ff6b8a]/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#ff6b8a] animate-pulse-soft" />
                O horário programado já passou — o servidor deve voltar em instantes
              </div>
            )
          ) : (
            <div className="mt-6 flex items-center justify-center gap-2 text-[#ff6b8a]/70 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#ff6b8a] animate-pulse-soft" />
              Tente novamente em instantes
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Notificação popup (mensagem única) ----
  if (settings?.announcementStyle === "popup" && popupVisible) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => setPopupVisible(false)} />
        <div className="relative animate-bounceIn max-w-md w-full rounded-3xl border-2 border-[#ffd700]/60 overflow-hidden text-center shadow-[0_0_70px_rgba(255,215,0,0.35)]">
          <div className="bg-gradient-to-b from-[#3a2f0a]/95 via-[#1c1c2f]/95 to-[#16162a]/95 p-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#ffd700]/15 border-2 border-[#ffd700]/50 flex items-center justify-center text-3xl animate-pulse-soft shadow-[0_0_25px_rgba(255,215,0,0.45)]">
              📢
            </div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#ffd700]/70 mb-3">
              Aviso do servidor
            </div>
            <p
              className="text-lg font-black text-white leading-relaxed"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}
            >
              {settings.announcement}
            </p>
          </div>
          <button
            onClick={() => setPopupVisible(false)}
            aria-label="Fechar aviso"
            className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // ---- Faixa no topo (persistente) ----
  if (settings?.announcement && settings?.announcementStyle !== "popup" && bannerVisible) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] animate-fadeInDown">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#2b2307]/95 via-[#1b1b30]/95 to-[#2b2307]/95 border-b border-[#ffd700]/40 px-12 py-3 text-center backdrop-blur-xl shadow-[0_6px_30px_rgba(255,215,0,0.12)]">
          <div
            className="animate-gradient absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent"
            style={{ backgroundSize: "200% 100%" }}
          />
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="animate-pulse-soft text-lg">📢</span>
            <p
              className="text-sm font-bold text-[#ffd700] tracking-wide"
              style={{ textShadow: "0 0 12px rgba(255,215,0,0.45)" }}
            >
              {settings.announcement}
            </p>
          </div>
          <button
            onClick={() => setBannerVisible(false)}
            aria-label="Fechar aviso"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-[#ffd700]/70 hover:text-[#ffd700] flex items-center justify-center text-sm transition"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}