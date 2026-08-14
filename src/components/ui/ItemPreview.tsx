"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import ItemIcon from "@/components/ui/ItemIcon";

/** Traduz uma raridade para rótulo amigável. */
function rarityLabel(rarity: string | undefined, locale: string): string {
  if (!rarity) return "—";
  const key = `rarity.${rarity}`;
  const label = t(key, locale);
  return label === key ? rarity : label;
}

function itemName(template: any, locale: string): string {
  return template?.nameKey ? t(template.nameKey, locale) : "Item";
}

/** Ordem dos status de equipamento exibidos. */
const STATS: Array<{ key: string; icon: string; labelKey: string }> = [
  { key: "attack", icon: "⚔️", labelKey: "stat.attack" },
  { key: "defense", icon: "🛡️", labelKey: "stat.defense" },
  { key: "hp", icon: "❤️", labelKey: "stat.hp" },
  { key: "mana", icon: "💧", labelKey: "stat.mana" },
  { key: "speed", icon: "👟", labelKey: "stat.speed" },
  { key: "critical", icon: "💥", labelKey: "stat.critical" },
];

/** Status de consumível (efeitos). */
const EFFECTS: Array<{ key: string; icon: string; labelKey: string }> = [
  { key: "hp", icon: "❤️", labelKey: "eff.hp" },
  { key: "mana", icon: "💧", labelKey: "eff.mana" },
  { key: "energy", icon: "⚡", labelKey: "eff.energy" },
  { key: "xp", icon: "⭐", labelKey: "eff.xp" },
  { key: "boostXpHours", icon: "🚀", labelKey: "eff.boostXpHours" },
  { key: "boostEnergyHours", icon: "🔋", labelKey: "eff.boostEnergyHours" },
];

const SLOT_ICON: Record<string, string> = {
  weapon: "⚔️", shield: "🛡️", helmet: "⛑️", armor: "🦺", pants: "👖",
  boots: "👢", gloves: "🧤", ring: "💍", amulet: "📿", relic: "🔮", artifact: "🗿",
};

export interface PreviewItem {
  template?: any;
  quantity?: number;
}

/** Modal de pré-visualização: mostra todos os status do item. */
export function ItemPreviewModal({
  item,
  locale,
  onClose,
}: {
  item: PreviewItem | null;
  locale: string;
  onClose: () => void;
}) {
  if (!item) return null;
  const tpl = item.template || {};
  const isConsumable = tpl.type === "consumable";
  const rarityHex = RARITY_COLORS[tpl.rarity] as string | undefined;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fadeIn game-card flex w-full max-w-sm flex-col gap-3 p-4"
        style={{ borderColor: rarityHex ? `${rarityHex}88` : "#ffffff33", boxShadow: rarityHex ? `0 0 40px ${rarityHex}44` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border bg-bg-card"
            style={{ borderColor: rarityHex ?? "#ffffff33" }}
          >
            <ItemIcon template={tpl} className="h-12 w-12 object-contain" emojiClass="text-4xl" alt="" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black text-gray-100">{itemName(tpl, locale)}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full px-2 py-0.5 font-bold text-white" style={{ background: rarityHex ?? "#3b4252" }}>
                {rarityLabel(tpl.rarity, locale)}
              </span>
              {tpl.minLevel > 1 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-300">
                  Lv {tpl.minLevel}
                </span>
              )}
              {isConsumable ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-300">🧪 Consumível</span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-300">
                  {SLOT_ICON[tpl.slot] ?? "❔"} {t(`slot.${tpl.slot}`, locale)}
                </span>
              )}
              {tpl.classReq && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-300">{tpl.classReq}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-400 hover:bg-white/15 hover:text-white">
            ✕
          </button>
        </div>

        {/* Status de equipamento */}
        {!isConsumable ? (
          <div className="flex flex-col gap-1.5">
            {(STATS.some((s) => Number(tpl[s.key]) > 0) ? STATS : STATS.slice(0, 2)).map((s) => {
              const v = Number(tpl[s.key]) || 0;
              if (v <= 0) return null;
              return (
                <div key={s.key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
                  <span className="text-gray-400">
                    {s.icon} {t(s.labelKey, locale)}
                  </span>
                  <span className="font-bold text-green-400">+{v}</span>
                </div>
              );
            })}
            {(tpl.attack || 0) <= 0 && (tpl.defense || 0) <= 0 && (tpl.hp || 0) <= 0 && (
              <p className="text-[11px] text-gray-500">Este item não concede status diretos.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {EFFECTS.map((e) => {
              const v = tpl.effect?.[e.key];
              if (v === undefined || v === null || v === 0) return null;
              const num = Number(v);
              const fmtV = num.toLocaleString("pt-BR");
              const label =
                e.key === "hp" || e.key === "mana" || e.key === "energy"
                  ? `+${fmtV}`
                  : e.key === "xp"
                    ? `+${num}%`
                    : `+${fmtV}h`;
              const raw = t(e.labelKey, locale);
              const text = raw.includes("{0}") ? raw.replace("{0}", label.replace(/^\+/, "")) : raw;
              return (
                <div key={e.key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
                  <span className="text-gray-400">
                    {e.icon} {text}
                  </span>
                  <span className="font-bold text-green-400">{label}</span>
                </div>
              );
            })}
            {tpl.legend && <p className="text-[10px] italic text-gray-500">{tpl.legend}</p>}
          </div>
        )}

        {/* Descrição */}
        {tpl.descKey && (
          <p className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
            {t(tpl.descKey, locale)}
          </p>
        )}

        <button onClick={onClose} className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#7c5cfc] to-[#e94560] py-2 text-xs font-black text-white hover:brightness-110">
          Fechar
        </button>
      </div>
    </div>
  );
}

/**
 * Chip clicável de item: ícone + nome (+ quantidade). Ao clicar, abre o modal
 * de pré-visualização com todos os status. Reutilizado em anúncios e salas.
 */
export function ItemChip({
  item,
  locale,
  compact = false,
}: {
  item: PreviewItem;
  locale: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tpl = item.template || {};
  const rarityHex = RARITY_COLORS[tpl.rarity] as string | undefined;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ver status do item"
        className={`inline-flex items-center gap-1.5 rounded-lg border bg-white/5 text-gray-200 transition-all hover:bg-white/15 hover:brightness-110 ${
          compact ? "px-1.5 py-1" : "px-2 py-1"
        }`}
        style={rarityHex ? { borderColor: `${rarityHex}66` } : { borderColor: "#ffffff22" }}
      >
        <ItemIcon template={tpl} className="h-6 w-6 object-contain" emojiClass="text-base" alt="" />
        <span className="text-[10px] font-semibold">{itemName(tpl, locale)}{item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}</span>
      </button>
      <ItemPreviewModal item={open ? item : null} locale={locale} onClose={() => setOpen(false)} />
    </>
  );
}
