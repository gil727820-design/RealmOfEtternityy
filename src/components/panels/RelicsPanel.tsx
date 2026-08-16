"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RELICS, type RelicDef } from "@/game/relics";

interface RelicOwned {
  itemId: string;
  equipped: boolean;
  def: RelicDef | null;
}

export default function RelicsPanel() {
  const { characterId, locale, notify, setCharacter } = useGameStore();
  const [owned, setOwned] = useState<RelicOwned[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/relics?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setOwned(Array.isArray(d.relics) ? d.relics : []);
      setActiveId(d.activeRelicId ?? null);
    } catch { /* ignore */ }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (itemId: string, def: RelicDef, equipped: boolean) => {
    if (!characterId) return;
    setBusy(itemId);
    try {
      const res = await fetch("/api/relics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, itemId, action: equipped ? "unequip" : "equip" }),
      });
      const d = await res.json();
      if (!res.ok) { notify(d.error || "Erro", "error"); }
      else {
        notify(equipped
          ? `🚫 ${t("relic.unequipped", locale)}`
          : `🗿 ${t("relic.equipped", locale)}: ${t(def.nameKey, locale)}`, equipped ? "info" : "success");
        if (d.character) setCharacter(d.character);
        await load();
      }
    } catch { notify(t("general.error", locale), "error"); }
    setBusy(null);
  };

  const buffText = (r: RelicDef): string => {
    const parts: string[] = [];
    if (r.attackPct) parts.push(`⚔️ +${r.attackPct}%`);
    if (r.defensePct) parts.push(`🛡️ +${r.defensePct}%`);
    if (r.maxHpPct) parts.push(`❤️ +${r.maxHpPct}%`);
    if (r.speed) parts.push(`👟 +${r.speed}`);
    if (r.critical) parts.push(`💥 +${r.critical}`);
    if (r.xpMult) parts.push(`✨ +${Math.round((r.xpMult - 1) * 100)}% XP`);
    if (r.goldMult) parts.push(`🪙 +${Math.round((r.goldMult - 1) * 100)}% ouro`);
    return parts.join(" · ");
  };

  const ownedDefs = owned.map((o) => o.def).filter(Boolean) as RelicDef[];
  const ownedIds = new Set(ownedDefs.map((d) => d.id));

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <span className="text-4xl">🗿</span>
        <span className="bg-gradient-to-r from-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
          {t("relic.title", locale)}
        </span>
      </h2>

      {/* Relíquia equipada */}
      <div className="game-card p-5 text-center">
        <div className="text-xs text-gray-500 mb-1">{t("relic.equipped", locale)}</div>
        {(() => {
          const active = owned.find((o) => o.equipped) || null;
          if (!active?.def) return <div className="text-gray-500 text-sm py-3">— {t("relic.none", locale)} —</div>;
          return (
            <div>
              <div className="text-5xl mb-2 animate-float">{active.def.icon}</div>
              <div className="font-black text-white">{t(active.def.nameKey, locale)}</div>
              <div className="text-[11px] text-gray-400 mt-1">{buffText(active.def)}</div>
            </div>
          );
        })()}
      </div>

      {/* Minhas relíquias */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-gray-300 mb-3">🎒 {t("relic.mine", locale)}</h3>
        {owned.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-6">{t("relic.empty", locale)}</div>
        ) : (
          <div className="space-y-2">
            {owned.map((o) => o.def && (
              <div key={o.itemId} className={`flex items-center justify-between bg-[#0a0a12] rounded-xl px-4 py-3 border ${o.equipped ? "border-[#a855f7]/50" : "border-white/10"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl">{o.def.icon}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm">{t(o.def.nameKey, locale)}</div>
                    <div className="text-[11px] text-gray-500">{t(`rarity.${o.def.rarity}`, locale)}</div>
                    <div className="text-[10px] text-gray-400">{buffText(o.def)}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(o.itemId, o.def!, !!o.equipped)}
                  disabled={busy === o.itemId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 shrink-0 disabled:opacity-40 ${o.equipped
                    ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                    : "bg-[#a855f7]/20 text-[#c084fc] border border-[#a855f7]/40 hover:bg-[#a855f7]/30"}`}
                >
                  {busy === o.itemId ? "…" : o.equipped ? `🚫 ${t("relic.unequip", locale)}` : `🗿 ${t("relic.equip", locale)}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catálogo */}
      <div className="game-card p-5">
        <h3 className="font-bold text-sm text-gray-300 mb-3">📚 {t("relic.catalog", locale)}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {RELICS.map((r) => {
            const has = ownedIds.has(r.id);
            return (
              <div key={r.id} className={`rounded-xl border p-3 text-center ${has ? "border-[#a855f7]/40 bg-[#a855f7]/5" : "border-white/10 bg-[#0a0a12] opacity-50 grayscale"}`}>
                <div className="text-3xl mb-1">{r.icon}</div>
                <div className="text-[10px] font-bold text-white truncate">{t(r.nameKey, locale)}</div>
                <div className="text-[9px] text-gray-500">{t(`rarity.${r.rarity}`, locale)}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{buffText(r)}</div>
                <div className="text-[9px] mt-1">{has ? "✅" : "🔒"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
