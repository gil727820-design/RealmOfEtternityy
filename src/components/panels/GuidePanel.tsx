"use client";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

/**
 * Guia "Como Jogar": explica os sistemas principais em seções rápidas,
 * com dica de desbloqueio de cada área. Conteúdo estático localizado.
 */
export default function GuidePanel() {
  const { locale, setTab } = useGameStore();

  const sections: Array<{ icon: string; titleKey: string; lines: string[] }> = [
    {
      icon: "📜",
      titleKey: "guide.missions",
      lines: [
        "guide.missions.l1",
        "guide.missions.l2",
        "guide.missions.l3",
      ],
    },
    {
      icon: "🗼",
      titleKey: "guide.tower",
      lines: ["guide.tower.l1", "guide.tower.l2", "guide.tower.l3", "guide.tower.l4"],
    },
    {
      icon: "⚔️",
      titleKey: "guide.pvp",
      lines: ["guide.pvp.l1", "guide.pvp.l2", "guide.pvp.l3"],
    },
    {
      icon: "🔨",
      titleKey: "guide.forge",
      lines: ["guide.forge.l1", "guide.forge.l2", "guide.forge.l3"],
    },
    {
      icon: "💤",
      titleKey: "guide.afk",
      lines: ["guide.afk.l1", "guide.afk.l2"],
    },
    {
      icon: "🏪",
      titleKey: "guide.market",
      lines: ["guide.market.l1", "guide.market.l2", "guide.market.l3"],
    },
    {
      icon: "🌟",
      titleKey: "guide.prestige",
      lines: ["guide.prestige.l1", "guide.prestige.l2"],
    },
    {
      icon: "🏅",
      titleKey: "guide.achievements",
      lines: ["guide.achievements.l1", "guide.achievements.l2"],
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">📖</span>
        <span className="bg-gradient-to-r from-[#4ecdc4] to-[#ffd700] bg-clip-text text-transparent">
          {t("guide.title", locale)}
        </span>
      </h2>
      <p className="text-sm text-gray-400 max-w-2xl">{t("guide.subtitle", locale)}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.titleKey} className="game-card p-5">
            <h3 className="font-black text-lg mb-2 flex items-center gap-2">
              <span>{s.icon}</span> {t(s.titleKey, locale)}
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-400 leading-relaxed">
              {s.lines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-[#4ecdc4] shrink-0">▸</span>
                  <span>{t(line, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="game-card p-5 border-[#4ecdc4]/40">
        <h3 className="font-black text-lg mb-2">🎯 {t("guide.tipsTitle", locale)}</h3>
        <ul className="space-y-1.5 text-xs text-gray-400 leading-relaxed">
          <li className="flex gap-2"><span className="text-[#4ecdc4] shrink-0">▸</span>{t("guide.tips.1", locale)}</li>
          <li className="flex gap-2"><span className="text-[#4ecdc4] shrink-0">▸</span>{t("guide.tips.2", locale)}</li>
          <li className="flex gap-2"><span className="text-[#4ecdc4] shrink-0">▸</span>{t("guide.tips.3", locale)}</li>
          <li className="flex gap-2"><span className="text-[#4ecdc4] shrink-0">▸</span>{t("guide.tips.4", locale)}</li>
        </ul>
      </div>
    </div>
  );
}
