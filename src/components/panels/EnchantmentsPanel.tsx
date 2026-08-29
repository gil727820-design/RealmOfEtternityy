"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";

type EnchantmentItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  slot: string;
  maxLevel: number;
  costPerLevel: { gold: number; crystals: number };
  effects: Array<{ level: number; stat: string; value: number; label: string }>;
  successChance: number[];
  currentLevel: number;
};

const SLOT_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  weapon: { icon: "\u2694\uFE0F", label: "Arma", color: "#e94560" },
  armor: { icon: "\u{1F6E1}\uFE0F", label: "Armadura", color: "#3b82f6" },
  helmet: { icon: "\u26D1\uFE0F", label: "Capacete", color: "#a855f7" },
  boots: { icon: "\u{1F462}", label: "Botas", color: "#22c55e" },
  accessory: { icon: "\u{1F48D}", label: "Acessorio", color: "#f59e0b" },
};

export default function EnchantmentsPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [enchantments, setEnchantments] = useState<EnchantmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enchanting, setEnchanting] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("all");
  const [showResult, setShowResult] = useState<any>(null);

  const gold = Number((character as any)?.gold) || 0;
  const crystals = Number((character as any)?.crystals) || 0;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/enchantments?characterId=${characterId}`);
      const data = await res.json();
      setEnchantments(data.enchantments ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const enchant = async (enchantmentId: string, targetLevel: number) => {
    if (!characterId) return;
    setEnchanting(enchantmentId);
    setShowResult(null);
    try {
      const res = await fetch("/api/enchantments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, enchantmentId, targetLevel }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`✨ Encantamento bem-sucedido! ${data.effect || ""}`, "success");
        setShowResult({ ...data, enchantmentId, success: true });
        if (data.character) setCharacter(data.character);
        await load();
      } else if (data.previousLevel !== undefined) {
        notify(`💀 Encantamento falhou! O nivel anterior foi mantido.`, "error");
        setShowResult({ ...data, enchantmentId, success: false });
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao encantar", "error"); }
    setEnchanting(null);
  };

  const enhancedCount = enchantments.filter((e) => e.currentLevel > 0).length;
  const totalLevels = enchantments.reduce((sum, e) => sum + e.currentLevel, 0);

  const filtered = enchantments.filter((e) => {
    if (selectedSlot !== "all" && e.slot !== selectedSlot) return false;
    return true;
  });

  // Group by slot
  const slots = [...new Set(enchantments.map((e) => e.slot))];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#a855f7]/20 via-[#3b82f6]/10 to-[#16213e]/40 border border-[#a855f7]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">✨</span>
            <span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
              Encantamentos
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Adicione bonus especiais aos seus itens</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#a855f7]">{enhancedCount}</div>
          <div className="text-[10px] text-gray-400 uppercase">Encantados</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#3b82f6]">Lv.{totalLevels}</div>
          <div className="text-[10px] text-gray-400 uppercase">Total Niveis</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#ffd700]">💰 {gold.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 uppercase">Ouro</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#06b6d4]">💎 {crystals}</div>
          <div className="text-[10px] text-gray-400 uppercase">Cristais</div>
        </div>
      </div>

      {/* Slot Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => setSelectedSlot("all")}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
            selectedSlot === "all" ? "border-[#a855f7]/60 text-white bg-[#a855f7]/15" : "border-white/5 text-gray-500 hover:text-white"
          }`}>
          Todos ({enchantments.length})
        </button>
        {slots.map((slot) => {
          const info = SLOT_LABELS[slot] || { icon: "✨", label: slot, color: "#9ca3af" };
          const count = enchantments.filter((e) => e.slot === slot).length;
          return (
            <button key={slot} onClick={() => setSelectedSlot(slot)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                selectedSlot === slot ? "text-white" : "border-white/5 text-gray-500 hover:text-white"
              }`}
              style={selectedSlot === slot ? { borderColor: info.color + "60", backgroundColor: info.color + "15" } : {}}>
              <span>{info.icon}</span>
              <span>{info.label}</span>
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Result Popup */}
      {showResult && (
        <div className={`game-card p-4 text-center animate-fadeIn ${showResult.success ? "border-[#22c55e]/40 bg-[#22c55e]/5" : "border-[#e94560]/40 bg-[#e94560]/5"}`}>
          <div className="text-3xl mb-2">{showResult.success ? "✨" : "💀"}</div>
          <div className={`font-bold ${showResult.success ? "text-[#22c55e]" : "text-[#e94560]"}`}>
            {showResult.success ? "Encantamento Bem-Sucedido!" : "Encantamento Falhou!"}
          </div>
          {showResult.success && showResult.effect && (
            <div className="text-sm text-gray-300 mt-1">{showResult.effect}</div>
          )}
          <button onClick={() => setShowResult(null)} className="text-xs text-gray-400 mt-2 hover:text-white">Fechar</button>
        </div>
      )}

      {/* Enchantments List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="game-card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="game-card p-12 text-center">
          <div className="text-5xl mb-3">✨</div>
          <div className="text-gray-400">Nenhum encantamento disponivel</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ench) => {
            const slotInfo = SLOT_LABELS[ench.slot] || { icon: "✨", label: ench.slot, color: "#9ca3af" };
            const nextLevel = Math.min(ench.currentLevel + 1, ench.maxLevel);
            const cost = nextLevel <= ench.maxLevel
              ? { gold: ench.costPerLevel.gold * nextLevel, crystals: ench.costPerLevel.crystals * nextLevel }
              : { gold: 0, crystals: 0 };
            const chance = ench.currentLevel < ench.maxLevel ? ench.successChance[ench.currentLevel] : 1;
            const canAfford = gold >= cost.gold && crystals >= cost.crystals;
            const isMaxed = ench.currentLevel >= ench.maxLevel;
            const currentEffect = ench.effects.find((e) => e.level === ench.currentLevel);
            const nextEffect = ench.effects.find((e) => e.level === nextLevel);

            return (
              <div key={ench.id} className={`game-card p-4 ${ench.currentLevel > 0 ? "border-[#a855f7]/30" : ""}`}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="text-3xl w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg shrink-0">
                    {ench.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{ench.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: slotInfo.color + "20", color: slotInfo.color }}>
                        {slotInfo.icon} {slotInfo.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{ench.description}</p>

                    {/* Level Bar */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-xs text-gray-400">Nivel:</div>
                      <div className="flex gap-1">
                        {Array.from({ length: ench.maxLevel }).map((_, i) => (
                          <div key={i} className={`w-5 h-2 rounded-full transition ${
                            i < ench.currentLevel ? "bg-[#a855f7]" : "bg-white/10"
                          }`} />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-[#a855f7]">{ench.currentLevel}/{ench.maxLevel}</span>
                    </div>

                    {/* Current Effect */}
                    {currentEffect && (
                      <div className="text-[10px] text-[#a855f7] mt-1 font-bold">
                        Atual: {currentEffect.label}
                      </div>
                    )}
                  </div>

                  {/* Enchant Button */}
                  <div className="text-right shrink-0">
                    {isMaxed ? (
                      <div className="text-xs text-[#a855f7] font-bold">MAX</div>
                    ) : (
                      <>
                        <div className="text-[10px] text-gray-400 mb-1">
                          Próximo: <span className="text-[#a855f7] font-bold">{nextEffect?.label}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1">
                          💰 {cost.gold.toLocaleString()} 🔮 {cost.crystals}
                        </div>
                        <div className="text-[10px] mb-1.5">
                          <span className={chance >= 0.8 ? "text-[#22c55e]" : chance >= 0.5 ? "text-[#f59e0b]" : "text-[#e94560]"}>
                            {Math.round(chance * 100)}% chance
                          </span>
                        </div>
                        <button
                          onClick={() => enchant(ench.id, nextLevel)}
                          disabled={enchanting === ench.id || !canAfford}
                          className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition ${
                            canAfford
                              ? "bg-gradient-to-r from-[#a855f7] to-[#3b82f6] text-white hover:opacity-90 active:scale-95"
                              : "bg-white/5 text-gray-600 cursor-not-allowed"
                          }`}>
                          {enchanting === ench.id ? "..." : "✨ Encantar"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* All Levels Preview */}
                {ench.currentLevel > 0 && !isMaxed && (
                  <div className="mt-3 pt-2 border-t border-white/5">
                    <div className="text-[10px] text-gray-500 mb-1">Efeitos por nivel:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ench.effects.map((eff) => (
                        <span key={eff.level} className={`text-[9px] px-1.5 py-0.5 rounded ${
                          eff.level <= ench.currentLevel
                            ? "bg-[#a855f7]/20 text-[#a855f7] font-bold"
                            : "bg-white/5 text-gray-500"
                        }`}>
                          Lv.{eff.level}: {eff.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
