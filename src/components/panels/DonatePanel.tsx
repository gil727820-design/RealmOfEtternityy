"use client";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

export default function DonatePanel() {
  const { locale, notify } = useGameStore();
  const [pixKey, setPixKey] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/game?action=server-settings");
        const d = await res.json();
        setPixKey(typeof d.donatePixKey === "string" ? d.donatePixKey : "");
        setQrCode(typeof d.donateQrCode === "string" ? d.donateQrCode : "");
      } catch {
        /* ignora */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyPix = async () => {
    if (!pixKey) return;
    try {
      await navigator.clipboard.writeText(pixKey);
      notify(t("donate.copied", locale), "success");
    } catch {
      notify(pixKey, "info");
    }
  };

  const configured = !!pixKey || !!qrCode;

  return (
    <div className="animate-fadeInUp">
      <div className="section-header">
        <img src="/images/sidebar/menu_doar.png" alt={t("donate.title", locale)} className="w-10 h-10 object-contain" />
        <h2 className="gradient-text text-3xl font-black">{t("donate.title", locale)}</h2>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#ff4d6d]/30 game-card p-6 text-center mb-6 animate-fadeInDown">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,77,109,0.16),transparent_70%)]" />
        <div className="relative">
          <span className="text-5xl animate-float inline-block mb-3">🙏</span>
          <p className="text-base text-gray-200 max-w-2xl mx-auto leading-relaxed">
            {t("donate.message", locale)}
          </p>
          <p className="text-xs text-gray-400 max-w-md mx-auto mt-4">{t("donate.thanks", locale)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">...</div>
      ) : !configured ? (
        <div className="game-card p-6 text-center rounded-2xl border border-white/10">
          <div className="text-5xl mb-3">🔧</div>
          <p className="text-sm text-gray-400">{t("donate.notConfigured", locale)}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pixKey && (
            <div className="game-card p-6 flex flex-col items-center text-center gap-4 rounded-2xl border border-[#2ea44f]/30">
              <div className="text-4xl">🏦</div>
              <h3 className="text-lg font-bold text-white">{t("donate.pixKey", locale)}</h3>
              <p className="text-sm font-mono bg-[#0a0a12] border border-white/10 rounded-xl px-4 py-3 text-[#4ecdc4] break-all select-all">
                {pixKey}
              </p>
              <button
                onClick={copyPix}
                className="w-full bg-gradient-to-r from-[#2ea44f] to-[#1b7a36] text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:brightness-110 transition"
              >
                📋 {t("donate.copy", locale)}
              </button>
            </div>
          )}

          {qrCode && (
            <div className="game-card p-6 flex flex-col items-center text-center gap-4 rounded-2xl border border-white/10">
              <div className="text-4xl">📱</div>
              <h3 className="text-lg font-bold text-white">{t("donate.qr", locale)}</h3>
              <img
                src={qrCode}
                alt="QR Code"
                className="w-56 h-56 object-contain rounded-xl bg-white p-2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}