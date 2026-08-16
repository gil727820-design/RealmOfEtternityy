"use client";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t, supportedLocales } from "@/i18n";

const NOTIF_LS = "realm_notifications_enabled";

/** Pede permissão de notificação do navegador e avisa se foi negada. */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

export default function SettingsPanel() {
  const { locale, setLocale, soundOn, setSoundOn, volume, setVolume, characterId, notify } = useGameStore();
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifSupported] = useState(() => typeof window !== "undefined" && "Notification" in window);

  useEffect(() => {
    setNotifEnabled(typeof window !== "undefined" && localStorage.getItem(NOTIF_LS) === "1");
  }, []);

  // Contador real de jogadores online (heartbeat de presença) + marca o próprio
  // jogador como online ao abrir as configurações. Atualiza a cada 30s.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/presence");
        const d = await res.json();
        if (active && typeof d.online === "number") setOnlineCount(d.online);
      } catch { /* ignora */ }
    };
    if (characterId) {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      }).catch(() => {});
    }
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, [characterId]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <img src="/images/sidebar/menu_configuracoes.png" alt={t("settings.title", locale)} className="w-10 h-10 object-contain" />
        <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          {t("settings.title", locale)}
        </span>
      </h2>

      {/* 🔔 Notificações do navegador */}
      <div className="game-card p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="font-bold flex items-center gap-2">🔔 {t("settings.notifications", locale)}</h3>
          {notifEnabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">
              ✓ {t("settings.on", locale)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {t("settings.notifications.desc", locale)}
        </p>
        {notifSupported ? (
          <button
            onClick={async () => {
              const granted = notifEnabled || (await requestNotificationPermission());
              if (!granted) {
                setNotifEnabled(false);
                try { localStorage.removeItem(NOTIF_LS); } catch { /* ignora */ }
                notify("❌ Permissão de notificação negada pelo navegador.", "error");
                return;
              }
              const next = !notifEnabled;
              setNotifEnabled(next);
              try {
                if (next) localStorage.setItem(NOTIF_LS, "1");
                else localStorage.removeItem(NOTIF_LS);
                window.dispatchEvent(new Event("realm-notifications-change"));
              } catch { /* ignora */ }
              notify(next ? "🔔 Notificações ativadas!" : "🔕 Notificações desativadas.", "success");
            }}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 cursor-pointer ${notifEnabled ? "bg-[#22c55e]" : "bg-gray-700"}`}
            aria-pressed={notifEnabled}
            title={t("settings.notifications", locale)}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${notifEnabled ? "left-7" : "left-1"}`}
            />
          </button>
        ) : (
          <p className="text-xs text-gray-600">{t("settings.notifications.unsupported", locale)}</p>
        )}
      </div>

      {/* 🔊 Som / Volume */}
      <div className="game-card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-bold flex items-center gap-2">🎵 {t("settings.sound", locale)}</h3>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${soundOn ? "bg-[#22c55e]" : "bg-gray-700"}`}
            aria-pressed={soundOn}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${soundOn ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-1">{t("settings.sound.desc", locale)}</p>
        <p className={`text-sm font-bold mb-3 ${soundOn ? "text-[#22c55e]" : "text-gray-500"}`}>
          {soundOn ? `🔊 ${t("settings.on", locale)}` : `🔇 ${t("settings.off", locale)}`}
        </p>

        <div className={`space-y-2 ${soundOn ? "" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">🔉 {t("settings.volume", locale)}</span>
            <span className="font-mono font-bold text-white">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full accent-[#ff6b6b] cursor-pointer"
          />
        </div>
      </div>

      {/* 🌐 Idioma */}
      <div className="game-card p-5">
        <h3 className="font-bold mb-3">🌐 {t("settings.language", locale)}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {supportedLocales.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`p-3 rounded-lg text-sm border transition text-left font-medium ${locale === l.code ? "border-[#e94560] bg-[#e94560]/20 text-white shadow-lg" : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"}`}
            >
              {l.code === "pt-BR" ? "🇧🇷" : l.code === "en" ? "🇺🇸" : "🇪🇸"} {l.label}
              {locale === l.code && <span className="ml-2 text-[#ff6b6b]">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 🧹 Cache do Jogo — limpa dados locais e recarrega com tudo atualizado */}
      <div className="game-card p-5 border-red-500/20">
        <h3 className="font-bold mb-2">🧹 {t("settings.cache", locale)}</h3>
        <p className="text-xs text-gray-400 mb-4">{t("settings.cache.desc", locale)}</p>
        <button
          onClick={() => {
            // Limpa as preferências/cache local do app. A sessão fica no cookie
            // httpOnly — limpar o localStorage NÃO desloga o jogador.
            const keys = ["realm-of-eternity-storage-v2", "realm-of-eternity-storage", NOTIF_LS];
            keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignora */ } });
            // Limpa caches de Service Worker (se o navegador tiver).
            try {
              if (typeof caches !== "undefined" && typeof caches.keys === "function") {
                caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {});
              }
            } catch { /* ignora */ }
            notify(t("settings.cache.confirm", locale), "success");
            setTimeout(() => window.location.reload(), 800);
          }}
          className="px-5 py-2.5 rounded-xl text-sm font-black border border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25 cursor-pointer transition-all"
        >
          {t("settings.cache.btn", locale)}
        </button>
      </div>

      {/* 📊 Informações do Jogo */}
      <div className="game-card p-5">
        <h3 className="font-bold mb-3">📊 {t("settings.info", locale)}</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <div>🕹️ {t("app.title", locale)} <span className="text-white">1.0.0</span></div>
          <div>{t("settings.server", locale)}: <span className="text-[#22c55e]">🟢 {t("settings.online", locale)}</span></div>
          <div>{t("settings.players", locale)}: <span className="text-white">{onlineCount ?? "…"}</span></div>
        </div>
      </div>

      {/* 🎮 Sobre */}
      <div className="game-card p-5">
        <h3 className="font-bold mb-3">🎮 {t("settings.about", locale)}</h3>
        <p className="text-sm text-gray-400">{t("settings.about.desc", locale)}</p>
      </div>
    </div>
  );
}
