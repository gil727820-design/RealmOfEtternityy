"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { PET_RARITY_ORDER, PET_MAX_LEVEL, petStars } from "@/game/pets";

/** Cor por raridade (comum → divino). */
const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ef4444",
  divine: "#fbbf24",
};

export default function PetsPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [pets, setPets] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/pets?characterId=${characterId}`);
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro ao carregar pets", "error");
        return;
      }
      setPets(d.pets || []);
      setCatalog(d.catalog || []);
      setActiveId(d.activePetId || null);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const refreshChar = async () => {
    try {
      const r = await fetch(`/api/character/${characterId}`);
      const d = await r.json();
      if (d.character) setCharacter(d.character);
    } catch {
      /* ignora */
    }
  };

  const equip = async (id: string) => {
    setBusyId(id);
    try {
      const r = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "equip", petId: id }),
      });
      const d = await r.json();
      if (!r.ok) {
        notify(d.error || "Erro", "error");
        return;
      }
      setActiveId(id);
      notify("🐾 Pet equipado!", "success");
      refreshChar();
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setBusyId(null);
    }
  };

  if (!character) return null;

  const activePet = pets.find((p) => p.id === activeId) || null;

  const fmtBuff = (b: any) => {
    const parts: string[] = [];
    if (b.damagePct) parts.push(`⚔️ +${b.damagePct}% dano`);
    if (b.xpPct) parts.push(`✨ +${b.xpPct}% XP`);
    if (b.defensePct) parts.push(`🛡️ +${b.defensePct}% defesa`);
    if (b.goldPct) parts.push(`🪙 +${b.goldPct}% ouro`);
    if (b.maxHpPct) parts.push(`❤️ +${b.maxHpPct}% vida`);
    if (b.critPct) parts.push(`💥 +${b.critPct}% crítico`);
    if (b.revive) parts.push(`🔥 revive 1x por batalha`);
    return parts;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#22d3ee] to-[#a855f7] border border-[#22d3ee]/50 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.4)] animate-float">
            <span className="text-2xl">🐾</span>
          </div>
          <div>
            <h2 className="text-3xl font-black">{t("pets.title", locale)}</h2>
            <p className="text-gray-500 text-sm mt-0.5">{t("pets.subtitle", locale)}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 transition"
        >
          🔄 {t("general.refresh", locale)}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22d3ee]" />
        </div>
      ) : (
        <>
          {/* Pet ativo */}
          <div className="game-card p-5">
            {activePet ? (
              <div
                className="relative overflow-hidden rounded-2xl border p-5 flex flex-wrap items-center gap-5"
                style={{
                  background: "linear-gradient(120deg, rgba(34,211,238,0.1), rgba(168,85,247,0.12))",
                  borderColor: `${RARITY_COLORS[activePet.rarity]}66`,
                  boxShadow: `0 0 25px ${RARITY_COLORS[activePet.rarity]}22`,
                }}
              >
                <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-5xl animate-float shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                  {activePet.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black">{t(activePet.nameKey, locale)}</h3>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{ color: RARITY_COLORS[activePet.rarity], borderColor: `${RARITY_COLORS[activePet.rarity]}66`, background: `${RARITY_COLORS[activePet.rarity]}11` }}
                    >
                      {t(`pet.rarity.${activePet.rarity}`, locale)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{t(activePet.desc, locale)}</div>
                  <div className="text-sm font-black mt-2 text-[#22d3ee]">
                    {t("pets.level", locale)} {activePet.level}/{PET_MAX_LEVEL}
                    {" ★".repeat(petStars(activePet.level))}
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden mt-1 max-w-xs">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] transition-all duration-500"
                      style={{ width: `${Math.min(100, (activePet.xp / Math.max(1, activePet.xpToNext)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {t("pets.xp", locale)}: {activePet.xp}/{activePet.xpToNext}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fmtBuff(activePet.buffs).map((b, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-[#22d3ee]">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-[#22d3ee]/15 border border-[#22d3ee]/50 text-[#22d3ee]">
                  ✅ {t("pets.equipped", locale)}
                </span>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                🐾 {t("pets.noneEquipped", locale)}
              </div>
            )}
          </div>

          {/* Minha coleção */}
          <div className="game-card p-5">
            <h3 className="text-sm font-bold text-[#22d3ee] mb-3">{t("pets.myCollection", locale)}</h3>
            {pets.length === 0 ? (
              <div className="text-xs text-gray-500 py-4 text-center">{t("pets.noPets", locale)}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pets.map((p) => {
                  const isActive = p.id === activeId;
                  const color = RARITY_COLORS[p.rarity] || "#9ca3af";
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all ${isActive ? "bg-gradient-to-br from-[#22d3ee]/10 to-[#a855f7]/10" : "bg-white/5"} `}
                      style={{ borderColor: isActive ? `${color}88` : "rgba(255,255,255,0.1)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-3xl">
                          {p.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{t(p.nameKey, locale)}</div>
                          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
                            {t(`pet.rarity.${p.rarity}`, locale)}
                          </div>
                          <div className="text-xs text-[#22d3ee] font-bold mt-0.5">
                            {t("pets.level", locale)} {p.level} {"★".repeat(petStars(p.level))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {fmtBuff(p.buffs).map((b, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 border border-white/10 text-gray-300">
                            {b}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => equip(p.id)}
                        disabled={busyId === p.id || isActive}
                        className={`mt-3 w-full py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isActive
                            ? "border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee] opacity-70 cursor-default"
                            : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 hover:border-[#22d3ee]/50"
                        }`}
                      >
                        {isActive ? "✅ " + t("pets.equipped", locale) : t("pets.equip", locale)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Catálogo (não possuídos) */}
          <div className="game-card p-5">
            <h3 className="text-sm font-bold text-gray-300 mb-1">{t("pets.catalog", locale)}</h3>
            <p className="text-[10px] text-gray-500 mb-3">{t("pets.catalogHint", locale)}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {catalog
                .filter((c) => !pets.some((p) => p.id === c.id))
                .map((c) => {
                  const color = RARITY_COLORS[c.rarity] || "#9ca3af";
                  return (
                    <div key={c.id} className="p-3 rounded-xl border border-white/10 bg-black/30 opacity-60 text-center">
                      <div className="text-3xl mb-1 grayscale">{c.icon}</div>
                      <div className="text-xs font-bold truncate">{t(c.nameKey, locale)}</div>
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>
                        {t(`pet.rarity.${c.rarity}`, locale)}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-1">🔒 {t("pets.locked", locale)}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Como funciona */}
          <div className="game-card p-5">
            <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ {t("pets.howTo", locale)}</h3>
            <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
              <li>{t("pets.how1", locale)}</li>
              <li>{t("pets.how2", locale)}</li>
              <li>{t("pets.how3", locale)}</li>
              <li>{t("pets.how4", locale)}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
