"use client";
import { useGameStore } from "@/store/gameStore";
import { t, supportedLocales } from "@/i18n";

export default function SettingsPanel() {
  const { locale, setLocale, soundOn, setSoundOn, volume, setVolume } = useGameStore();

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <img src="/images/sidebar/menu_configuracoes.png" alt={t("settings.title", locale)} className="w-10 h-10 object-contain" />
        <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          {t("settings.title", locale)}
        </span>
      </h2>

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

      {/* 📊 Informações do Jogo */}
      <div className="game-card p-5">
        <h3 className="font-bold mb-3">📊 {t("settings.info", locale)}</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <div>🕹️ {t("app.title", locale)} <span className="text-white">1.0.0</span></div>
          <div>{t("settings.server", locale)}: <span className="text-[#22c55e]">🟢 {t("settings.online", locale)}</span></div>
          <div>{t("settings.players", locale)}: <span className="text-white">1</span></div>
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
