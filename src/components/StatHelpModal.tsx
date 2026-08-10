"use client";
import { t } from "@/i18n";

/**
 * Guia de Status — explica o que cada status representa e como ele sinergiza
 * com os outros. Abre a partir dos painéis de Atributos / Sistema de Status.
 */
export interface StatHelpEntry {
  id: string;
  /** Chave i18n do nome (ex.: "stat.attack"). */
  nameKey: string;
  /** Imagem do atributo (fallback para emoji caso vazio). */
  image: string;
  emoji: string;
  color: string;
}

export const STAT_HELP_ENTRIES: StatHelpEntry[] = [
  { id: "attack",    nameKey: "stat.attack",    image: "/images/attributes/attr_ataque.png",    emoji: "⚔️", color: "#ff6b6b" },
  { id: "defense",   nameKey: "stat.defense",   image: "/images/attributes/attr_defesa.png",    emoji: "🛡️", color: "#3b82f6" },
  { id: "speed",     nameKey: "stat.speed",     image: "/images/attributes/attr_velocidade.png", emoji: "⚡", color: "#4ecdc4" },
  { id: "hp",        nameKey: "stat.hp",        image: "", emoji: "❤️", color: "#22c55e" },
  { id: "mana",      nameKey: "stat.mana",      image: "", emoji: "🔮", color: "#00d4ff" },
  { id: "critical",  nameKey: "stat.critical",  image: "/images/attributes/attr_critico.png",   emoji: "🎯", color: "#ffd700" },
  { id: "precision", nameKey: "stat.precision", image: "/images/attributes/attr_precisao.png",  emoji: "◎", color: "#a855f7" },
  { id: "dodge",     nameKey: "stat.dodge",     image: "/images/attributes/attr_esquiva.png",   emoji: "💨", color: "#ec4899" },
  { id: "resistance", nameKey: "stat.resistance", image: "/images/attributes/attr_resistencia.png", emoji: "🛡️", color: "#22c55e" },
  { id: "power",     nameKey: "stat.power",     image: "", emoji: "💪", color: "#ff9f43" },
];

/** Fim da lista = entrada final (Poder, que é calculado, não alocado). */
const POWER_INDEX = STAT_HELP_ENTRIES.length - 1;

export default function StatHelpModal({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="game-card p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-2xl font-black">📖 {t("statinfo.title", locale)}</h3>
          <button
            onClick={onClose}
            className="game-btn text-xs font-bold px-3 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          {t("statinfo.subtitle", locale)}
        </p>

        <div className="space-y-2.5">
          {STAT_HELP_ENTRIES.map((s, i) => {
            const isPower = i === POWER_INDEX;
            return (
              <div
                key={s.id}
                className={`rounded-xl border border-white/10 bg-white/5 p-3 ${
                  isPower ? "bg-[#ff9f43]/5 border-[#ff9f43]/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="stat-icon" style={{ background: `${s.color}20` }}>
                    {s.image ? (
                      <img src={s.image} alt={t(s.nameKey, locale)} className="w-7 h-7 object-contain" />
                    ) : (
                      <span className="text-lg leading-none">{s.emoji}</span>
                    )}
                  </div>
                  <div className="font-black text-white text-sm" style={{ color: s.color }}>
                    {t(s.nameKey, locale)}
                  </div>
                  {isPower && (
                    <span className="ml-auto text-[9px] font-black uppercase tracking-wide text-[#ff9f43] px-2 py-0.5 rounded-full bg-[#ff9f43]/15 border border-[#ff9f43]/40">
                      {t("statinfo.calculated", locale)}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold text-gray-400 leading-relaxed">
                    {t("statinfo.what", locale)}
                  </div>
                  <p className="text-[12px] text-gray-200 leading-relaxed">
                    {t(`statinfo.${s.id}.desc`, locale)}
                  </p>
                  <div
                    className={`text-[11px] font-black uppercase tracking-wide mt-1.5 ${
                      isPower ? "text-[#ff9f43]" : "text-[#00ff88]"
                    }`}
                  >
                    🔗 {t("statinfo.synergy", locale)}
                  </div>
                  <p className="text-[12px] text-gray-300 leading-relaxed">
                    {t(`statinfo.${s.id}.synergy`, locale)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full game-btn text-sm font-black py-2 rounded-xl"
        >
          {t("statinfo.close", locale)}
        </button>
      </div>
    </div>
  );
}