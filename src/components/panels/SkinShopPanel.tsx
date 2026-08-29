"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";

type SkinItem = {
  id: string;
  className: string;
  nameKey: string;
  rarity: string;
  image: string;
  diamondPrice: number;
  classDiscount: boolean;
  owned: boolean;
};

const RARITY_LABELS: Record<string, string> = {
  epic: "Epico",
  legendary: "Lendario",
  mythic: "Mitico",
};

const CLASS_LABELS: Record<string, { icon: string; label: string }> = {
  warrior: { icon: "⚔️", label: "Guerreiro" },
  mage: { icon: "🔮", label: "Mago" },
  archer: { icon: "🏹", label: "Arqueiro" },
  assassin: { icon: "🗡️", label: "Assassino" },
  berserker: { icon: "🪓", label: "Berserker" },
  paladin: { icon: "🛡️", label: "Paladino" },
  necromancer: { icon: "💀", label: "Necromante" },
  druid: { icon: "🌿", label: "Druida" },
  monk: { icon: "👊", label: "Monge" },
  knight: { icon: "🏰", label: "Cavaleiro" },
  darkMage: { icon: "🌑", label: "Mago Negro" },
  hunter: { icon: "🏹", label: "Cacador" },
  summoner: { icon: "✨", label: "Invocador" },
  samurai: { icon: "Katana", label: "Samurai" },
  templar: { icon: "⚔️", label: "Templario" },
};

export default function SkinShopPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [items, setItems] = useState<SkinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [previewSkin, setPreviewSkin] = useState<SkinItem | null>(null);

  const gold = Number((character as any)?.gold) || 0;
  const diamonds = Number((character as any)?.diamonds) || 0;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/skin-shop?characterId=${characterId}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const buySkin = async (skinId: string) => {
    if (!characterId) return;
    setBuying(skinId);
    try {
      const res = await fetch("/api/shop?action=skin-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, skinId }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`🎨 Skin comprada com sucesso!`, "success");
        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(data.error || "Erro ao comprar skin", "error");
      }
    } catch { notify("Erro ao comprar skin", "error"); }
    setBuying(null);
  };

  const ownedCount = items.filter((i) => i.owned).length;
  const filtered = items.filter((i) => {
    if (filterClass !== "all" && i.className !== filterClass) return false;
    if (filterRarity !== "all" && i.rarity !== filterRarity) return false;
    return true;
  });

  // Get unique classes from items
  const classes = [...new Set(items.map((i) => i.className))];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#ec4898]/20 via-[#8b5cf6]/10 to-[#16213e]/40 border border-[#ec4898]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">🎨</span>
            <span className="bg-gradient-to-r from-[#ec4898] to-[#8b5cf6] bg-clip-text text-transparent">
              Loja de Skins
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Personalize seu personagem com skins exclusivas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#ec4898]">{ownedCount}/{items.length}</div>
          <div className="text-[10px] text-gray-400 uppercase">Skins</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#ffd700]">💰 {gold.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 uppercase">Ouro</div>
        </div>
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#06b6d4]">💎 {diamonds}</div>
          <div className="text-[10px] text-gray-400 uppercase">Diamantes</div>
        </div>
      </div>

      {/* Class Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => setFilterClass("all")}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
            filterClass === "all" ? "border-[#ec4898]/60 text-white bg-[#ec4898]/15" : "border-white/5 text-gray-500 hover:text-white"
          }`}>
          Todas ({items.length})
        </button>
        {classes.map((cls) => {
          const info = CLASS_LABELS[cls] || { icon: "⚔️", label: cls };
          const count = items.filter((i) => i.className === cls).length;
          return (
            <button key={cls} onClick={() => setFilterClass(cls)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                filterClass === cls ? "border-[#ec4898]/60 text-white bg-[#ec4898]/15" : "border-white/5 text-gray-500 hover:text-white"
              }`}>
              <span>{info.icon}</span>
              <span>{info.label}</span>
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Rarity Filter */}
      <div className="flex gap-2">
        {["all", "epic", "legendary", "mythic"].map((r) => (
          <button key={r} onClick={() => setFilterRarity(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              filterRarity === r ? "border-[#ec4898]/60 text-white bg-[#ec4898]/15" : "border-white/10 text-gray-500"
            }`}>
            {r === "all" ? "✨ Todas" : (
              <span style={{ color: RARITY_COLORS[r] || "#9ca3af" }}>
                {r === "epic" ? "🟣 Epico" : r === "legendary" ? "🟡 Lendario" : "🔴 Mitico"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Skin Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="game-card p-4 animate-pulse">
              <div className="aspect-square bg-white/5 rounded-lg mb-2" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="game-card p-12 text-center">
          <div className="text-5xl mb-3">🎨</div>
          <div className="text-gray-400">Nenhuma skin encontrada</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const color = RARITY_COLORS[item.rarity] || "#9ca3af";
            const classInfo = CLASS_LABELS[item.className] || { icon: "⚔️", label: item.className };
            return (
              <div key={item.id}
                className={`game-card overflow-hidden transition-all hover:scale-[1.02] ${
                  item.owned ? "border-[#22c55e]/30" : ""
                }`}
                style={!item.owned ? { borderColor: color + "30" } : {}}>
                {/* Image */}
                <div className="relative aspect-square bg-gradient-to-b from-white/5 to-transparent overflow-hidden">
                  <img src={item.image} alt={item.id}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/images/sidebar/menu_colecao.png"; }} />
                  {item.owned && (
                    <div className="absolute top-2 right-2 bg-[#22c55e]/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      ✓ Possui
                    </div>
                  )}
                  {item.classDiscount && !item.owned && (
                    <div className="absolute top-2 left-2 bg-[#fbbf24]/90 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                      -20% Classe
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{classInfo.icon}</span>
                    <span className="text-[10px] text-gray-400">{classInfo.label}</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{t(item.nameKey, locale)}</div>
                  <div className="text-[10px] font-black uppercase" style={{ color }}>
                    {RARITY_LABELS[item.rarity] || item.rarity}
                  </div>

                  {item.owned ? (
                    <div className="mt-2 text-center text-[10px] text-[#22c55e] font-bold">
                      ✓ Na sua colecao
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button
                        onClick={() => buySkin(item.id)}
                        disabled={buying === item.id || diamonds < item.diamondPrice}
                        className={`w-full text-[11px] py-2 rounded-lg font-bold border transition ${
                          diamonds >= item.diamondPrice
                            ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20"
                            : "border-white/5 text-gray-600 cursor-not-allowed"
                        }`}>
                        💎 Comprar {item.diamondPrice} diamantes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
