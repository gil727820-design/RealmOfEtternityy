"use client";

import { useState } from "react";
import { CLASS_LIST, CLASS_BASE_STATS, CLASS_ICONS, CLASS_REPRESENTATIVE, CLASS_IMAGES, type ClassName } from "@/game/constants";
import { t } from "@/i18n";

interface ClassChangeScreenProps {
  currentClass: ClassName;
  cost: number;
  gold: number;
  locale: string;
  onSelect: (newClass: ClassName) => void;
  onBack: () => void;
  changing: boolean;
}

const CLASS_ROLES: Record<ClassName, { role: string; icon: string; desc: string }> = {
  warrior:     { role: "Tank/DPS", icon: "⚔️", desc: "Equilíbrio entre ataque e defesa. Good para iniciantes." },
  paladin:     { role: "Tank/Support", icon: "🛡️", desc: "Alta defesa e HP. Cura aliados e protege o grupo." },
  berserker:   { role: "DPS", icon: "🪓", desc: "DPS puro com alto crítico. Frágil mas devastador." },
  mage:        { role: "DPS Mágico", icon: "🔮", desc: "Alto dano mágico e mana. Frágil fisicamente." },
  necromancer: { role: "DPS/Summon", icon: "💀", desc: "Invoca mortos-vivos e causa dano sombrio." },
  assassin:    { role: "DPS/Assassin", icon: "🗡️", desc: "Críticos letais e alta velocidade. Muito frágil." },
  hunter:      { role: "DPS Ranged", icon: "🏹", desc: "Ataques à distância com alta precisão." },
  monk:        { role: "Tank/DPS", icon: "🥋", desc: "Equilibrado com boa velocidade e defesa." },
  samurai:     { role: "DPS", icon: "⛩️", desc: "Alto ataque e crítico. Equilibrado." },
  knight:      { role: "Tank", icon: "🏰", desc: "Máxima defesa e HP. O tanque definitivo." },
  summoner:    { role: "DPS/Summon", icon: "✨", desc: "Invoca criaturas e causa dano arcano." },
  templar:     { role: "Tank/Support", icon: "✝️", desc: "Defesa alta com suporte. Versátil." },
  archer:      { role: "DPS Ranged", icon: "🎯", desc: "DPS à distância com alta velocidade." },
};

function getStatBar(value: number, max: number): number {
  return Math.min(100, Math.round((value / max) * 100));
}

function getStatColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.6) return "#ffd700";
  if (pct >= 0.4) return "#f59e0b";
  return "#ef4444";
}

export default function ClassChangeScreen({
  currentClass,
  cost,
  gold,
  locale,
  onSelect,
  onBack,
  changing,
}: ClassChangeScreenProps) {
  const [selected, setSelected] = useState<ClassName | null>(null);
  const [sex, setSex] = useState<"male" | "female">("male");

  const maxStats = { hp: 160, attack: 15, defense: 18, speed: 10, mana: 100, critical: 12 };

  const canAfford = gold >= cost;

  return (
    <div className="min-h-[80vh] space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          ←
        </button>
        <div>
          <h2 className="text-2xl font-black text-white">
            <span className="bg-gradient-to-r from-[#ff9500] to-[#ff6b00] bg-clip-text text-transparent">
              Trocar Classe
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Custo: <span className="text-[#ffd700] font-bold">{cost.toLocaleString("pt-BR")} 💰</span>
            {!canAfford && <span className="text-red-400 ml-2">(Ouro insuficiente)</span>}
          </p>
        </div>
      </div>

      {/* Current Class */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-[#ff9500]/30 p-4">
        <div className="flex items-center gap-4">
          <img
            src={CLASS_REPRESENTATIVE[currentClass]}
            alt={t(`class.${currentClass}`, locale)}
            className="w-16 h-16 rounded-xl object-cover border-2 border-[#ff9500]/50"
          />
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Sua Classe Atual</div>
            <div className="text-xl font-black text-white capitalize">{t(`class.${currentClass}`, locale)}</div>
            <div className="text-xs text-[#ff9500]">{CLASS_ROLES[currentClass]?.role}</div>
          </div>
        </div>
      </div>

      {/* Sex Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Ver imagem:</span>
        <button
          onClick={() => setSex("male")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            sex === "male" ? "bg-[#3b82f6] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          ♂ Masculino
        </button>
        <button
          onClick={() => setSex("female")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            sex === "female" ? "bg-[#ec4899] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          ♀ Feminino
        </button>
      </div>

      {/* Class Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CLASS_LIST.filter((cl) => cl !== currentClass).map((cl) => {
          const stats = CLASS_BASE_STATS[cl];
          const role = CLASS_ROLES[cl];
          const isSelected = selected === cl;
          const imgSrc = sex === "male" ? CLASS_IMAGES[cl].male : CLASS_IMAGES[cl].female;

          return (
            <button
              key={cl}
              onClick={() => setSelected(isSelected ? null : cl)}
              disabled={changing}
              className={`relative text-left rounded-2xl border p-4 transition-all ${
                isSelected
                  ? "border-[#ff9500]/60 bg-gradient-to-br from-[#ff9500]/15 to-[#ff6b00]/5 shadow-[0_0_20px_rgba(255,149,0,0.15)]"
                  : "border-white/10 bg-[#1a1a2e] hover:border-white/20 hover:bg-white/5"
              } disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={imgSrc}
                  alt={t(`class.${cl}`, locale)}
                  className="w-14 h-14 rounded-xl object-cover border border-white/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white capitalize">{t(`class.${cl}`, locale)}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ff9500]/15 border border-[#ff9500]/30 text-[#ff9500]">
                      {role?.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{role?.desc}</p>
                </div>
              </div>

              {/* Stats Preview */}
              {isSelected && (
                <div className="mt-3 space-y-2 animate-fadeInDown">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Stats Base</div>
                  {[
                    { key: "hp", label: "❤️ HP", value: stats.hp, max: maxStats.hp },
                    { key: "attack", label: "⚔️ ATK", value: stats.attack, max: maxStats.attack },
                    { key: "defense", label: "🛡️ DEF", value: stats.defense, max: maxStats.defense },
                    { key: "speed", label: "💨 SPD", value: stats.speed, max: maxStats.speed },
                    { key: "mana", label: "💎 MANA", value: stats.mana, max: maxStats.mana },
                    { key: "critical", label: "🎯 CRIT", value: stats.critical, max: maxStats.critical },
                  ].map((stat) => (
                    <div key={stat.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-14">{stat.label}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${getStatBar(stat.value, stat.max)}%`,
                            backgroundColor: getStatColor(stat.value, stat.max),
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-white w-8 text-right">{stat.value}</span>
                    </div>
                  ))}

                  {/* Confirm Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(cl);
                    }}
                    disabled={changing || !canAfford}
                    className={`w-full mt-3 py-2.5 rounded-xl text-sm font-black transition-all border ${
                      canAfford
                        ? "bg-gradient-to-r from-[#ff9500] to-[#ff6b00] text-black border-[#ff9500]/50 hover:brightness-110 active:scale-95"
                        : "bg-white/5 text-gray-500 border-white/10 cursor-not-allowed"
                    }`}
                  >
                    {changing ? "🔄 Trocando..." : `🔄 Trocar para ${t(`class.${cl}`, locale)} (${cost.toLocaleString("pt-BR")} 💰)`}
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl text-sm font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
      >
        ← Voltar ao Dashboard
      </button>
    </div>
  );
}
