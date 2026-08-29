"use client";
import { useState, useEffect, useCallback } from "react";

interface ShopItem {
  id: string;
  nameKey: string;
  icon: string;
  description: string;
  rewardType: string;
  rewardAmount: number;
  cost: number;
  minGuildLevel: number;
  purchaseLimit: number;
  purchased: number;
  canBuy: boolean;
}

interface Props {
  characterId: string | undefined;
  guildId: string | undefined;
  guildLevel: number;
  notify: (msg: string, type?: any) => void;
}

export default function GuildShopSection({ characterId, guildId, guildLevel, notify }: Props) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [guildCoins, setGuildCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const loadShop = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/guild/shop?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) {
        setItems(d.items || []);
        setGuildCoins(d.guildCoins || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { loadShop(); }, [loadShop]);

  const buyItem = async (item: ShopItem) => {
    if (!characterId || busy) return;
    setBusy(item.id);
    try {
      const res = await fetch("/api/guild/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, itemId: item.id }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`✅ ${d.message}`, "success");
        setGuildCoins(d.guildCoins || 0);
        await loadShop();
      } else {
        notify(d.error || "Erro", "error");
      }
    } catch { notify("Erro ao comprar", "error"); }
    setBusy(null);
  };

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#ec4899]">🏪 Loja da Guilda</h4>
        <span className="text-[10px] text-[#ffd700] font-bold">🪙 {guildCoins.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => {
          const limitReached = item.purchaseLimit > 0 && item.purchased >= item.purchaseLimit;
          return (
            <div key={item.id} className={`rounded-xl border p-2.5 transition-all ${item.canBuy ? "border-[#ec4899]/30 bg-[#ec4899]/5 hover:border-[#ec4899]/60" : "border-white/10 bg-[#0a0a12] opacity-60"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">{item.nameKey}</div>
                  <div className="text-[9px] text-gray-500">{item.description}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-[#ffd700] font-bold">🪙 {item.cost.toLocaleString()}</span>
                {item.purchaseLimit > 0 && (
                  <span className={`text-[9px] font-bold ${limitReached ? "text-red-400" : "text-gray-500"}`}>
                    {item.purchased}/{item.purchaseLimit}
                  </span>
                )}
              </div>
              <button
                onClick={() => buyItem(item)}
                disabled={!item.canBuy || busy !== null}
                className={`w-full mt-1.5 text-[10px] py-1 rounded-lg font-bold transition ${item.canBuy ? "bg-[#ec4899]/20 border border-[#ec4899]/40 text-[#ec4899] hover:bg-[#ec4899]/30" : "bg-white/5 text-gray-600 cursor-not-allowed"}`}
              >
                {busy === item.id ? "..." : limitReached ? "Esgotado" : "🛒 Comprar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
