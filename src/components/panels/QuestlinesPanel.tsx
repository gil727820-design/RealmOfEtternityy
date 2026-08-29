"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";

type QuestStep = {
  id: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  reward: { gold?: number; crystals?: number; xp?: number; diamonds?: number };
  done: boolean;
  canClaim: boolean;
};

type Questline = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: string;
  steps: QuestStep[];
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  finalReward: { gold?: number; crystals?: number; diamonds?: number; title?: string; skin?: string };
};

const DIFF_COLORS: Record<string, string> = {
  normal: "#22c55e",
  hard: "#f59e0b",
  epic: "#a855f7",
  legendary: "#e94560",
};

const DIFF_LABELS: Record<string, string> = {
  normal: "Normal",
  hard: "Dificil",
  epic: "Epico",
  legendary: "Lendario",
};

const CAT_ICONS: Record<string, string> = {
  combat: "\u2694\uFE0F",
  exploration: "\u{1F5FA}\uFE0F",
  collection: "\u{1F392}",
  social: "\u{1F465}",
  challenge: "\u{1F3C6}",
};

export default function QuestlinesPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [questlines, setQuestlines] = useState<Questline[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/questlines?characterId=${characterId}`);
      const data = await res.json();
      setQuestlines(data.questlines ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const claimStep = async (stepId: string) => {
    if (!characterId) return;
    setClaiming(stepId);
    try {
      const res = await fetch("/api/questlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "claim_step", stepId }),
      });
      const data = await res.json();
      if (data.success) {
        const parts = [];
        if (data.step?.reward?.gold) parts.push(`💰 +${data.step.reward.gold}`);
        if (data.step?.reward?.crystals) parts.push(`🔮 +${data.step.reward.crystals}`);
        if (data.step?.reward?.xp) parts.push(`✨ +${data.step.reward.xp} XP`);
        if (data.step?.reward?.diamonds) parts.push(`💎 +${data.step.reward.diamonds}`);
        notify(`🎯 Passo concluido! ${parts.join(" ")}`, "success");
        if (data.questlineComplete) {
          notify(`🏆 Questline completa! Recompensas finais coletadas!`, "success");
        }
        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao coletar", "error"); }
    setClaiming(null);
  };

  const completedCount = questlines.filter((q) => q.completed).length;
  const totalQuestlines = questlines.length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#f59e0b]/20 via-[#e94560]/10 to-[#16213e]/40 border border-[#f59e0b]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">📜</span>
            <span className="bg-gradient-to-r from-[#f59e0b] to-[#e94560] bg-clip-text text-transparent">
              Questlines Epicas
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Missoes de longo prazo com recompensas exclusivas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#f59e0b]">{completedCount}</div>
          <div className="text-[10px] text-gray-400 uppercase">Completas</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#e94560]">{totalQuestlines - completedCount}</div>
          <div className="text-[10px] text-gray-400 uppercase">Em Progresso</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#22c55e]">{totalQuestlines}</div>
          <div className="text-[10px] text-gray-400 uppercase">Total</div>
        </div>
      </div>

      {/* Questlines */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
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
      ) : questlines.length === 0 ? (
        <div className="game-card p-12 text-center">
          <div className="text-5xl mb-3">📜</div>
          <div className="text-gray-400">Nenhuma questline disponivel</div>
        </div>
      ) : (
        <div className="space-y-3">
          {questlines.map((ql) => {
            const isExpanded = expandedId === ql.id;
            const diffColor = DIFF_COLORS[ql.difficulty] || "#9ca3af";
            const progress = ql.totalSteps > 0 ? (ql.steps.filter((s) => s.done).length / ql.totalSteps) * 100 : 0;
            const hasClaimable = ql.steps.some((s) => s.canClaim);

            return (
              <div key={ql.id}
                className={`game-card overflow-hidden transition-all ${
                  ql.completed ? "border-[#22c55e]/30" : hasClaimable ? "border-[#f59e0b]/40" : ""
                }`}>
                {/* Header - clickable */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ql.id)}
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{ql.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{ql.name}</span>
                        {ql.completed && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#22c55e]/20 border border-[#22c55e]/40 rounded-full text-[#22c55e] font-bold">
                            COMPLETA
                          </span>
                        )}
                        {hasClaimable && !ql.completed && (
                          <span className="w-2 h-2 bg-[#f59e0b] rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{CAT_ICONS[ql.category] || "📜"} {ql.category}</span>
                        <span className="text-gray-600">•</span>
                        <span style={{ color: diffColor }}>{DIFF_LABELS[ql.difficulty] || ql.difficulty}</span>
                        <span className="text-gray-600">•</span>
                        <span>{ql.steps.filter((s) => s.done).length}/{ql.totalSteps}</span>
                      </div>
                    </div>
                    <div className="text-lg">{isExpanded ? "▲" : "▼"}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: ql.completed
                          ? "linear-gradient(90deg, #22c55e, #4ecdc4)"
                          : `linear-gradient(90deg, ${diffColor}, ${diffColor}88)`
                      }} />
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 space-y-3">
                    {/* Description */}
                    <p className="text-sm text-gray-400">{ql.description}</p>

                    {/* Steps */}
                    <div className="space-y-2">
                      {ql.steps.map((step, idx) => (
                        <div key={step.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg transition ${
                            step.done && step.canClaim
                              ? "bg-[#f59e0b]/10 border border-[#f59e0b]/30"
                              : step.done
                                ? "bg-[#22c55e]/5 border border-[#22c55e]/20"
                                : "bg-white/[0.02] border border-white/5"
                          }`}>
                          {/* Step number */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            step.done ? "bg-[#22c55e] text-white" : "bg-white/10 text-gray-500"
                          }`}>
                            {step.done ? "✓" : idx + 1}
                          </div>

                          {/* Step info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span>{step.icon}</span>
                              <span className={`text-sm font-medium ${step.done ? "text-[#22c55e]" : "text-white"}`}>
                                {step.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500">{step.objective}</div>
                          </div>

                          {/* Reward */}
                          <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            {step.reward.gold ? <span>💰{step.reward.gold}</span> : null}
                            {step.reward.crystals ? <span>🔮{step.reward.crystals}</span> : null}
                            {step.reward.xp ? <span>✨{step.reward.xp}</span> : null}
                            {step.reward.diamonds ? <span>💎{step.reward.diamonds}</span> : null}
                          </div>

                          {/* Action */}
                          {step.canClaim ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); claimStep(step.id); }}
                              disabled={claiming === step.id}
                              className="text-[10px] px-2.5 py-1 bg-gradient-to-r from-[#f59e0b] to-[#e94560] text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition disabled:opacity-50"
                            >
                              {claiming === step.id ? "..." : "🎁 Coletar"}
                            </button>
                          ) : step.done ? (
                            <span className="text-[10px] text-[#22c55e] font-bold">✓</span>
                          ) : (
                            <span className="text-[10px] text-gray-600">🔒</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Final Reward */}
                    <div className={`p-3 rounded-xl border ${
                      ql.completed ? "bg-[#22c55e]/10 border-[#22c55e]/30" : "bg-[#f59e0b]/5 border-[#f59e0b]/20"
                    }`}>
                      <div className="text-xs font-bold text-[#f59e0b] mb-1">🏆 Recompensa Final</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ql.finalReward.gold ? <span className="text-[10px] text-[#ffd700]">💰 {ql.finalReward.gold.toLocaleString()}</span> : null}
                        {ql.finalReward.crystals ? <span className="text-[10px] text-[#06b6d4]">🔮 {ql.finalReward.crystals}</span> : null}
                        {ql.finalReward.diamonds ? <span className="text-[10px] text-[#a855f7]">💎 {ql.finalReward.diamonds}</span> : null}
                        {ql.finalReward.title ? <span className="text-[10px] text-[#fbbf24]">🏅 {ql.finalReward.title}</span> : null}
                      </div>
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
