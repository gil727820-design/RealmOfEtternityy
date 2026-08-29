"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";

interface Material {
  id: number;
  nameKey: string;
  rarity: string;
  icon: string;
  quantity: number;
}

interface Recipe {
  id: string;
  resultRarity: string;
  minLevel: number;
  costs: Record<number, number>;
  goldCost: number;
  nameKey: string;
  descKey: string;
  icon: string;
}

const RARITY_BG: Record<string, string> = {
  common: "from-gray-600/20 to-gray-800/20",
  uncommon: "from-green-600/20 to-green-800/20",
  rare: "from-blue-600/20 to-blue-800/20",
  epic: "from-purple-600/20 to-purple-800/20",
  legendary: "from-orange-600/20 to-orange-800/20",
  mythic: "from-red-600/20 to-red-800/20",
  divine: "from-yellow-600/20 to-yellow-800/20",
  supreme: "from-pink-600/20 to-pink-800/20",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Epico",
  legendary: "Lendario", mythic: "Mitico", divine: "Divino", supreme: "Supremo",
};

const MATERIAL_NAMES: Record<number, { icon: string; name: string }> = {
  5000: { icon: "🪨", name: "Fragmento de Ferro" },
  5001: { icon: "🌿", name: "Essencia de Madeira" },
  5002: { icon: "🍃", name: "Essencia Florestal" },
  5003: { icon: "🏺", name: "Estilhaco de Ruina" },
  5004: { icon: "🔮", name: "Cristal Arcano" },
  5005: { icon: "⛏️", name: "Veio de Minerio" },
  5006: { icon: "🧪", name: "Essencia de Pantano" },
  5007: { icon: "❄️", name: "Nucleo de Gelo" },
  5008: { icon: "🐉", name: "Escama de Dragao" },
  5009: { icon: "❤️‍🔥", name: "Coracao de Titã" },
  5010: { icon: "🌑", name: "Estilhaco do Vazio" },
  5011: { icon: "✨", name: "Poeira Estelar" },
  5012: { icon: "🕯️", name: "Reliquia Antiga" },
  5013: { icon: "👑", name: "Essencia Suprema" },
};

