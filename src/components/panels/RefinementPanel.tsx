"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import { REFINEMENT_LEVELS, REFINEMENT_MATERIALS, refinementColor, refinementName } from "@/game/refinement";

type Material = {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: string;
  count: number;
};

type RefLevel = {
  level: number;
  statBonus: number;
  materials: { id: string; count: number }[];
  goldCost: number;
  successChance: number;
  failPenalty: number;
};

export default function RefinementPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [levels, setLevels] = useState<RefLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refining, setRefining] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [showResult, setShowResult] = useState<any>(null);

  const gold = Number((character as any)?.gold) || 0;
  const refinedItems = (character as any)?.refinedItems || {};
  const maxRefined = Object.values(refinedItems).reduce((max: number, v: any) => Math.max(max, Number(v) || 0), 0) as number;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/refinement?characterId=${characterId}`);
      const data = await res.json();
      setMaterials(data.materials ?? []);
      setLevels(data.levels ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const refine = async () => {
    if (!characterId || refining) return;
    setRefining(true);
    setShowResult(null);
    try {
      const res = await fetch("/api/refinement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "refine", itemId: "main_weapon", targetLevel: selectedLevel }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`✨ Refinamento bem-sucedido! ${data.effect}`, "success");
        setShowResult({ success: true, effect: data.effect, newLevel: data.newLevel });
        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(`💀 Refinamento falhou! ${data.effect}`, "error");
        setShowResult({ success: false, effect: data.effect, newLevel: data.newLevel });
        if (data.character) setCharacter(data.character);
        await load();
      }
    } catch { notify("Erro ao refinar", "error"); }
    setRefining(false);
  };

  const currentDef = levels.find((l) => l.level === selectedLevel);
  const nextLevel = Math.min(maxRefined + 1, 10);
  const isReachable = selectedLevel <= nextLevel;
  const canRefine = currentDef && nextLevel <= 10;

  // Check if can afford
  const canAfford = currentDef
    ? gold >= currentDef.goldCost && currentDef.materials.every((m) => {
        const mat = materials.find((mm) => mm.id === m.id);
        return (mat?.count || 0) >= m.count;
      })
    : false;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#f59e0b]/20 via-[#e94560]/10 to-[#16213e]/40 border border-[#f59e0b]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">⚒️</span>
            <span className="bg-gradient-to-r from-[#f59e0b] to-[#e94560] bg-clip-text text-transparent">
              Refinamento de Itens
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Melhore os stats base dos seus itens com materiais raros</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black" style={{ color: refinementColor(maxRefined) }}>
            {refinementName(maxRefined)}
          </div>
          <div className="text-[10px] text-gray-400 uppercase">Melhor Refinamento</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#ffd700]">💰 {gold.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 uppercase">Ouro</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#a855f7]">+{maxRefined * 5}%</div>
          <div className="text-[10px] text-gray-400 uppercase">Bonus Stats</div>
        </div>
      </div>

      {/* Materials Inventory */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">📦 Materiais</h3>
        <div className="grid grid-cols-3 gap-2">
          {materials.map((mat) => {
            const rarColor = RARITY_COLORS[mat.rarity] || "#9ca3af";
            return (
              <div key={mat.id} className="text-center p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-2xl">{mat.icon}</div>
                <div className="text-xs font-bold text-white mt-1">{mat.name}</div>
                <div className="text-[10px] font-black" style={{ color: rarColor }}>
                  {mat.count}
                </div>
                <div className="text-[8px] text-gray-500">{mat.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refinement Levels */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">📊 Niveis de Refinamento</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {levels.map((lvl) => {
            const isSelected = selectedLevel === lvl.level;
            const color = refinementColor(lvl.level);
            const isReachable = lvl.level <= nextLevel;
            return (
              <button
                key={lvl.level}
                onClick={() => setSelectedLevel(lvl.level)}
                className={`text-center p-2 rounded-lg border transition-all ${
                  isSelected ? "ring-2" : ""
                } ${isReachable ? "hover:scale-105" : "opacity-40 cursor-not-allowed"}`}
                style={{
                  borderColor: isSelected ? color : "rgba(255,255,255,0.1)",
                  backgroundColor: isSelected ? color + "15" : "rgba(255,255,255,0.03)",
                  
                }}
              >
                <div className="text-lg font-black" style={{ color }}>+{lvl.level}</div>
                <div className="text-[9px] text-gray-400">+{lvl.statBonus}%</div>
                <div className="text-[8px]" style={{ color: lvl.successChance >= 0.8 ? "#22c55e" : lvl.successChance >= 0.5 ? "#f59e0b" : "#e94560" }}>
                  {Math.round(lvl.successChance * 100)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Level Detail */}
      {currentDef && (
        <div className="game-card p-4 border-[#f59e0b]/30">
          <h3 className="font-bold text-sm mb-3">
            <span style={{ color: refinementColor(selectedLevel) }}>Refinamento +{selectedLevel}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-[10px] text-gray-500">Bonus</div>
              <div className="font-bold text-[#22c55e]">+{currentDef.statBonus}% stats</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-[10px] text-gray-500">Chance</div>
              <div className="font-bold" style={{ color: currentDef.successChance >= 0.8 ? "#22c55e" : currentDef.successChance >= 0.5 ? "#f59e0b" : "#e94560" }}>
                {Math.round(currentDef.successChance * 100)}%
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-[10px] text-gray-500">Custo</div>
              <div className="font-bold text-[#ffd700]">💰 {currentDef.goldCost.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-[10px] text-gray-500">Falha</div>
              <div className="font-bold text-[#e94560]">
                {currentDef.failPenalty > 0 ? `−${currentDef.failPenalty} nivel(is)` : "Sem penalidade"}
              </div>
            </div>
          </div>

          {/* Materials Required */}
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 mb-2">Materiais necessarios:</div>
            <div className="flex flex-wrap gap-2">
              {currentDef.materials.map((m) => {
                const mat = materials.find((mm) => mm.id === m.id);
                const have = mat?.count || 0;
                const enough = have >= m.count;
                return (
                  <span key={m.id} className={`text-xs px-2 py-1 rounded-lg border ${
                    enough ? "border-[#22c55e]/40 text-[#22c55e] bg-[#22c55e]/10" : "border-[#e94560]/40 text-[#e94560] bg-[#e94560]/10"
                  }`}>
                    {mat?.icon || "?"} {have}/{m.count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Result Popup */}
          {showResult && (
            <div className={`mb-4 p-3 rounded-xl text-center animate-fadeIn ${
              showResult.success ? "bg-[#22c55e]/10 border border-[#22c55e]/30" : "bg-[#e94560]/10 border border-[#e94560]/30"
            }`}>
              <div className="text-2xl mb-1">{showResult.success ? "✨" : "💀"}</div>
              <div className={`font-bold ${showResult.success ? "text-[#22c55e]" : "text-[#e94560]"}`}>
                {showResult.success ? `Refinamento +${showResult.newLevel}!` : "Falha no refinamento!"}
              </div>
              <div className="text-xs text-gray-400 mt-1">{showResult.effect}</div>
            </div>
          )}

          {/* Refine Button */}
          <button
            onClick={refine}
            disabled={refining || !canAfford || !isReachable}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
              canAfford && isReachable
                ? "bg-gradient-to-r from-[#f59e0b] to-[#e94560] text-white hover:opacity-90 active:scale-95"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            {refining ? "⏳ Refinando..." : `⚒️ Refinar (+${selectedLevel}) — 💰 ${currentDef.goldCost.toLocaleString()}`}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="game-card p-4 text-center text-xs text-gray-500">
        <p>⚒️ Refine seus itens para aumentar seus stats base em ate +50%.</p>
        <p className="mt-1">⚠️ Niveis 4+ tem chance de falha e podem reduzir o nivel do item.</p>
      </div>
    </div>
  );
}
