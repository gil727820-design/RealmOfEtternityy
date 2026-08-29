"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { MAX_ENHANCE, ENCHANT_COST, enchantPoolForClass, enhanceCost, enhanceChance, enchantById, enchantName } from "@/game/forge";
import ItemIcon from "@/components/ui/ItemIcon";

type ForgeTab = "enhance" | "enchant" | "craft" | "refine";

/** Forja ativa (balanceada: +5% por aprimoramento, custos altos). */
const FORGE_MAINTENANCE = false;

export default function ForgePanel() {
  const { characterId, inventory, locale, notify, setCharacter, setInventory, character } = useGameStore();
  const [tab, setTab] = useState<ForgeTab>("enhance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Craft: receitas + materiais do personagem.
  const [recipes, setRecipes] = useState<Array<Record<string, unknown>>>([]);
  const [materials, setMaterials] = useState<Array<Record<string, unknown>>>([]);

  const equipItems = inventory.filter(
    (e) => {
      const template = e.template as Record<string, unknown>;
      return !!template?.slot && template?.type !== "consumable";
    }
  );
  const selected = equipItems.find((e) => String((e.item as Record<string, unknown>).id) === selectedId) || null;
  const selItem = (selected?.item as Record<string, unknown>) || null;
  const selTemplate = (selected?.template as Record<string, unknown>) || null;

  const refresh = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character?id=${characterId}`);
      const d = await res.json();
      if (d.character) setCharacter(d.character);
      if (d.inventory) setInventory(d.inventory);
    } catch { /* ignore */ }
  }, [characterId, setCharacter, setInventory]);

  useEffect(() => { refresh(); }, [refresh]);

  // Carrega receitas e materiais quando abre a aba de craft.
  useEffect(() => {
    if (tab !== "craft" || !characterId) return;
    (async () => {
      try {
        const res = await fetch(`/api/game?action=craft&characterId=${encodeURIComponent(characterId)}`);
        const d = await res.json();
        if (d.recipes) setRecipes(d.recipes);
        if (d.materials) setMaterials(d.materials);
      } catch { /* ignore */ }
    })();
  }, [tab, characterId]);

  const doForge = async (action: "enhance" | "enchant") => {
    if (!characterId || !selectedId) return;
    if (FORGE_MAINTENANCE) {
      notify("⚠️ A forja está em manutenção!", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/progression?action=forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, characterId, itemId: selectedId }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify(`❌ ${d.error}`, "error");
      } else if (action === "enhance") {
        if (d.enhanced) notify(`✅ ${t("forge.enhance.success", locale)} +${d.newLevel} (-${d.cost} 💰)`, "success");
        else notify(`😱 ${t("forge.enhance.fail", locale)} (-${d.cost} 💰)`, "error");
      } else {
        notify(`✨ ${t("forge.enchant.success", locale)} ${d.enchanted.icon} ${enchantName(d.enchanted, locale)}!`, "success");
      }
      await refresh();
    } catch {
      notify(t("general.error", locale), "error");
    }
    setBusy(false);
  };

  const doCraft = async (recipeId: string) => {
    if (!characterId) return;
    if (FORGE_MAINTENANCE) { notify("⚠️ A forja está em manutenção!", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/game?action=craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, recipeId }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify(`❌ ${d.error}`, "error");
      } else {
        const crafted = d.crafted?.template;
        notify(`🛠️ ${t("forge.craft.success", locale)} ${crafted?.icon || "⚔️"} ${crafted?.nameKey ? t(String(crafted.nameKey), locale) : ""}!`, "success");
        await refresh();
        // Recarrega materiais/receitas (quantidades mudaram).
        const r = await fetch(`/api/game?action=craft&characterId=${encodeURIComponent(characterId)}`);
        const dr = await r.json();
        if (dr.recipes) setRecipes(dr.recipes);
        if (dr.materials) setMaterials(dr.materials);
      }
    } catch {
      notify(t("general.error", locale), "error");
    }
    setBusy(false);
  };

  const tabs: { id: ForgeTab; label: string; icon: string; soon?: boolean }[] = [
    { id: "enhance", label: t("forge.enhance", locale), icon: "⬆️" },
    { id: "enchant", label: t("forge.enchant", locale), icon: "✨" },
    { id: "craft", label: t("forge.craft", locale), icon: "🛠️" },
    { id: "refine", label: t("forge.refine", locale), icon: "🔄", soon: true },
  ];

  const enh = (selItem?.enhanceLevel as number) || 0;
  const ench = selItem?.enchant ? enchantById(String(selItem.enchant)) : null;
  const cls = (character?.classType as string) || "warrior";
  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-3xl font-black flex items-center gap-3">
        <img src="/images/sidebar/menu_forja.png" alt={t("forge.title", locale)} className="w-10 h-10 object-contain" />
        <span className="bg-gradient-to-r from-[#f97316] to-[#ffd700] bg-clip-text text-transparent">{t("forge.title", locale)}</span>
      </h2>

      {FORGE_MAINTENANCE && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 game-card p-6 text-center animate-fadeInDown">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.18),transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse-soft" />
          <div className="relative">
            <div className="text-5xl mb-2 animate-float">🔧</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-widest animate-pulse-soft drop-shadow-[0_0_18px_rgba(245,158,11,0.45)]">
              ⚠️ FORJA EM MANUTENÇÃO ⚠️
            </div>
            <p className="text-sm text-gray-400 mt-3">
              O ferreiro está consertando o equipamento da forja.<br />Nenhuma ação pode ser feita agora — volte mais tarde!
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="text-[11px] font-bold bg-black/40 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-300">🔨 Martelo em conserto</span>
              <span className="text-[11px] font-bold bg-black/40 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-300">⚒️ Bigorna bloqueada</span>
              <span className="text-[11px] font-bold bg-black/40 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-300">🔥 Fogo apagado</span>
            </div>
          </div>
        </div>
      )}

      <div className={FORGE_MAINTENANCE ? "pointer-events-none select-none opacity-40" : ""}>
      {/* Abas */}
      <div className="flex gap-2 tab-bar border-b border-gray-800 pb-2 overflow-x-auto">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => { if (FORGE_MAINTENANCE) return; setTab(tb.id); }}
            disabled={FORGE_MAINTENANCE}
            className={`tab-item ${tab === tb.id ? "active" : ""} whitespace-nowrap ${tb.soon ? "opacity-60" : ""}`}>
            {tb.icon} {tb.label} {tb.soon && <span className="text-[9px] bg-yellow-600 text-white rounded-full px-1.5 py-0.5 ml-1">{t("forge.soon", locale)}</span>}
          </button>
        ))}
      </div>

      {tab === "craft" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Materiais do personagem */}
          <div className="game-card p-4">
            <h3 className="font-bold text-sm text-gray-300 mb-3">🧪 {t("forge.craft.materials", locale)}</h3>
            {materials.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">{t("forge.craft.noMaterials", locale)}</div>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {materials.map((m) => (
                  <div key={String(m.templateId)} className="flex items-center justify-between bg-[#0a0a12] rounded-xl px-3 py-2 border border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl">{String(m.icon || "🪨")}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm truncate">{m.nameKey ? t(String(m.nameKey), locale) : "?"}</div>
                        <div className="text-[10px] text-gray-500">{t(`rarity.${String(m.rarity || "common")}`, locale)}</div>
                      </div>
                    </div>
                    <span className="font-black text-[#ffd700]">x{String(m.quantity || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Receitas */}
          <div className="game-card p-4">
            <h3 className="font-bold text-sm text-gray-300 mb-3">🛠️ {t("forge.craft.recipes", locale)}</h3>
            {recipes.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">{t("forge.soon", locale)}…</div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {recipes.map((r) => {
                  const affordable = !!r.affordable;
                  const costs = (r.costs as Record<string, number>) || {};
                  return (
                    <div key={String(r.id)} className={`rounded-xl p-3 border ${affordable ? "border-[#00ff88]/30 bg-[#0a0a12]" : "border-white/10 bg-[#0a0a12] opacity-70"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white text-sm">{String(r.icon || "🛠️")} {t(String(r.nameKey), locale)}</div>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${affordable ? "bg-[#00ff88]/20 text-[#00ff88]" : "bg-red-500/20 text-red-300"}`}>
                          {t(`rarity.${String(r.resultRarity || "rare")}`, locale)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-2">{t(String(r.descKey), locale)}</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(costs).map(([tid, qty]) => {
                          const mat = materials.find((m) => String(m.templateId) === String(tid));
                          const have = Number(mat?.quantity) || 0;
                          const enough = have >= Number(qty);
                          return (
                            <span key={tid} className={`text-[10px] font-bold rounded-full px-2 py-1 ${enough ? "bg-white/10 text-white" : "bg-red-500/20 text-red-300"}`}>
                              {String(mat?.icon || "🪨")} {mat?.nameKey ? t(String(mat.nameKey), locale) : "?"} {have}/{String(qty)}
                            </span>
                          );
                        })}
                        <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-[#ffd700]/15 text-[#ffd700]">💰 {Number(r.goldCost || 0).toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => doCraft(String(r.id))}
                        disabled={busy || !affordable}
                        className="w-full py-2.5 text-sm font-black rounded-xl bg-gradient-to-r from-[#f97316] to-[#ffd700] text-black disabled:opacity-40"
                      >
                        {busy ? t("forge.busy", locale) : t("forge.craft.btn", locale)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "refine" && (
        <div className="game-card p-10 text-center border-2 border-dashed border-gray-700">
          <div className="text-6xl mb-4 animate-pulse">🔄</div>
          <div className="text-lg font-bold text-gray-300">{t("forge.select", locale)}</div>
          <div className="text-sm text-gray-500">{t("forge.soon", locale)}…</div>
        </div>
      )}

      {tab !== "craft" && tab !== "refine" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Lista de itens */}
          <div className="game-card p-4">
            <h3 className="font-bold text-sm text-gray-300 mb-3">🎒 {t("nav.inventory", locale)}</h3>
            {equipItems.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">{t("inv.empty", locale)}</div>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {equipItems.map((e) => {
                  const item = e.item as Record<string, unknown>;
                  const template = e.template as Record<string, unknown>;
                  const lvl = (item.enhanceLevel as number) || 0;
                  const enc = item.enchant ? enchantById(String(item.enchant)) : null;
                  const isSelected = String(item.id) === selectedId;
                  return (
                    <button
                      key={String(item.id)}
                      onClick={() => setSelectedId(String(item.id))}
                      className={`w-full text-left p-3 rounded-xl border transition ${isSelected ? "border-[#f97316] bg-[#f97316]/10" : enc ? "border-purple-500/50 bg-[#0a0a12] hover:border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.18)]" : "border-white/10 bg-[#0a0a12] hover:border-white/30"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemIcon template={template} emojiClass="text-xl" alt="" />
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm truncate">{t(String(template.nameKey), locale)}</div>
                            <div className="text-[11px] text-gray-500">{t(`slot.${template.slot as string}`, locale)} • Lv.{String(template.minLevel || 1)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {lvl > 0 && (
                            <span className="text-[10px] font-black bg-[#f97316]/20 border border-[#f97316]/40 text-orange-300 rounded-full px-2 py-0.5">+{lvl}</span>
                          )}
                          {!!enc && (
                            <span className="text-[10px] font-black bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-full px-2 py-0.5 shadow-[0_0_8px_rgba(168,85,247,0.5)]" title={`✦ ${enchantName(enc, locale)}`}>✦ {enc.icon}</span>
                          )}
                          {!!item.equipped && <span className="text-[10px] bg-green-500/20 text-green-300 rounded-full px-2 py-0.5">✓</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Painel da ação */}
          <div className="game-card p-5">
          {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-700 rounded-xl p-8">
                <div className="text-6xl mb-3 animate-float">{tab === "enhance" ? "⬆️" : "✨"}</div>
                <div className="text-lg font-bold">{t("forge.select", locale)}</div>
                <div className="text-sm text-gray-500 mt-1">{t("forge.drag", locale)}</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{String(selTemplate?.icon || "🎒")}</span>
                  <div>
                    <div className="font-bold text-lg text-white">{t(String(selTemplate?.nameKey), locale)}</div>
                    <div className="text-xs text-gray-400">{t(`slot.${selTemplate?.slot as string}`, locale)}</div>
                  </div>
                </div>

                {enh > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-2xl bg-gradient-to-r from-[#f97316] to-[#ffd700] bg-clip-text text-transparent">+{enh}</span>
                    <span className="text-[10px] font-bold bg-[#f97316]/20 border border-[#f97316]/40 text-orange-300 rounded-full px-2 py-0.5">
                      +{enh * 5}% {t("forge.enhance.desc.up", locale)}
                    </span>
                  </div>
                )}

                {!!ench && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                    <div className="text-xs text-purple-300 font-bold mb-1">{t("forge.enchantLabel", locale)}</div>
                    <div className="text-sm text-white">{ench.icon} {enchantName(ench, locale)}</div>
                    <div className="text-[11px] text-gray-400">{t("forge.enchant.effect", locale)}: +{ench.amount} {t(`stat.${ench.stat}`, locale)}</div>
                  </div>
                )}

                {tab === "enhance" && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#0a0a12] rounded-xl p-3 border border-white/10">
                        <div className="text-xs text-gray-500">{t("forge.chance", locale)}</div>
                        <div className="font-black text-white">{enh >= MAX_ENHANCE ? "—" : `${enhanceChance(enh)}%`}</div>
                      </div>
                      <div className="bg-[#0a0a12] rounded-xl p-3 border border-white/10">
                        <div className="text-xs text-gray-500">{t("forge.cost", locale)}</div>
                        <div className="font-black text-[#ffd700]">💰 {enh >= MAX_ENHANCE ? "—" : enhanceCost(enh).toLocaleString()}</div>
                      </div>
                    </div>
                    {/* Runas (1 a 15) */}
                    <div className="flex items-center justify-center gap-1.5">
                      {Array.from({ length: MAX_ENHANCE }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-3 h-3 rounded-full transition-all ${
                            i < enh
                              ? "bg-gradient-to-br from-[#f97316] to-[#ffd700] shadow-[0_0_8px_rgba(249,115,22,0.7)]"
                              : "bg-white/15"
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-gray-500 ml-1">Runa {enh}/{MAX_ENHANCE}</span>
                    </div>
                    <button
                      onClick={() => doForge("enhance")}
                      disabled={busy || enh >= MAX_ENHANCE}
                      className={`w-full py-3 text-sm font-black rounded-xl bg-gradient-to-r from-[#f97316] to-[#ffd700] text-black disabled:opacity-40`}
                    >
                      {busy ? t("forge.busy", locale) : enh >= MAX_ENHANCE ? `${t("forge.max", locale)} (+${MAX_ENHANCE})` : `${t("forge.enhance.btn", locale)}`}
                    </button>
                    {enh >= MAX_ENHANCE && <p className="text-xs text-center text-[#ffd700]">{t("forge.enhance.locked", locale)}</p>}
                    {!!ench && <p className="text-xs text-center text-purple-300">✨ {t("forge.enchant.combo", locale)}</p>}
                  </>
                )}

                {tab === "enchant" && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#0a0a12] rounded-xl p-3 border border-white/10">
                        <div className="text-xs text-gray-500">{t("forge.chance", locale)}</div>
                        <div className="font-black text-white">100%</div>
                      </div>
                      <div className="bg-[#0a0a12] rounded-xl p-3 border border-white/10">
                        <div className="text-xs text-gray-500">{t("forge.cost", locale)}</div>
                        <div className="font-black text-[#ffd700]">💰 {ENCHANT_COST.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {enchantPoolForClass(cls).map((en) => `${en.icon} ${enchantName(en, locale)}`).join(" · ")}
                    </div>
                    <button
                      onClick={() => doForge("enchant")}
                      disabled={busy || !!ench}
                      className={`w-full py-3 text-sm font-black rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 text-white disabled:opacity-40`}
                    >
                      {busy ? t("forge.busy", locale) : !!ench ? t("forge.enchant.needEnhance", locale) : `${t("forge.enchant.btn", locale)}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}