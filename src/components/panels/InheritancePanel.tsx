"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS, classImage, type ClassName } from "@/game/constants";
import { inheritanceCost } from "@/game/inheritance";

type CharInfo = {
  id: string;
  name: string;
  classType: string;
  level: number;
  sex: string;
};

type ItemInfo = {
  id: string;
  templateId: number;
  name: string;
  icon: string;
  rarity: string;
  quantity: number;
  equipped: boolean;
  sellPrice: number;
  slot: string;
  questItem: boolean;
};

export default function InheritancePanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [characters, setCharacters] = useState<CharInfo[]>([]);
  const [items, setItems] = useState<ItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);
  const [transferredToday, setTransferredToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);

  const gold = Number((character as any)?.gold) || 0;
  const diamonds = Number((character as any)?.diamonds) || 0;

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/game?action=inheritance&characterId=${characterId}`);
      const data = await res.json();
      setCharacters(data.characters ?? []);
      setItems(data.items ?? []);
      setTransferredToday(data.transferredToday || 0);
      setDailyLimit(data.dailyLimit || 10);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const otherChars = characters.filter((c) => c.id !== characterId);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectedItemsList = items.filter((i) => selectedItems.has(i.id));
  const totalCost = selectedItemsList.reduce(
    (acc, item) => {
      const cost = inheritanceCost(item.rarity, item.sellPrice);
      return { gold: acc.gold + cost.gold, diamonds: acc.diamonds + cost.diamonds };
    },
    { gold: 0, diamonds: 0 }
  );

  const canTransfer = targetId && selectedItems.size > 0 && gold >= totalCost.gold && diamonds >= totalCost.diamonds && transferredToday < dailyLimit;

  const transfer = async (itemId: string) => {
    if (!characterId || !targetId) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/game?action=inheritance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, action: "transfer", itemId, targetCharacterId: targetId }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`✅ ${data.item.name} transferido para ${data.target.name}!`, "success");
        if (data.character) setCharacter(data.character);
        await load();
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao transferir", "error"); }
    setTransferring(false);
  };

  const transferAll = async () => {
    for (const itemId of selectedItems) {
      await transfer(itemId);
    }
    setSelectedItems(new Set());
  };

  const targetChar = otherChars.find((c) => c.id === targetId);
  const remaining = Math.max(0, dailyLimit - transferredToday);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3b82f6]/20 via-[#8b5cf6]/10 to-[#16213e]/40 border border-[#3b82f6]/30 p-5">
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">🔄</span>
            <span className="bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] bg-clip-text text-transparent">
              Heranca de Itens
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Transfera itens entre personagens da mesma conta</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card p-3 text-center">
          <div className="text-xl font-black text-[#3b82f6]">{remaining}/{dailyLimit}</div>
          <div className="text-[10px] text-gray-400 uppercase">Restantes Hoje</div>
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

      {/* Target Character Selection */}
      <div className="game-card p-4">
        <h3 className="font-bold text-sm text-gray-300 mb-3">👤 Personagem Alvo</h3>
        {otherChars.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-4">
            Crie outro personagem para transferir itens!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {otherChars.map((char) => (
              <button
                key={char.id}
                onClick={() => setTargetId(char.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetId === char.id
                    ? "border-[#3b82f6]/60 bg-[#3b82f6]/15"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src={classImage(char.classType as ClassName, char.sex)} alt={char.name}
                    className="w-8 h-8 rounded-lg border border-white/10 object-cover" />
                  <div>
                    <div className="text-sm font-bold text-white">{char.name}</div>
                    <div className="text-[10px] text-gray-400">Lv.{char.level} {char.classType}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items to Transfer */}
      <div className="game-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-gray-300">📦 Seus Itens</h3>
          <span className="text-[10px] text-gray-500">{selectedItems.size} selecionados</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-4">
            Nenhum item no inventario
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {items.map((item) => {
              const cost = inheritanceCost(item.rarity, item.sellPrice);
              const isSelected = selectedItems.has(item.id);
              const color = RARITY_COLORS[item.rarity] || "#9ca3af";
              const canSelect = !item.equipped && !item.questItem;

              return (
                <div
                  key={item.id}
                  onClick={() => canSelect && toggleItem(item.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition cursor-pointer ${
                    isSelected ? "border-[#3b82f6]/40 bg-[#3b82f6]/10" :
                    canSelect ? "border-white/5 bg-white/[0.02] hover:border-white/20" :
                    "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="w-5 h-5 rounded border flex items-center justify-center text-xs"
                    style={{ borderColor: isSelected ? "#3b82f6" : "rgba(255,255,255,0.2)", backgroundColor: isSelected ? "#3b82f6" : "transparent" }}>
                    {isSelected && "✓"}
                  </div>

                  <span className="text-xl">{item.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{item.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase" style={{ color }}>{item.rarity}</span>
                      {item.equipped && <span className="text-[9px] text-[#f59e0b]">Equipado</span>}
                      {item.questItem && <span className="text-[9px] text-[#e94560]">Quest</span>}
                      {item.quantity > 1 && <span className="text-[9px] text-gray-500">x{item.quantity}</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-[#ffd700]">💰{cost.gold.toLocaleString()}</div>
                    {cost.diamonds > 0 && <div className="text-[10px] text-[#06b6d4]">💎{cost.diamonds}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer Summary */}
      {selectedItems.size > 0 && targetId && (
        <div className="game-card p-4 border-[#3b82f6]/30 bg-[#3b82f6]/5">
          <h3 className="font-bold text-sm text-gray-300 mb-2">📋 Resumo da Transferencia</h3>
          <div className="text-xs text-gray-400 mb-2">
            {selectedItems.size} item(ns) → <span className="text-white font-bold">{targetChar?.name}</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-[#ffd700]">💰 {totalCost.gold.toLocaleString()}</span>
            {totalCost.diamonds > 0 && <span className="text-[#06b6d4]">💎 {totalCost.diamonds}</span>}
          </div>
          {gold < totalCost.gold && (
            <div className="text-[10px] text-[#e94560] mt-1">⚠️ Ouro insuficiente!</div>
          )}
          {totalCost.diamonds > 0 && diamonds < totalCost.diamonds && (
            <div className="text-[10px] text-[#e94560] mt-1">⚠️ Diamantes insuficientes!</div>
          )}
        </div>
      )}

      {/* Transfer Button */}
      {selectedItems.size > 0 && targetId && (
        <button
          onClick={transferAll}
          disabled={!canTransfer || transferring}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            canTransfer
              ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white hover:opacity-90 active:scale-95"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
          }`}
        >
          {transferring ? "⏳ Transferindo..." : `🔄 Transferir ${selectedItems.size} item(ns)`}
        </button>
      )}

      {/* Info */}
      <div className="game-card p-4 text-center text-xs text-gray-500">
        <p>🔄 Transfera itens entre personagens da mesma conta.</p>
        <p className="mt-1">⚠️ Itens equipados e de quest nao podem ser transferidos.</p>
        <p className="mt-1">💰 Itens mais raros custam mais para transferir.</p>
      </div>
    </div>
  );
}
