"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";

export default function ChallengePanel() {
  const { characterId, character, locale, notify, setCharacter, setTab } = useGameStore();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tower/challenge?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const startChallenge = async (floor: number) => {
    if (!characterId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tower/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "start", floor }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`🏰 ${d.message}`, "success");
        // TODO: Abrir batalha do modo desafio
      } else {
        notify(d.error || "Erro", "error");
      }
    } catch { notify("Erro ao iniciar desafio", "error"); }
    setBusy(false);
  };

  const ranking = (Array.isArray(data?.ranking) ? data.ranking : []) as Array<Record<string, unknown>>;
  const playerRank = Number(data?.playerRank) || 0;
  const playerBestFloor = Number(data?.playerBestFloor) || 0;
  const playerRuns = Number(data?.playerRuns) || 0;
  const startFloor = Number(data?.startFloor) || 50;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
        <div className="spinner mb-4" />
        <p className="text-gray-400">{t("general.loading", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ef4444] to-[#dc2626] border border-[#ef4444]/50 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.35)]">
            <span className="text-2xl">🏰</span>
          </div>
          <div>
            <h2 className="text-3xl font-black">
              <span className="bg-gradient-to-r from-[#ef4444] to-[#f87171] bg-clip-text text-transparent">Modo Desafio</span>
            </h2>
            <p className="text-gray-500 text-sm mt-0.1">Torre com dificuldade extrema e ranking semanal</p>
          </div>
        </div>
        <button onClick={() => setTab("tower")} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 text-gray-400 hover:text-white transition">
          ← Torre Normal
        </button>
      </div>

      {/* Info do jogador */}
      <div className="game-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-bold text-white">🏰 Seu Progresso</div>
            <div className="text-2xl font-black text-[#ef4444] mt-1">Andar {playerBestFloor}</div>
            <div className="text-[11px] text-gray-400">{playerRuns} tentativas realizadas</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#ffd700]">#{playerRank}</div>
            <div className="text-[10px] text-gray-500">no ranking</div>
          </div>
        </div>
      </div>

      {/* Iniciar desafio */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-[#ef4444] mb-3">⚔️ Iniciar Desafio</h3>
        <p className="text-xs text-gray-400 mb-3">
          O desafio começa no andar <b className="text-white">{startFloor}</b> com inimigos <b className="text-red-400">3x mais fortes</b> que a torre normal.
          Recompensas são <b className="text-[#ffd700]">5x maiores</b>!
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[10px]">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
            <div className="text-red-300 font-bold">⚔️ Dificuldade</div>
            <div className="text-white font-black">3x</div>
          </div>
          <div className="bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-lg p-2 text-center">
            <div className="text-[#ffd700] font-bold">💰 Ouro</div>
            <div className="text-white font-black">5x</div>
          </div>
          <div className="bg-[#a855f7]/10 border border-[#a855f7]/30 rounded-lg p-2 text-center">
            <div className="text-[#a855f7] font-bold">✨ XP</div>
            <div className="text-white font-black">5x</div>
          </div>
          <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg p-2 text-center">
            <div className="text-[#3b82f6] font-bold">🗼 Moedas</div>
            <div className="text-white font-black">5x</div>
          </div>
        </div>
        <button
          onClick={() => startChallenge(playerBestFloor > 0 ? playerBestFloor : startFloor)}
          disabled={busy}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white font-black text-lg disabled:opacity-40 hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(239,68,68,0.3)]"
        >
          {busy ? "..." : `🏰 Iniciar no Andar ${playerBestFloor > 0 ? playerBestFloor : startFloor}`}
        </button>
      </div>

      {/* Recompensas por ranking */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-[#ffd700] mb-3">🏆 Recompensas Semanais</h3>
        <div className="space-y-2">
          {[
            { rank: "🥇 1º", gold: 100000, crystals: 200, tower: 1000, title: "Conquistador do Desafio" },
            { rank: "🥈 2º", gold: 60000, crystals: 120, tower: 600, title: "Desafiante Elite" },
            { rank: "🥉 3º", gold: 40000, crystals: 80, tower: 400, title: null },
            { rank: "📊 4º-10º", gold: 20000, crystals: 40, tower: 200, title: null },
            { rank: "📊 11º-25º", gold: 10000, crystals: 20, tower: 100, title: null },
            { rank: "📊 26º-50º", gold: 5000, crystals: 10, tower: 50, title: null },
            { rank: "🎖️ Todos", gold: 2000, crystals: 5, tower: 25, title: null },
          ].map((r, i) => (
            <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${i < 3 ? "bg-[#ffd700]/5 border-[#ffd700]/20" : "bg-white/5 border-white/5"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{r.rank}</span>
                {r.title && <span className="text-[9px] text-[#ffd700] bg-[#ffd700]/10 px-1.5 py-0.5 rounded">"{r.title}"</span>}
              </div>
              <div className="text-[10px] text-gray-400">
                💰 {r.gold.toLocaleString()} · 🔮 {r.crystals} · 🗼 {r.tower}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 Ranking Semanal</h3>
        {ranking.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-10">Nenhum desafio realizado ainda</div>
        ) : (
          <div className="space-y-1">
            {ranking.slice(0, 20).map((r, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const isMe = r.characterId === characterId;
              return (
                <div key={String(r.characterId)} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${isMe ? "bg-[#ffd700]/10 border border-[#ffd700]/40" : "bg-[#0a0a12]"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 text-center font-black ${i === 0 ? "text-[#ffd700]" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>
                      {medals[i] || `${i + 1}º`}
                    </span>
                    <img src={classImage((r.classType as ClassName) || "warrior", "male")} alt="" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{String(r.name)} {isMe && <span className="text-[9px] text-[#ffd700]">(você)</span>}</div>
                      <div className="text-[10px] text-gray-500">Lv.{String(r.level)} · {String(r.challengeRuns)} tentativas</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#ef4444]">Andar {String(r.bestFloor)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Como funciona */}
      <div className="game-card p-4">
        <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ Como funciona</h3>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
          <li>Começa no andar {startFloor} com inimigos 3x mais fortes</li>
          <li>Recompensas 5x maiores que a torre normal</li>
          <li>Seu melhor andar é registrado no ranking semanal</li>
          <li>Ao fim da semana, os melhores recebem recompensas exclusivas</li>
          <li>O ranking reseta toda segunda-feira</li>
        </ul>
      </div>
    </div>
  );
}
