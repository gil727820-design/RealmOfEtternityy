"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { CLASS_ICONS, CLASS_REPRESENTATIVE, type ClassName } from "@/game/constants";
import {
  skillTreeForClass,
  skillTreeTotalRanks,
} from "@/game/skillTree";
import {
  masteryBuff,
  masteryTitle,
  masteryBuffDesc,
  MASTERY_TOTAL_RANKS,
  MASTERY_BUFFS,
  MASTERY_TITLES,
  isTreeMastered,
} from "@/game/mastery";

function skillName(s: any, locale: string): string {
  if (locale?.toLowerCase().startsWith("en")) return s.name.en;
  if (locale?.toLowerCase().startsWith("es")) return s.name.es;
  return s.name.pt;
}

export default function MasteryPanel() {
  const { character, locale } = useGameStore();
  const [viewClass, setViewClass] = useState<ClassName | "all">("all");

  if (!character) return null;

  const c = character as any;
  const cls = (c.classType as ClassName) || "warrior";
  const tree = skillTreeForClass(cls);
  const invested = (c.skills as Record<string, number> | undefined) ?? {};
  const totalRanks = skillTreeTotalRanks(c);
  const mastery = masteryBuff(c);
  const isMastered = mastery !== null;

  const CLASSES: ClassName[] = [
    "warrior", "paladin", "berserker", "mage", "necromancer",
    "assassin", "hunter", "monk", "samurai", "knight",
    "summoner", "templar", "archer"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fadeInDown">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffd700] to-[#a855f7] border border-[#ffd700]/50 flex items-center justify-center shadow-[0_0_25px_rgba(255,215,0,0.4)] animate-float">
            <span className="text-2xl">👑</span>
          </div>
          <div>
            <h2 className="text-3xl font-black">
              <span className="bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7] bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
                {t("mastery.title", locale)}
              </span>
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              <img src={CLASS_REPRESENTATIVE[cls]} alt={t(`class.${cls}`, locale)} className="w-6 h-6 rounded object-cover inline-block" /> {t(`class.${cls}`, locale)} — {t("mastery.subtitle", locale)}
            </p>
          </div>
        </div>
        {viewClass !== "all" && (
          <button
            onClick={() => setViewClass("all")}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 transition"
          >
            ← {t("mastery.allClasses", locale)}
          </button>
        )}
      </div>

      {/* Sua Maestria (ou progresso) */}
      <div className="game-card p-4 animate-fadeInUp">
        {isMastered ? (
          <div
            className="relative overflow-hidden rounded-xl border p-4"
            style={{
              background: "linear-gradient(120deg, rgba(255,215,0,0.14), rgba(168,85,247,0.14), rgba(255,215,0,0.14))",
              borderColor: "rgba(255,215,0,0.5)",
              boxShadow: "0 0 30px rgba(255,215,0,0.18)",
            }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ffd700] to-[#a855f7] flex items-center justify-center text-3xl animate-float shadow-[0_0_30px_rgba(255,215,0,0.5)]">
                👑
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7] animate-gradient bg-[length:200%_200%]">
                    👑 {masteryTitle(c, locale)}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/50 text-[#ffd700]">
                    {t("mastery.active", locale)}
                  </span>
                </div>
                <p className="text-sm text-[#ffd700]/90 mt-1 font-bold">{masteryBuffDesc(c, locale)}</p>
                <p className="text-[10px] text-[#ffd700]/60 mt-1">
                  {t("mastery.permanentBuff", locale)}
                </p>
              </div>
              <div className="text-right text-[10px] text-[#ffd700]/60">
                <img src={CLASS_REPRESENTATIVE[cls]} alt={t(`class.${cls}`, locale)} className="w-5 h-5 rounded object-cover inline-block" /> {t(`class.${cls}`, locale)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <span>👑</span>
                  <span>{t("mastery.progress", locale)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t("mastery.requiresMaxTree", locale)}
                </div>
              </div>
              <div className="text-[#ffd700]/80 font-black text-lg">
                {Math.min(totalRanks, MASTERY_TOTAL_RANKS)}/{MASTERY_TOTAL_RANKS}
              </div>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#ffd700] transition-all duration-700"
                style={{ width: `${Math.min(100, (totalRanks / MASTERY_TOTAL_RANKS) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
              {tree.map((s, i) => {
                const rank = Number(invested[s.id]) || 0;
                const maxed = rank >= s.maxRank;
                return (
                  <span
                    key={s.id}
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      maxed ? "bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700]" :
                      rank > 0 ? "bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]" :
                      "bg-white/5 border border-white/10 text-gray-500"
                    }`}
                    title={`${skillName(s, locale)}: ${rank}/${s.maxRank}`}
                  >
                    {s.icon} {rank}/{s.maxRank}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Seletor de classe para ver todas as maestrias */}
      <div className="game-card p-4 animate-fadeInUp">
        <h3 className="text-sm font-bold text-[#ffd700] mb-3">{t("mastery.allClasses", locale)}</h3>
        <p className="text-xs text-gray-500 mb-3">{t("mastery.selectClassHint", locale)}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {CLASSES.map((cName) => {
            const cTree = skillTreeForClass(cName);
            const cInvested = (c.skills as Record<string, number> | undefined) ?? {};
            const cTotal = cTree.reduce((sum, s) => sum + (Number(cInvested[s.id]) || 0), 0);
            const cMastered = isTreeMastered({ classType: cName, skills: cInvested });
            const buff = MASTERY_BUFFS[cName];
            const title = MASTERY_TITLES[cName];
            const isCurrent = cName === cls;

            return (
              <button
                key={cName}
                onClick={() => setViewClass(cName)}
                className={`relative p-3 rounded-xl border transition-all text-left ${
                  viewClass === cName
                    ? "border-[#ffd700]/60 bg-gradient-to-br from-[#ffd700]/10 to-[#a855f7]/10 shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                    : cMastered
                      ? "border-[#00ff88]/40 bg-[#00ff88]/5 hover:border-[#00ff88]/60"
                      : isCurrent
                        ? "border-[#a855f7]/40 bg-[#a855f7]/5 hover:border-[#a855f7]/60"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <img src={CLASS_REPRESENTATIVE[cName]} alt={t(`class.${cName}`, locale)} className="w-10 h-10 rounded-lg object-cover border border-white/20" />
                  <span className={`font-bold text-sm ${cMastered ? "text-[#00ff88]" : isCurrent ? "text-[#a855f7]" : "text-white"}`}>
                    {t(`class.${cName}`, locale)}
                  </span>
                  {cMastered && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]">✓</span>}
                  {isCurrent && !cMastered && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#a855f7]/15 border border-[#a855f7]/40 text-[#a855f7]">{t("mastery.yours", locale)}</span>}
                </div>
                <div className="text-[10px] text-gray-400">
                  {cTotal}/{MASTERY_TOTAL_RANKS}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe da classe selecionada */}
      {viewClass !== "all" && (() => {
          const vTree = skillTreeForClass(viewClass);
          const vInvested = viewClass === cls ? invested : {};
          const vTotal = vTree.reduce((sum, s) => sum + (Number(vInvested[s.id]) || 0), 0);
          const vMastered = isTreeMastered({ classType: viewClass, skills: vInvested });
          const vBuff = MASTERY_BUFFS[viewClass];
          const vTitle = MASTERY_TITLES[viewClass];
          const vTitleLoc = locale?.toLowerCase().startsWith("en") ? vTitle.en : locale?.toLowerCase().startsWith("es") ? vTitle.es : vTitle.pt;

          return (
            <div className="game-card p-4 animate-fadeInUp">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                <img src={CLASS_REPRESENTATIVE[viewClass]} alt={t(`class.${viewClass}`, locale)} className="w-10 h-10 rounded-lg object-cover border border-white/20" />
                {t(`class.${viewClass}`, locale)} — {vTitleLoc}
              </h3>

              <div className="relative overflow-hidden rounded-xl border p-4 mb-4" style={{
                background: vMastered
                  ? "linear-gradient(120deg, rgba(255,215,0,0.14), rgba(168,85,247,0.14))"
                  : "linear-gradient(120deg, rgba(168,85,247,0.1), rgba(236,72,153,0.1))",
                borderColor: vMastered ? "rgba(255,215,0,0.5)" : "rgba(168,85,247,0.5)",
                boxShadow: vMastered ? "0 0 20px rgba(255,215,0,0.15)" : "0 0 20px rgba(168,85,247,0.1)",
              }}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ffd700] to-[#a855f7] flex items-center justify-center text-2xl animate-float">
                    👑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7]">
                      👑 {vTitleLoc}
                    </div>
                    <p className="text-sm text-[#ffd700]/90 mt-1 font-bold">
                      {vMastered
                        ? `${vBuff.damageMult > 1 ? `💥 +${Math.round((vBuff.damageMult - 1) * 100)}% dano` : ""} ${vBuff.takenMult < 1 ? `🛡️ -${Math.round((1 - vBuff.takenMult) * 100)}% dano recebido` : ""} ${vBuff.critBonus > 0 ? `🎯 +${vBuff.critBonus}% crítico` : ""}`.trim()
                        : t("mastery.locked", locale)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {vMastered
                        ? t("mastery.permanentBuff", locale)
                        : t("mastery.requiresMaxTree", locale)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {vTree.map((s) => {
                  const rank = Number(vInvested[s.id]) || 0;
                  const maxed = rank >= s.maxRank;
                  return (
                    <div
                      key={s.id}
                      className={`p-2 rounded-lg border text-center text-xs ${
                        maxed ? "border-[#ffd700]/40 bg-[#ffd700]/5" :
                        rank > 0 ? "border-[#00ff88]/40 bg-[#00ff88]/5" :
                        "border-white/10 bg-white/5"
                      }`}
                      title={`${skillName(s, locale)}: ${rank}/${s.maxRank}`}
                    >
                      <div className="text-xl mb-1">{s.icon}</div>
                      <div className="font-bold truncate">{skillName(s, locale)}</div>
                      <div className={`text-[10px] font-bold ${maxed ? "text-[#ffd700]" : rank > 0 ? "text-[#00ff88]" : "text-gray-500"}`}>
                        {rank}/{s.maxRank}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* Como funciona */}
      <div className="game-card p-4 animate-fadeInUp">
        <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ {t("mastery.howTo", locale)}</h3>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
          <li>{t("mastery.how1", locale)}</li>
          <li>{t("mastery.how2", locale)}</li>
          <li>{t("mastery.how3", locale)}</li>
          <li>{t("mastery.how4", locale)}</li>
        </ul>
      </div>
    </div>
  );
}