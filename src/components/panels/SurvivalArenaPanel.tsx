"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";
import { getWaveDef, ARENA_DAILY_LIMIT, ARENA_ENERGY_COST, ARENA_RANKING_REWARDS } from "@/game/survivalArena";

export default function SurvivalArenaPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fighting, setFighting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedStart, setSelectedStart] = useState(1);

  const power = Number((character as any)?.power) || 100;
  const energy = Number((character as any)?.energy) || 0;
  const level = Number((character as any)?.level) || 1;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/game?action=survival-arena&characterId=${characterId}`);
      const data = await res.json();
      setStats(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const fight = async () => {
    if (!characterId || fighting) return;
    setFighting(true);
    setResult(null);
    try {
      const res = await fetch("/api/game?action=survival-arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "fight", startWave: selectedStart }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        notify(`⚔️ Arena completa! Waves: ${data.wavesWon} | Recompensas: 💰${data.rewards.gold.toLocaleString()} 🔮${data.rewards.crystals}`, "success");
        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro na arena", "error"); }
    setFighting(false);
  };

  const bestWave = stats?.bestWave || 0;
  const runsToday = stats?.runsToday || 0;
  const remaining = stats?.remaining || 0;
  const ranking = stats?.ranking || [];
  const myRank = stats?.myRank;

  // Estimate rewards for current start wave
  const estimatedWave = selectedStart + Math.floor(power / 200);
  const nextDef = getWaveDef(selectedStart);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#e94560]/20 via-[#f59e0b]/10 to-[#16213e]/40 border border-[#e94560]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">⚔️</span>
            <span className="bg-gradient-to-r from-[#e94560] to-[#f59e0b] bg-clip-text text-transparent">
              Arena de Sobrevivencia
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Enfrente waves infinitas e suba no ranking!</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#e94560]">{bestWave}</div>
          <div className="text-[10px] text-gray-400 uppercase">Melhor Wave</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#f59e0b]">{remaining}/{ARENA_DAILY_LIMIT}</div>
          <div className="text-[10px] text-gray-400 uppercase">Restantes</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#22c55e]">⚡{energy}</div>
          <div className="text-[10px] text-gray-400 uppercase">Energia</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#a855f7]">💪{power.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 uppercase">Poder</div>
        </div>
      </div>

      {/* Battle Setup */}
      {!result && (
        <div className="game-card p-4">
          <h3 className="font-bold text-sm text-gray-300 mb-3">⚔️ Configurar Batalha</h3>

          {/* Start Wave */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-2">Wave Inicial</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedStart(Math.max(1, selectedStart - 10))}
                className="game-btn px-3 py-1.5 text-sm">-10</button>
              <button onClick={() => setSelectedStart(Math.max(1, selectedStart - 1))}
                className="game-btn px-3 py-1.5 text-sm">-1</button>
              <div className="flex-1 text-center">
                <div className="text-3xl font-black text-[#e94560]">{selectedStart}</div>
                <div className="text-[10px] text-gray-500">
                  {bestWave > 0 ? `Melhor: ${bestWave}` : "Primeira vez!"}
                </div>
              </div>
              <button onClick={() => setSelectedStart(Math.min(bestWave + 1, selectedStart + 1))}
                className="game-btn px-3 py-1.5 text-sm">+1</button>
              <button onClick={() => setSelectedStart(Math.min(bestWave + 1, selectedStart + 10))}
                className="game-btn px-3 py-1.5 text-sm">+10</button>
            </div>
          </div>

          {/* Next Wave Preview */}
          <div className="bg-white/5 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-400 mb-2">Proxima Wave ({selectedStart}):</div>
            <div className="flex items-center gap-4 text-sm">
              <span>👹 {nextDef.monsterCount} monstros</span>
              <span>💪 Poder: {nextDef.monsterPower.toLocaleString()}</span>
              {nextDef.bossWave && (
                <span className="text-[#e94560] font-bold">👹 BOSS: {nextDef.bossName}</span>
              )}
            </div>
          </div>

          {/* Cost */}
          <div className="text-center text-xs text-gray-400 mb-3">
            Custo: ⚡{ARENA_ENERGY_COST} energia | Max 50 waves por tentativa
          </div>

          {/* Fight Button */}
          <button
            onClick={fight}
            disabled={fighting || energy < ARENA_ENERGY_COST || remaining <= 0}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              energy >= ARENA_ENERGY_COST && remaining > 0
                ? "bg-gradient-to-r from-[#e94560] to-[#f59e0b] text-white hover:opacity-90 active:scale-95 shadow-lg shadow-[#e94560]/20"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            {fighting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Lutando...
              </span>
            ) : remaining <= 0 ? (
              "🚫 Sem tentativas restantes"
            ) : energy < ARENA_ENERGY_COST ? (
              "⚡ Energia insuficiente"
            ) : (
              `⚔️ Lutar! (−⚡${ARENA_ENERGY_COST})`
            )}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="game-card p-5 border-[#e94560]/30 bg-[#e94560]/5">
          <h3 className="text-xl font-black text-center mb-4">
            ⚔️ Resultado da Arena
          </h3>

          <div className="grid grid-cols-2 gap-3 text-center mb-4">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-sm text-gray-400">Wave Inicial</div>
              <div className="text-xl font-bold text-white">{result.startWave}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-sm text-gray-400">Wave Final</div>
              <div className="text-xl font-black text-[#e94560]">{result.finalWave}</div>
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="text-sm text-gray-400">Waves Vencidas</div>
            <div className="text-3xl font-black text-[#22c55e]">{result.wavesWon}</div>
          </div>

          {/* Rewards */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="text-center p-2 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20">
              <div className="text-lg font-black text-[#ffd700]">💰 {result.rewards.gold.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400">Ouro</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/20">
              <div className="text-lg font-black text-[#06b6d4]">🔮 {result.rewards.crystals}</div>
              <div className="text-[10px] text-gray-400">Cristais</div>
            </div>
          </div>

          {/* Battle Log */}
          {result.battleLog && result.battleLog.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">📜 Historico:</div>
              <div className="flex flex-wrap gap-1">
                {result.battleLog.map((log: any, i: number) => (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                    log.won ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-[#e94560]/20 text-[#e94560]"
                  }`}>
                    W{log.wave} {log.won ? "✓" : "✗"} {log.bossWave ? "👹" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setResult(null)}
            className="w-full mt-4 py-2 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition">
            🔄 Tentar Novamente
          </button>
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="game-card p-4">
          <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 Ranking da Arena</h3>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map((r: any, i: number) => (
              <div key={r.id} className={`flex items-center gap-3 p-2 rounded-lg ${
                r.id === characterId ? "bg-[#e94560]/10 border border-[#e94560]/30" : "bg-white/5"
              }`}>
                <div className="w-6 text-center font-bold text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-gray-500">{i + 1}</span>}
                </div>
                <img src={classImage(r.classType as ClassName, r.sex)} alt={r.name}
                  className="w-7 h-7 rounded-lg border border-white/10 object-cover" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{r.name}</div>
                  <div className="text-[10px] text-gray-500">Lv.{r.level}</div>
                </div>
                <div className="text-sm font-bold text-[#e94560]">⚔️ Wave {r.bestWave}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking Rewards */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">🏅 Recompensas por Ranking</h3>
        <div className="space-y-1.5">
          {ARENA_RANKING_REWARDS.map((rr) => (
            <div key={rr.rank} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-white/5">
              <span className="font-bold w-6">
                {rr.rank === 1 ? "🥇" : rr.rank === 2 ? "🥈" : rr.rank === 3 ? "🥉" : `#${rr.rank}`}
              </span>
              <span className="flex-1 text-gray-300">{rr.title}</span>
              <span className="text-[#ffd700]">💰{rr.gold.toLocaleString()}</span>
              <span className="text-[#06b6d4]">🔮{rr.crystals}</span>
              {rr.diamonds > 0 && <span className="text-[#a855f7]">💎{rr.diamonds}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
