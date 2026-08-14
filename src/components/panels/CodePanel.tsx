"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { boostSummary, formatBoostMs } from "@/game/boosts";

export default function CodePanel() {
  const { characterId, character, setCharacter, notify } = useGameStore();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [, setTick] = useState(0);

  // Atualiza o contador de tempo restante dos boosts periodicamente.
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const summary = boostSummary(character);

  const redeem = useCallback(async () => {
    const value = code.trim().toUpperCase();
    if (!value) return notify("Digite um código para resgatar.", "error");
    if (!characterId) return notify("Personagem não encontrado.", "error");
    setRedeeming(true);
    try {
      const res = await fetch("/api/codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, characterId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        notify(d.error || "Não foi possível resgatar o código.", "error");
        return;
      }
      if (d.character) setCharacter(d.character);
      notify("🎉 " + (d.message || "Código resgatado com sucesso!"), "success");
      setCode("");
    } catch {
      notify("Erro de conexão. Tente novamente.", "error");
    } finally {
      setRedeeming(false);
    }
  }, [code, characterId, setCharacter, notify]);

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <img src="/images/sidebar/menu_codigo.png" alt="Código" className="w-10 h-10 object-contain" />
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Usar Código</h2>
          <p className="text-xs text-gray-400">Resgate códigos promocionais e ative o boost de 2x XP e 2x Energia.</p>
        </div>
      </div>

      {/* Status dos boosts ativos */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className={`game-card p-4 border ${summary.xpActive ? "border-[#ffd700]/40" : "border-white/10"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-bold text-[#ffd700]">⚡ 2x XP</span>
            <span className={`text-lg ${summary.xpActive ? "" : "grayscale opacity-40"}`}>✨</span>
          </div>
          <p className={`text-2xl font-black ${summary.xpActive ? "text-white" : "text-gray-500"}`}>
            {summary.xpActive ? formatBoostMs(summary.xpRemainingMs) : "Inativo"}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Recompensas de missões e AFK valem o dobro.</p>
        </div>
        <div className={`game-card p-4 border ${summary.energyActive ? "border-[#4ecdc4]/40" : "border-white/10"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-bold text-[#4ecdc4]">⚡ 2x Energia</span>
            <span className={`text-lg ${summary.energyActive ? "" : "grayscale opacity-40"}`}>🔋</span>
          </div>
          <p className={`text-2xl font-black ${summary.energyActive ? "text-white" : "text-gray-500"}`}>
            {summary.energyActive ? formatBoostMs(summary.energyRemainingMs) : "Inativo"}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Sua energia recarrega duas vezes mais rápido.</p>
        </div>
      </div>

      {/* Resgate */}
      <div className="game-card p-6 max-w-xl">
        <h3 className="text-lg font-bold text-white mb-1">Resgatar Código</h3>
        <p className="text-xs text-gray-400 mb-4">Digite o código fornecido pela administração ou em eventos.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && redeem()}
            placeholder="EX: BEMVINDO2026"
            className="flex-1 bg-[#0a0a12] border border-white/15 rounded-xl px-4 py-3 font-mono uppercase tracking-[0.2em] text-white focus:border-[#a855f7] focus:outline-none"
            maxLength={30}
          />
          <button
            onClick={redeem}
            disabled={redeeming}
            className="bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white rounded-xl px-6 py-3 font-bold text-sm disabled:opacity-40 hover:brightness-110 transition"
          >
            {redeeming ? "Resgatando..." : "🎟️ Resgatar"}
          </button>
        </div>
      </div>
    </div>
  );
}