export default function CraftingPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const loadData = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      
      const inv = data.inventory || [];
      const matMap: Record<number, number> = {};
      for (const entry of inv) {
        const tpl = entry.template || entry.item || {};
        const tid = Number(tpl.templateId || entry.templateId || 0);
        if (tid >= 5000 && tid <= 5020) {
          matMap[tid] = (matMap[tid] || 0) + Number(entry.quantity || entry.item?.quantity || 1);
        }
      }
      const mats: Material[] = Object.entries(matMap).map(([id, qty]) => {
        const info = MATERIAL_NAMES[Number(id)] || { icon: "📦", name: `Material ${id}` };
        return { id: Number(id), nameKey: info.name, rarity: "common", icon: info.icon, quantity: qty };
      });
      setMaterials(mats);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId, setCharacter]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch("/api/craft/recipes");
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.recipes || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const craft = async (recipe: Recipe) => {
    if (!characterId || busy) return;
    setBusy(recipe.id);
    try {
      const res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, recipeId: recipe.id }),
      });
      const data = await res.json();
      if (res.ok) {
        notify(`🧪 ${t("craft.success", locale)}!`, "success");
        if (data.character) setCharacter(data.character);
        await loadData();
      } else {
        notify(data.error || t("craft.notEnough", locale), "error");
      }
    } catch {
      notify(t("craft.notEnough", locale), "error");
    }
    setBusy(null);
  };

  const getMatCount = (id: number) => {
    const m = materials.find((mat) => mat.id === id);
    return m?.quantity || 0;
  };

  const canCraft = (recipe: Recipe) => {
    if (Number(character?.gold || 0) < recipe.goldCost) return false;
    for (const [matId, needed] of Object.entries(recipe.costs)) {
      if (getMatCount(Number(matId)) < Number(needed)) return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
        <div className="spinner mb-4" />
        <p className="text-gray-400">{t("general.loading", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] border border-[#f59e0b]/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)]">
          <span className="text-2xl">🧪</span>
        </div>
        <div>
          <h2 className="text-3xl font-black">
            <span className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] bg-clip-text text-transparent">
              {t("craft.title", locale)}
            </span>
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">{t("craft.subtitle", locale)}</p>
        </div>
      </div>

      {/* Materials inventory */}
      <div className="game-card p-4">
        <h3 className="text-sm font-bold text-[#f59e0b] mb-3">📦 Seus Materiais</h3>
        {materials.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">{t("craft.noMaterials", locale)}</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {materials.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-black/30 border border-white/10">
                <span className="text-xl">{m.icon}</span>
                <span className="text-[10px] text-gray-400 truncate w-full text-center">{m.nameKey}</span>
                <span className="text-xs font-black text-[#f59e0b]">x{m.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipes */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-300">⚒️ Receitas de Craft</h3>
        {recipes.length === 0 ? (
          <div className="game-card p-8 text-center text-sm text-gray-500">Nenhuma receita disponivel</div>
        ) : (
          recipes.map((recipe) => {
            const available = canCraft(recipe);
            const rarityColor = RARITY_COLORS[recipe.resultRarity] || "#6b7280";
            return (
              <div
                key={recipe.id}
                className={`game-card p-4 border transition-all ${available ? "border-[#f59e0b]/40 hover:border-[#f59e0b]/70" : "border-white/10 opacity-70"}`}
                style={available ? { boxShadow: `0 0 15px ${rarityColor}22` } : undefined}
              >
                <div className="flex items-start gap-4">
                  {/* Recipe icon */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 border" style={{ borderColor: `${rarityColor}66`, background: `${rarityColor}15` }}>
                    {recipe.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{t(recipe.nameKey, locale)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ color: rarityColor, borderColor: `${rarityColor}44`, background: `${rarityColor}15`, border: "1px solid" }}>
                        {RARITY_LABEL[recipe.resultRarity] || recipe.resultRarity}
                      </span>
                      <span className="text-[10px] text-gray-500">Lv.{recipe.minLevel}+</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-2">{t(recipe.descKey, locale)}</p>
                    
                    {/* Materials required */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Object.entries(recipe.costs).map(([matId, needed]) => {
                        const have = getMatCount(Number(matId));
                        const enough = have >= needed;
                        const info = MATERIAL_NAMES[Number(matId)] || { icon: "📦", name: `#${matId}` };
                        return (
                          <span key={matId} className={`text-[10px] px-2 py-1 rounded-lg font-bold ${enough ? "bg-green-500/15 border border-green-500/30 text-green-300" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>
                            {info.icon} {have}/{needed}
                          </span>
                        );
                      })}
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${Number(character?.gold || 0) >= recipe.goldCost ? "bg-[#ffd700]/15 border border-[#ffd700]/30 text-[#ffd700]" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>
                        💰 {(recipe.goldCost).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Craft button */}
                  <button
                    onClick={() => craft(recipe)}
                    disabled={busy !== null || !available}
                    className={`px-4 py-2 rounded-xl text-sm font-black transition-all shrink-0 ${
                      available
                        ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-black hover:scale-105 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        : "bg-white/5 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {busy === recipe.id ? "..." : `🧪 ${t("craft.craft", locale)}`}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* How it works */}
      <div className="game-card p-4 animate-fadeInUp">
        <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ Como funciona o Crafting</h3>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
          <li>Derrote monstros para coletar materiais</li>
          <li>Cada receita cria um item aleatorio da raridade indicada</li>
          <li>Materiais mais raros dropam de monstros de nivel mais alto</li>
          <li>Voce precisa de materiais + ouro para forjar</li>
        </ul>
      </div>
    </div>
  );
}
