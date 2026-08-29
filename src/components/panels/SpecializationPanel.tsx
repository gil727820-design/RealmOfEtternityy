"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { CLASS_ICONS, type ClassName } from "@/game/constants";

interface SpecUI {
  id: string;
  cls: string;
  nameKey: string;
  descKey: string;
  icon: string;
  attackPct?: number;
  defensePct?: number;
  maxHpPct?: number;
  critical?: number;
  speed?: number;
  xpMult?: number;
  goldMult?: number;
  mechanic: string;
}

export default function SpecializationPanel() {
  const { characterId, locale, notify, setCharacter, character } = useGameStore();
  const [specs, setSpecs] = useState<SpecUI[]>([]);
  const [active, setActive] = useState<SpecUI | null>(null);
  const [changeCost, setChangeCost] = useState(25000);
  const [minLevel, setMinLevel] = useState(20);
  const [busy, setBusy] = useState(false);

  const cls = (character?.classType as string) || "warrior";

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/game?action=specialization&characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setSpecs(Array.isArray(d.specs) ? d.specs : []);
      setActive(d.active ?? null);
      setChangeCost(Number(d.changeCost) || 25000);
      setMinLevel(Number(d.minLevel) || 20);
    } catch { /* ignore */ }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const choose = async (spec: SpecUI) => {
    if (!characterId || busy) return;
    // Troca paga — confirma.
    if (active && active.id !== spec.id) {
      if (!window.confirm(`${t("spec.confirm", locale)} (${changeCost.toLocaleString()} 🪙)?`)) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/game?action=specialization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, specId: spec.id }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else {
        notify(`🎯 ${t("spec.chosen", locale)}: ${t(spec.nameKey, locale)}`, "success");
        if (d.character) setCharacter(d.character);
        await load();
      }
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(false);
  };

  const buffText = (s: SpecUI): string => {
    const parts: string[] = [];
    if (s.attackPct) parts.push(`⚔️ +${s.attackPct}%`);
    if (s.defensePct) parts.push(`🛡️ +${s.defensePct}%`);
    if (s.maxHpPct) parts.push(`❤️ +${s.maxHpPct}%`);
    if (s.critical) parts.push(`💥 +${s.critical}`);
    if (s.speed) parts.push(`👟 +${s.speed}`);
    if (s.xpMult) parts.push(`✨ +${Math.round((s.xpMult - 1) * 100)}% XP`);
    if (s.goldMult) parts.push(`🪙 +${Math.round((s.goldMult - 1) * 100)}% ouro`);
    return parts.join(" · ");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">{CLASS_ICONS[cls as ClassName] || "🎯"}</span>
        <span className="bg-gradient-to-r from-[#ffd700] to-[#f97316] bg-clip-text text-transparent">
          {t("spec.title", locale)}
        </span>
      </h2>

      {/* Atual */}
      <div className="game-card p-5 text-center">
        <div className="text-xs text-gray-500 mb-1">{t("spec.current", locale)}</div>
        {active ? (
          <div>
            <div className="text-5xl mb-2 animate-float">{active.icon}</div>
            <div className="font-black text-white text-lg">{t(active.nameKey, locale)}</div>
            <div className="text-[11px] text-gray-400 mt-1">{t(active.descKey, locale)}</div>
            <div className="text-[11px] text-[#ffd700] mt-1">{buffText(active)}</div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-3">
            {t("spec.none", locale)}<br />
            <span className="text-xs">{t("spec.firstFree", locale)}</span>
          </div>
        )}
      </div>

      {/* Opções da classe */}
      <div className="grid md:grid-cols-3 gap-4">
        {specs.map((s) => {
          const isActive = active?.id === s.id;
          const canChoose = !active || active.id === s.id;
          const levelOk = (character?.level as number) >= minLevel;
          const goldOk = (character?.gold as number) >= changeCost;
          const blocked = !!(active && !isActive && (!levelOk || !goldOk));
          return (
            <div key={s.id} className={`game-card p-5 flex flex-col items-center text-center gap-2 ${isActive ? "border-[#ffd700]/60 shadow-[0_0_20px_rgba(255,215,0,0.15)]" : ""}`}>
              <div className="text-5xl">{s.icon}</div>
              <div className="font-black text-white">{t(s.nameKey, locale)}</div>
              <div className="text-[11px] text-gray-400 flex-1">{t(s.descKey, locale)}</div>
              <div className="text-[11px] text-[#ffd700]">{buffText(s)}</div>
              <div className="text-[10px] text-gray-500">{t(s.mechanic, locale)}</div>
              {isActive ? (
                <span className="text-xs font-black text-[#ffd700]">✅ {t("spec.current", locale)}</span>
              ) : (
                <button
                  onClick={() => choose(s)}
                  disabled={busy || blocked}
                  className={`w-full py-2.5 text-sm font-black rounded-xl ${blocked
                    ? "bg-white/10 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#ffd700] to-[#f97316] text-black hover:opacity-90"}`}
                >
                  {busy ? t("forge.busy", locale) : active ? `🔄 ${t("spec.change", locale)} (${changeCost.toLocaleString()} 🪙)` : `🎯 ${t("spec.choose", locale)}`}
                </button>
              )}
              {blocked && (
                <div className="text-[9px] text-red-400">
                  {!levelOk ? `${t("spec.levelReq", locale)}: ${minLevel}` : `${t("spec.goldReq", locale)}: ${changeCost.toLocaleString()}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
