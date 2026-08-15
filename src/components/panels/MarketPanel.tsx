"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS, CLASS_ICONS, type ClassName } from "@/game/constants";
import ItemIcon from "@/components/ui/ItemIcon";
import { ItemPreviewModal, ItemChip, type PreviewItem } from "@/components/ui/ItemPreview";
import {
  MARKET_MIN_LEVEL,
  MAX_LISTINGS_PER_CHAR,
  listingFee,
  sellUnlock,
} from "@/game/market";
import { MAX_TRADE_ADS_PER_CHAR } from "@/game/tradeAds";
import { fmtNum } from "@/game/format";

function fmt(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("pt-BR");
}

/** Ordem das raridades usada nos filtros do mercado (comum → suprema). */
const MARKET_RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"];

function rarityLabel(rarity: string | undefined, locale: string): string {
  if (!rarity) return "—";
  const key = `rarity.${rarity}`;
  const label = t(key, locale);
  return label === key ? rarity : label;
}

function itemName(template: any, locale: string): string {
  return template?.nameKey ? t(template.nameKey, locale) : "Item";
}

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function chipCls(active: boolean) {
  return `px-3 py-1.5 rounded-full text-sm border transition-all ${
    active ? "bg-[#e94560] text-white font-bold border-[#e94560]" : "bg-white/10 text-gray-300 hover:text-white border-white/10"
  }`;
}

/* ==================== ABA: MERCADO (comprar) ==================== */
function BrowseTab({ onRefreshCharacter }: { onRefreshCharacter: () => void }) {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [avgPrices, setAvgPrices] = useState<Record<string, number>>({});
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      const data = await res.json();
      if (Array.isArray(data.listings)) setListings(data.listings);
      if (data.avgPrices) setAvgPrices(data.avgPrices as Record<string, number>);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const buy = async (listingId: string) => {
    if (!characterId || busy) return;
    setBusy(listingId);
    try {
      const res = await fetch("/api/market/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao comprar", "error");
      } else {
        notify(data.message || "✅ Comprado!", "success");
        if (data.character) setCharacter(data.character);
        onRefreshCharacter();
        await load();
      }
    } catch {
      notify("Erro ao comprar", "error");
    } finally {
      setBusy(null);
    }
  };

  // Remove (cancela) um anúncio de venda próprio — o item volta ao inventário.
  const removeListing = async (listingId: string) => {
    if (!characterId || busy) return;
    const ok = window.confirm("Remover este anúncio? O item volta para o seu inventário.");
    if (!ok) return;
    setBusy(listingId);
    try {
      const res = await fetch("/api/market/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao remover", "error");
      } else {
        notify(data.message || "🗑️ Anúncio removido.", "success");
        if (data.character) setCharacter(data.character);
        onRefreshCharacter();
        await load();
      }
    } catch {
      notify("Erro ao remover", "error");
    } finally {
      setBusy(null);
    }
  };

  const myListingsActive = listings.filter(
    (e: any) => e.listing?.sellerId === characterId && e.listing?.status === "active"
  ).length;

  // Filtro local: busca por nome (ignora acentos/maiúsculas) + raridade.
  const filtered = useMemo(() => {
    const q = normalize(query);
    return listings.filter((e: any) => {
      const tpl = e.template || {};
      if (rarity && tpl.rarity !== rarity) return false;
      if (q && !normalize(itemName(tpl, locale)).includes(q)) return false;
      return true;
    });
  }, [listings, query, rarity, locale]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">
          💰 Você: <b className="text-yellow-300">{fmt((character as any)?.gold)}</b> 🪙 ·{" "}
          <b className="text-cyan-300">{fmt((character as any)?.diamonds)}</b> 💎
        </p>
        <button onClick={load} className="text-[11px] text-gray-400 hover:text-white transition">
          🔄 Atualizar
        </button>
      </div>

      {/* Busca por nome + filtro por raridade */}
      {listings.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 Buscar item..."
              className="w-full rounded-xl border border-white/10 bg-bg-surface px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#ffd700] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setRarity("")} className={chipCls(rarity === "")}>
              ✨ Todos
            </button>
            {MARKET_RARITIES.map((r) => (
              <button
                key={r}
                onClick={() => setRarity(rarity === r ? "" : r)}
                className={chipCls(rarity === r)}
                title={rarityLabel(r, locale)}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: RARITY_COLORS[r] }} />
                {rarityLabel(r, locale)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500">
            {filtered.length} {filtered.length === 1 ? "anúncio" : "anúncios"}{" "}
            {(query || rarity) && `(filtrado de ${listings.length})`}
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <span className="animate-bounce text-3xl">🏪</span>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 py-14 text-gray-500">
          <span className="text-4xl opacity-50">📦</span>
          <p className="text-sm">O mercado está vazio — seja o primeiro a anunciar!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 py-14 text-gray-500">
          <span className="text-4xl opacity-50">🔍</span>
          <p className="text-sm">Nenhum item encontrado para sua busca.</p>
          <button onClick={() => { setQuery(""); setRarity(""); }} className="text-xs text-[#ffd700] hover:underline">
            Limpar busca e filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry: any) => {
            const l = entry.listing;
            const tpl = entry.template || {};
            const seller = entry.seller;
            const mine = l.sellerId === characterId;
            const rarityHex = RARITY_COLORS[tpl.rarity];
            return (
              <div
                key={l.id}
                className="game-card flex flex-col gap-2 p-3"
                style={{ borderColor: rarityHex ? `${rarityHex}55` : "#ffffff22" }}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => setPreview({ template: tpl, quantity: l.quantity })}
                    title="Ver status do item"
                    className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-xl border bg-bg-card transition-all hover:scale-105 hover:brightness-125"
                    style={{ borderColor: rarityHex ?? "#ffffff33" }}
                  >
                    <ItemIcon template={tpl} className="h-11 w-11 object-contain" emojiClass="text-2xl" alt="" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setPreview({ template: tpl, quantity: l.quantity })} className="block max-w-full cursor-pointer text-left" title="Ver status do item">
                      <p className="truncate text-sm font-bold text-white transition-colors hover:text-[#7c5cfc]">{itemName(tpl, locale)}</p>
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                        style={{ background: rarityHex ?? "#3b4252" }}
                      >
                        {rarityLabel(tpl.rarity, locale)}
                      </span>
                      {(l.quantity || 1) > 1 && (
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
                          ×{l.quantity}
                        </span>
                      )}
                      {tpl.minLevel > 1 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-gray-400">
                          Lv {tpl.minLevel}
                        </span>
                      )}
                    </div>
                    {tpl.type === "consumable" ? (
                      <p className="mt-1 text-[10px] text-gray-500">🧪 Consumível</p>
                    ) : (
                      <p className="mt-1 text-[10px] text-gray-500">
                        ⚔️ Ataque +{tpl.attack || 0} · 🛡️ Defesa +{tpl.defense || 0}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 truncate">
                      {seller ? `${seller.name} · Lv ${seller.level}` : "Jogador"}
                    </p>
                    <p className={`text-base font-black ${l.currency === "diamonds" ? "text-cyan-300" : "text-yellow-300"}`}>
                      {fmt(l.price)} {l.currency === "diamonds" ? "💎" : "🪙"}
                    </p>
                    {avgPrices[String(l.templateId)] > 0 && l.currency === "gold" && (
                      <p className="text-[9px] text-gray-500">
                        📈 Média: {fmt(avgPrices[String(l.templateId)])} 🪙
                      </p>
                    )}
                  </div>
                  {mine ? (
                    <button
                      onClick={() => void removeListing(l.id)}
                      disabled={busy !== null}
                      className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                    >
                      🗑️ Remover
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm === l.id) {
                          setConfirm(null);
                          void buy(l.id);
                        } else {
                          setConfirm(l.id);
                          timers.current.push(setTimeout(() => setConfirm((c) => (c === l.id ? null : c)), 4000));
                        }
                      }}
                      disabled={busy !== null}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                        confirm === l.id
                          ? "bg-red-600 text-white"
                          : "bg-gradient-to-r from-[#e94560] to-[#ff7b81] text-white hover:brightness-110"
                      } disabled:opacity-50`}
                    >
                      {busy === l.id ? "…" : confirm === l.id ? "Confirmar?" : "Comprar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {myListingsActive > 0 && (
        <p className="text-[10px] text-gray-500">
          Você tem {myListingsActive}/{MAX_LISTINGS_PER_CHAR} anúncios ativos.
        </p>
      )}

      <ItemPreviewModal item={preview} locale={locale} onClose={() => setPreview(null)} />
    </div>
  );
}

/* ==================== ABA: VENDER (anunciar) ==================== */
function SellTab({ onRefreshCharacter }: { onRefreshCharacter: () => void }) {
  const { characterId, character, locale, notify, setCharacter, inventory } = useGameStore();
  const [price, setPrice] = useState("100");
  const [currency, setCurrency] = useState<"gold" | "diamonds">("gold");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  // Carrega os anúncios de venda ativos do próprio personagem.
  const loadMyListings = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch("/api/market");
      const data = await res.json();
      if (Array.isArray(data.listings)) {
        setMyListings(
          data.listings.filter((e: any) => e.listing?.sellerId === characterId && e.listing?.status === "active")
        );
      }
    } catch {}
  }, [characterId]);

  useEffect(() => {
    void loadMyListings();
    const id = setInterval(loadMyListings, 10000);
    return () => clearInterval(id);
  }, [loadMyListings]);

  // Remove um anúncio de venda próprio — o item volta ao inventário.
  const removeListing = async (listingId: string) => {
    if (!characterId || busy) return;
    const ok = window.confirm("Remover este anúncio? O item volta para o seu inventário.");
    if (!ok) return;
    setBusy(listingId);
    try {
      const res = await fetch("/api/market/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao remover", "error");
      } else {
        notify(data.message || "🗑️ Anúncio removido.", "success");
        if (data.character) setCharacter(data.character);
        onRefreshCharacter();
        await loadMyListings();
      }
    } catch {
      notify("Erro ao remover", "error");
    } finally {
      setBusy(null);
    }
  };

  const items = useMemo(() => {
    return (Array.isArray(inventory) ? inventory : [])
      .map((entry: any) => ({
        inv: entry.item || entry.inv || entry,
        template: entry.template || {},
        quantity: entry.quantity ?? entry.item?.quantity ?? 1,
        stackable: !!entry.stackable || entry.template?.type === "consumable",
      }))
      .filter(
        (it) =>
          !it.inv.equipped &&
          !it.inv.listed &&
          !it.inv.reservedFor &&
          it.template?.nameKey &&
          !(Number(it.quantity) < 1)
      );
  }, [inventory]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((it) => it.inv.id === selectedId) ?? null;

  const sell = async () => {
    if (!characterId || !selected) return;
    const p = Math.max(1, Math.floor(Number(price) || 0));
    if (p < 1) {
      notify("Preço inválido", "error");
      return;
    }
    setBusy(selected.inv.id);
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          inventoryItemId: selected.inv.id,
          quantity: selected.stackable ? Math.min(Math.max(1, qty), selected.quantity) : 1,
          price: p,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao anunciar", "error");
        return;
      }
      notify(data.message || "📦 Anunciado!", "success");
      if (data.character) setCharacter(data.character);
      setSelectedId(null);
      onRefreshCharacter();
    } catch {
      notify("Erro ao anunciar", "error");
    } finally {
      setBusy(null);
    }
  };

  const fee = selected ? listingFee(Math.max(1, Math.floor(Number(price) || 0)), currency) : 0;

  // Desbloqueio do leilão: nível mínimo + andar da torre (mostra o que falta).
  const sellUnlockInfo = sellUnlock(character);

  return (
    <>
      {/* Gate de desbloqueio do leilão */}
      {!sellUnlockInfo.unlocked && (
        <div className="game-card mb-4 flex flex-col gap-2 border-[#ffd700]/40 p-4">
          <p className="text-sm font-black text-[#ffd700]">🔒 Leilão bloqueado</p>
          <p className="text-xs text-gray-300">
            Para <b>vender itens</b> no mercado você precisa provar seu valor:
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold border ${Number(character?.level) >= MARKET_MIN_LEVEL ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-white/10 bg-white/5 text-gray-400"}`}>
              {Number(character?.level) >= MARKET_MIN_LEVEL ? "✅" : "⭕"} Nível {MARKET_MIN_LEVEL}+ ({Number(character?.level) || 0}/{MARKET_MIN_LEVEL})
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold border ${Number(character?.towerFloor) >= sellUnlockInfo.minTowerFloor ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-white/10 bg-white/5 text-gray-400"}`}>
              {Number(character?.towerFloor) >= sellUnlockInfo.minTowerFloor ? "✅" : "⭕"} Andar {sellUnlockInfo.minTowerFloor} da torre ({Number(character?.towerFloor) || 0}/{sellUnlockInfo.minTowerFloor})
            </span>
          </div>
          <p className="text-[10px] text-gray-500">Comprar itens continua liberado para todos a partir do nível {MARKET_MIN_LEVEL}.</p>
        </div>
      )}

      {/* Meus anúncios ativos (com botão de remover) */}
      {myListings.length > 0 && (
        <div className="game-card mb-4 flex flex-col gap-2 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#ffd700]">
            📦 Seus anúncios ativos ({myListings.length}/{MAX_LISTINGS_PER_CHAR})
          </p>
          {myListings.map((entry: any) => {
            const l = entry.listing;
            const tpl = entry.template || {};
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => setPreview({ template: tpl, quantity: l.quantity })}
                    title="Ver status do item"
                    className="shrink-0 cursor-pointer rounded-lg transition-all hover:scale-105 hover:brightness-125"
                  >
                    <ItemIcon template={tpl} className="h-9 w-9 object-contain" emojiClass="text-xl" alt="" />
                  </button>
                  <div className="min-w-0">
                    <button
                      onClick={() => setPreview({ template: tpl, quantity: l.quantity })}
                      title="Ver status do item"
                      className="block max-w-full cursor-pointer text-left"
                    >
                      <p className="truncate text-xs font-bold text-white transition-colors hover:text-[#7c5cfc]">
                        {itemName(tpl, locale)}
                        {(l.quantity || 1) > 1 && <span className="text-yellow-300"> ×{l.quantity}</span>}
                      </p>
                    </button>
                    <p className={`text-[11px] font-black ${l.currency === "diamonds" ? "text-cyan-300" : "text-yellow-300"}`}>
                      {fmt(l.price)} {l.currency === "diamonds" ? "💎" : "🪙"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void removeListing(l.id)}
                  disabled={busy !== null}
                  className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-gray-300 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                >
                  🗑️ Remover
                </button>
              </div>
            );
          })}
        </div>
      )}

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-gray-400">
          Selecione um item do inventário para anunciar. Itens equipados, anunciados ou em troca não aparecem.
        </p>
        {items.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-14 text-sm text-gray-500">
            Nenhum item disponível para anunciar.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((it) => {
              const active = selectedId === it.inv.id;
              const rarityHex = RARITY_COLORS[it.template.rarity];
              return (
                <button
                  key={it.inv.id}
                  onClick={() => {
                    setSelectedId(it.inv.id);
                    setQty(1);
                  }}
                  className={`group relative flex flex-col items-center gap-1 rounded-xl border bg-bg-card px-2 pt-2 pb-1.5 transition-all hover:-translate-y-0.5 hover:bg-bg-surface ${
                    active ? "border-[#e94560] ring-2 ring-[#e94560]/40" : ""
                  }`}
                  style={!active && rarityHex ? { borderColor: `${rarityHex}55` } : undefined}
                >
                  <ItemIcon template={it.template} className="h-12 w-12 object-contain" emojiClass="text-3xl" alt="" />
                  <span className="w-full truncate text-center text-[10px] font-semibold text-gray-200">
                    {itemName(it.template, locale)}
                  </span>
                  {(it.quantity ?? 1) > 1 && (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[9px] font-bold text-yellow-300">
                      ×{it.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-4 lg:sticky lg:top-4">
        <h3 className="text-sm font-black">📦 Novo anúncio</h3>
        {!selected ? (
          <p className="text-xs text-gray-500">Escolha um item ao lado.</p>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setPreview({ template: selected.template, quantity: selected.quantity })}
                title="Ver status do item"
                className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border bg-bg-card transition-all hover:scale-105 hover:brightness-125"
                style={{ borderColor: RARITY_COLORS[selected.template.rarity] ?? "#ffffff33" }}
              >
                <ItemIcon template={selected.template} className="h-10 w-10 object-contain" emojiClass="text-2xl" alt="" />
              </button>
              <div className="min-w-0">
                <button onClick={() => setPreview({ template: selected.template, quantity: selected.quantity })} title="Ver status do item" className="block max-w-full cursor-pointer text-left">
                  <p className="truncate text-sm font-bold text-white transition-colors hover:text-[#7c5cfc]">{itemName(selected.template, locale)}</p>
                </button>
                <p className="text-[10px] text-gray-500">
                  {rarityLabel(selected.template.rarity, locale)} · você tem ×{selected.quantity}
                </p>
              </div>
            </div>

            {selected.stackable && (
              <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                Quantidade
                <input
                  type="number"
                  min={1}
                  max={selected.quantity}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(selected.quantity, Math.floor(Number(e.target.value) || 1))))}
                  className="rounded-xl border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-sm text-white focus:border-[#e94560] focus:outline-none"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-[11px] text-gray-400">
              Preço por unidade
              <input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-sm text-white focus:border-[#e94560] focus:outline-none"
              />
            </label>

            <div className="flex gap-2">
              <button onClick={() => setCurrency("gold")} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-all ${currency === "gold" ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300" : "border-white/10 bg-white/5 text-gray-400"}`}>
                🪙 Ouro
              </button>
              <button onClick={() => setCurrency("diamonds")} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-all ${currency === "diamonds" ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 bg-white/5 text-gray-400"}`}>
                💎 Diamantes
              </button>
            </div>

            <p className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-gray-400">
              Taxa de anúncio: <b className="text-white">{currency === "diamonds" ? `${fee} 💎` : `${fmt(fee)} 🪙`}</b>
              {currency === "gold" ? " (5%, máx. 1.000)" : ""}
            </p>

            <button
              onClick={sell}
              disabled={busy !== null}
              className="w-full rounded-xl bg-gradient-to-r from-[#e94560] to-[#ff7b81] py-2.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              {busy !== null ? "…" : "📦 Anunciar no mercado"}
            </button>
          </>
        )}
      </div>
    </div>

    <ItemPreviewModal item={preview} locale={locale} onClose={() => setPreview(null)} />
    </>
  );
}

/* ==================== ABA: TROCAS ==================== */
function TradeSessionView({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [state, setState] = useState<any | null>(null);
  const [mySel, setMySel] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [myGold, setMyGold] = useState("");
  const [myDiamonds, setMyDiamonds] = useState("");
  const myName = (character as any)?.name || "Você";
  const goldNum = Math.max(0, Math.floor(Number(myGold) || 0));
  const diamondsNum = Math.max(0, Math.floor(Number(myDiamonds) || 0));
  const myGoldBal = Math.max(0, Number((character as any)?.gold) || 0);
  const myDiamBal = Math.max(0, Number((character as any)?.diamonds) || 0);

  // Inventário disponível para oferecer nesta sala
  const inventory = useGameStore((s) => s.inventory);
  const myItems = useMemo(
    () =>
      (Array.isArray(inventory) ? inventory : [])
        .map((entry: any) => ({
          inv: entry.item || entry.inv || entry,
          template: entry.template || {},
          quantity: entry.quantity ?? entry.item?.quantity ?? 1,
          stackable: !!entry.stackable || entry.template?.type === "consumable",
        }))
        .filter((it) => !it.inv.equipped && !it.inv.listed && !it.inv.reservedFor)
        .slice(0, 40),
    [inventory]
  );

  const load = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/trade-session/chat?sessionId=${encodeURIComponent(sessionId)}&characterId=${encodeURIComponent(characterId)}`);
      const data = await res.json();
      if (!res.ok) {
        if (data?.error) notify(data.error, "error");
        onClose();
        return;
      }
      setState(data);
      if (data.completed) setDone(true);
      // Sincroniza seleção local com o que o servidor tem (após trocar de aba)
      if (data.myOffers) {
        const sel: Record<string, number> = {};
        data.myOffers.forEach((o: any) => {
          if (o.inventoryItemId) sel[o.inventoryItemId] = o.quantity || 1;
        });
        setMySel(sel);
      }
      // Sincroniza ouro/diamantes já oferecidos
      if (typeof data.myGold === "number") setMyGold(data.myGold > 0 ? String(data.myGold) : "");
      if (typeof data.myDiamonds === "number") setMyDiamonds(data.myDiamonds > 0 ? String(data.myDiamonds) : "");
    } catch {
      /* silencioso */
    }
  }, [characterId, sessionId, notify, onClose]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const refreshInv = async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.inventory) useGameStore.getState().setInventory(data.inventory);
      if (data.character) setCharacter(data.character);
    } catch {}
  };

  const selectItem = async (it: any) => {
    if (busy || state?.myConfirmed) return;
    setMySel((s) => {
      const next = { ...s };
      if (next[it.inv.id]) delete next[it.inv.id];
      else next[it.inv.id] = it.stackable ? Math.min(1, it.quantity || 1) : 1;
      return next;
    });
  };

  const changeQty = (id: string, qty: number, max: number) => {
    setMySel((s) => ({ ...s, [id]: Math.max(1, Math.min(max, Math.floor(qty) || 1)) }));
  };

  const pushSelection = async () => {
    if (!characterId || busy) return;
    setBusy(true);
    try {
      const items = Object.entries(mySel)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([id, qty]) => {
          const it = myItems.find((x) => x.inv.id === id);
          return { inventoryItemId: id, templateId: it?.template.id ?? 0, quantity: qty };
        });
      const res = await fetch("/api/trade-session/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, sessionId, items, gold: goldNum, diamonds: diamondsNum }),
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || "Erro", "error");
      else notify("✅ Oferta atualizada. Confirme quando estiver pronto!", "success");
      await load();
    } catch {
      notify("Erro ao atualizar itens", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmSide = async () => {
    if (!characterId || busy) return;
    // Troca de um lado só é permitida: dá para confirmar mesmo sem oferecer
    // nada (presente) — quem recebe só confirma. O servidor valida se pelo
    // menos UM lado ofereceu algo.
    setConfirming(true);
    setBusy(true);
    try {
      // Garante que a seleção está salva antes de confirmar
      const items = Object.entries(mySel)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([id, qty]) => {
          const it = myItems.find((x) => x.inv.id === id);
          return { inventoryItemId: id, templateId: it?.template.id ?? 0, quantity: qty };
        });
      await fetch("/api/trade-session/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, sessionId, items, gold: goldNum, diamonds: diamondsNum }),
      });
      const res = await fetch("/api/trade-session/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
      } else if (data.completed) {
        setDone(true);
        notify(data.message || "🎉 Troca concluída!", "success");
        await refreshInv();
      } else {
        notify(data.message || "✅ Lado confirmado!", "success");
      }
      await load();
    } catch {
      notify("Erro ao confirmar", "error");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const sendMsg = async () => {
    if (!characterId || !msg.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/trade-session/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, sessionId, text: msg }),
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || "Erro", "error");
      else setMsg("");
      await load();
    } catch {
      notify("Erro ao enviar", "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelSession = async () => {
    if (!characterId) return;
    setBusy(true);
    try {
      await fetch("/api/trade-session/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, sessionId }),
      });
      onClose();
    } catch {
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const otherOffers = state?.otherOffers ?? [];
  const myConfirmed = !!state?.myConfirmed;
  const otherConfirmed = !!state?.otherConfirmed;

  if (done) {
    return (
      <div className="game-card flex flex-col items-center gap-3 border-[#ffd700]/50 p-8 text-center">
        <div className="text-6xl" style={{ animation: "awakenFloat 1.6s ease-in-out infinite" }}>🎉</div>
        <h2 className="text-2xl font-black bg-gradient-to-r from-[#ffd700] to-[#ff6b6b] bg-clip-text text-transparent">
          TROCA CONCLUÍDA!
        </h2>
        <p className="text-sm text-gray-400">Os itens foram trocados com sucesso.</p>
        <button onClick={onClose} className="mt-2 rounded-xl bg-gradient-to-r from-[#e94560] to-[#ff7b81] px-6 py-2.5 text-sm font-black text-white">
          Voltar ao mercado
        </button>
      </div>
    );
  }

  return (
    <div className="game-card flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black">🔁 Sala de Troca</h3>
          <p className="text-[11px] text-gray-400">
            Com <b className="text-[#7c5cfc]">{state?.otherName ?? "Jogador"}</b> · os dois precisam confirmar · troca de um lado só é permitida
          </p>
        </div>
        <button onClick={cancelSession} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10">
          ✕ Cancelar sala
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Meu lado */}
        <div className={`rounded-2xl border p-3 ${myConfirmed ? "border-[#00ff88]/50 bg-[#00ff88]/5" : "border-white/10 bg-black/20"}`}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-white">
              {myName} <span className="text-[10px] font-normal text-gray-500">(você)</span>
            </p>
            {myConfirmed ? (
              <span className="rounded-full bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-black text-[#00ff88]">✓ Confirmado</span>
            ) : (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">Selecione os itens</span>
            )}
          </div>
          {myConfirmed ? (
            <div className="flex flex-wrap gap-1.5">
              {state?.myOffers?.length === 0 && state?.myGold <= 0 && state?.myDiamonds <= 0 && (
                <p className="text-xs text-gray-500">Você não enviou nada (recebendo apenas) ✓</p>
              )}
              {state?.myOffers?.map((o: any, i: number) => (
                <ItemChip key={i} item={{ template: o.template, quantity: o.quantity }} locale={locale} />
              ))}
              {Number(state?.myGold) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#ffd700]/15 px-2 py-1 text-[11px] font-bold text-[#ffd700]">
                  💰 {fmtNum(Number(state?.myGold))}
                </span>
              )}
              {Number(state?.myDiamonds) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#00d4ff]/15 px-2 py-1 text-[11px] font-bold text-[#00d4ff]">
                  💎 {fmtNum(Number(state?.myDiamonds))}
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {myItems.map((it) => {
                  const sel = Number(mySel[it.inv.id] || 0);
                  const disabled = busy;
                  return (
                    <button
                      key={it.inv.id}
                      onClick={() => selectItem(it)}
                      disabled={disabled}
                      className={`group relative flex flex-col items-center gap-0.5 rounded-xl border px-1.5 py-1 transition-all disabled:opacity-50 ${
                        sel > 0 ? "border-[#7c5cfc] bg-[#7c5cfc]/15" : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <ItemIcon template={it.template} className="h-9 w-9 object-contain" emojiClass="text-xl" alt="" />
                      <span className="max-w-[70px] truncate text-[8px] text-gray-300 group-hover:text-white">{itemName(it.template, locale)}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview({ template: it.template, quantity: it.quantity });
                        }}
                        title="Ver status do item"
                        className="mt-0.5 cursor-pointer rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-bold text-gray-300 opacity-70 transition hover:bg-[#7c5cfc] hover:text-white hover:opacity-100"
                      >
                        🔍
                      </span>
                      {sel > 0 && it.stackable && (
                        <input
                          type="number"
                          min={1}
                          max={it.quantity}
                          value={sel}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => changeQty(it.inv.id, Number(e.target.value), it.quantity)}
                          className="w-12 rounded bg-[#0f141f] px-1 py-0.5 text-center text-[9px] text-white"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Moedas na troca: pode oferecer ouro e/ou diamantes da conta */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 rounded-xl border border-[#ffd700]/20 bg-[#ffd700]/5 p-2">
                  <span className="text-[10px] font-bold text-[#ffd700]">💰 Ouro</span>
                  <input
                    type="number"
                    min={0}
                    max={myGoldBal}
                    value={myGold}
                    onChange={(e) => setMyGold(e.target.value)}
                    placeholder="0"
                    className="w-full rounded bg-[#0f141f] px-2 py-1 text-xs text-white placeholder:text-gray-600"
                  />
                  <span className="text-[9px] text-gray-500">Saldo: {fmtNum(myGoldBal)}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-2">
                  <span className="text-[10px] font-bold text-[#00d4ff]">💎 Diamantes</span>
                  <input
                    type="number"
                    min={0}
                    max={myDiamBal}
                    value={myDiamonds}
                    onChange={(e) => setMyDiamonds(e.target.value)}
                    placeholder="0"
                    className="w-full rounded bg-[#0f141f] px-2 py-1 text-xs text-white placeholder:text-gray-600"
                  />
                  <span className="text-[9px] text-gray-500">Saldo: {fmtNum(myDiamBal)}</span>
                </div>
              </div>
              <button
                onClick={pushSelection}
                disabled={busy}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#e94560] py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busy ? "…" : "📦 Salvar oferta"}
              </button>
            </>
          )}
        </div>

        {/* Lado do outro */}
        <div className={`rounded-2xl border p-3 ${otherConfirmed ? "border-[#00ff88]/50 bg-[#00ff88]/5" : "border-white/10 bg-black/20"}`}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-white">{state?.otherName ?? "Jogador"}</p>
            {otherConfirmed ? (
              <span className="rounded-full bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-black text-[#00ff88]">✓ Confirmado</span>
            ) : (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">Aguardando...</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {otherOffers.length === 0 && Number(state?.otherGold) <= 0 && Number(state?.otherDiamonds) <= 0 ? (
              <p className="text-xs text-gray-500">O outro jogador ainda não selecionou nada.</p>
            ) : (
              <>
                {otherOffers.map((o: any, i: number) => (
                  <ItemChip key={i} item={{ template: o.template, quantity: o.quantity }} locale={locale} />
                ))}
                {Number(state?.otherGold) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#ffd700]/15 px-2 py-1 text-[11px] font-bold text-[#ffd700]">
                    💰 {fmtNum(Number(state?.otherGold))}
                  </span>
                )}
                {Number(state?.otherDiamonds) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#00d4ff]/15 px-2 py-1 text-[11px] font-bold text-[#00d4ff]">
                    💎 {fmtNum(Number(state?.otherDiamonds))}
                  </span>
                )}
                {otherOffers.length === 0 && (
                  <p className="w-full text-[10px] text-gray-500">Sem itens — só moedas.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat da sala */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">💬 Chat da troca</p>
        <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
          {(state?.chat ?? []).map((m: any, i: number) => (
            <div key={i} className={`flex ${m.senderId === characterId ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] ${
                  m.senderId === characterId ? "bg-[#7c5cfc]/25 text-white" : "bg-white/10 text-gray-200"
                }`}
              >
                <span className="mr-1.5 font-bold text-[#7c5cfc]">{m.senderId === characterId ? "Você" : m.senderName}:</span>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMsg()}
            placeholder="Negociar com o outro jogador..."
            className="flex-1 rounded-lg border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:border-[#7c5cfc] focus:outline-none"
          />
          <button onClick={sendMsg} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">
            Enviar
          </button>
        </div>
      </div>

      {/* Confirmação dupla */}
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#ffd700]/30 bg-[#ffd700]/5 p-3">
        <p className="text-[11px] text-gray-400">
          Quando os <b className="text-white">dois</b> confirmarem, a troca acontece automaticamente. Quem
          recebe pode confirmar sem enviar nada — só o outro lado precisa oferecer itens ou moedas.
          {myConfirmed && !otherConfirmed && " Aguardando a confirmação do outro jogador..."}
        </p>
        <button
          onClick={confirmSide}
          disabled={busy || myConfirmed}
          className={`w-full rounded-xl py-2.5 text-sm font-black transition-all ${
            myConfirmed
              ? "bg-[#00ff88]/15 text-[#00ff88]"
              : "bg-gradient-to-r from-[#ffd700] to-[#ff9f1a] text-black hover:brightness-110"
          } disabled:opacity-60`}
        >
          {myConfirmed ? "✓ Você confirmou — aguardando o outro" : confirming ? "…" : "✅ Confirmar minha troca"}
        </button>
      </div>

      <ItemPreviewModal item={preview} locale={locale} onClose={() => setPreview(null)} />
    </div>
  );
}

/* ==================== ABA: ANÚNCIOS DE TROCA ==================== */
function TradeAdsTab({ onRefreshCharacter, onOpenSession }: { onRefreshCharacter: () => void; onOpenSession: (sessionId: string) => void }) {
  const { characterId, character, locale, notify, inventory } = useGameStore();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [openAdId, setOpenAdId] = useState<string | null>(null);
  // Chats PRIVADOS por anúncio: { [adId]: mensagens da minha conversa }
  const [chats, setChats] = useState<Record<string, any[]>>({});
  // Para o DONO: em qual conversa ele está em cada anúncio dele
  const [activeThread, setActiveThread] = useState<Record<string, string>>({});
  // Mapa de conversas completo do dono: { [adId]: { [playerId]: msgs } }
  const [chatByPlayer, setChatByPlayer] = useState<Record<string, Record<string, any[]>>>({});
  const [chatMsg, setChatMsg] = useState("");
  const [openingSession, setOpeningSession] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  // Form de criação
  const [title, setTitle] = useState("");
  const [want, setWant] = useState("");
  const [adSel, setAdSel] = useState<Record<string, number>>({});

  const myItems = useMemo(
    () =>
      (Array.isArray(inventory) ? inventory : [])
        .map((entry: any) => ({
          inv: entry.item || entry.inv || entry,
          template: entry.template || {},
          quantity: entry.quantity ?? entry.item?.quantity ?? 1,
          stackable: !!entry.stackable || entry.template?.type === "consumable",
        }))
        .filter((it) => !it.inv.equipped && !it.inv.listed && !it.inv.reservedFor)
        .slice(0, 40),
    [inventory]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-ads");
      const data = await res.json();
      if (Array.isArray(data.ads)) setAds(data.ads);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const loadChat = useCallback(
    async (adId: string) => {
      if (!characterId) return;
      try {
        const res = await fetch(`/api/trade-ads/chat?adId=${encodeURIComponent(adId)}&characterId=${encodeURIComponent(characterId)}`);
        const data = await res.json();
        if (!res.ok) {
          notify(data.error || "Erro", "error");
          return;
        }
        // Minha conversa com o dono (interessado) ou vazio (dono)
        setChats((c) => ({ ...c, [adId]: Array.isArray(data.chat) ? data.chat : [] }));
        // Para o dono: todas as conversas, cada uma no seu card
        if (data.chatByPlayer) {
          setChatByPlayer((m) => ({ ...m, [adId]: data.chatByPlayer }));
        }
      } catch {}
    },
    [characterId, notify]
  );

  const toggleChat = async (adId: string) => {
    if (openAdId === adId) {
      setOpenAdId(null);
      return;
    }
    setOpenAdId(adId);
    await loadChat(adId);
  };

  useEffect(() => {
    if (!openAdId) return;
    const id = setInterval(() => void loadChat(openAdId), 4000);
    return () => clearInterval(id);
  }, [openAdId, loadChat]);

  // Envia mensagem: interessado fala com o dono; o dono responde na conversa ativa.
  const sendChat = async (adId: string, toId?: string) => {
    if (!characterId || !chatMsg.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/trade-ads/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, adId, text: chatMsg, toId }),
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || "Erro", "error");
      else setChatMsg("");
      await loadChat(adId);
    } catch {
      notify("Erro ao enviar", "error");
    } finally {
      setBusy(false);
    }
  };

  const createAd = async () => {
    if (!characterId) return;
    const sel = Object.entries(adSel).filter(([, q]) => Number(q) > 0);
    if (sel.length === 0) {
      notify("Selecione os itens que você oferece", "error");
      return;
    }
    setBusy(true);
    try {
      const offeredItems = sel.map(([id, qty]) => {
        const it = myItems.find((x) => x.inv.id === id);
        return { inventoryItemId: id, templateId: it?.template.id ?? 0, quantity: qty };
      });
      const res = await fetch("/api/trade-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, title, want, offeredItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
        return;
      }
      notify(data.message || "📢 Anúncio criado!", "success");
      setShowForm(false);
      setTitle("");
      setWant("");
      setAdSel({});
      onRefreshCharacter();
      await load();
    } catch {
      notify("Erro ao criar anúncio", "error");
    } finally {
      setBusy(false);
    }
  };

  const openSession = async (adId: string, targetId?: string) => {
    if (!characterId || openingSession) return;
    setOpeningSession(true);
    try {
      const res = await fetch("/api/trade-session/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, adId, targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
        return;
      }
      notify(data.message || "🔁 Sala aberta!", "success");
      if (data.session) onOpenSession(data.session.id);
    } catch {
      notify("Erro ao abrir sala", "error");
    } finally {
      setOpeningSession(false);
    }
  };

  // Remove um anúncio de troca próprio.
  const removeAd = async (adId: string) => {
    if (!characterId || busy) return;
    const ok = window.confirm("Remover este anúncio de troca?");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/trade-ads/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, adId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao remover", "error");
      } else {
        notify(data.message || "🗑️ Anúncio removido.", "success");
        await load();
      }
    } catch {
      notify("Erro ao remover", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadSessions = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/trade-session/sessions?characterId=${encodeURIComponent(characterId)}`);
      const data = await res.json();
      if (Array.isArray(data.sessions)) setSessions(data.sessions);
    } catch {}
  }, [characterId]);

  useEffect(() => {
    void loadSessions();
    const id = setInterval(loadSessions, 5000);
    return () => clearInterval(id);
  }, [loadSessions]);

  const mine = ads.filter((a: any) => a.record.posterId === characterId).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Salas de troca ativas envolvendo você */}
      {sessions.length > 0 && (
        <div className="game-card flex flex-col gap-2 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7c5cfc]">🔁 Salas de troca ativas</p>
          {sessions.map((s: any) => (
            <div key={s.record.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{s.record.title || "Troca"}</p>
                <p className="text-[10px] text-gray-500">
                  Com <b className="text-[#7c5cfc]">{s.other?.name ?? "Jogador"}</b>
                  {s.otherConfirmed ? " · ✓ ele(a) confirmou" : s.myConfirmed ? " · ✓ você confirmou" : ""}
                </p>
              </div>
              <button
                onClick={() => onOpenSession(s.record.id)}
                className="shrink-0 rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#e94560] px-3 py-1.5 text-xs font-black text-white"
              >
                Entrar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-400">
          Anúncios públicos de troca: negocie no chat e abra a sala quando chegarem num acordo.{" "}
          {mine > 0 && <span className="text-[#ffd700]">Você tem {mine}/{MAX_TRADE_ADS_PER_CHAR} anúncios.</span>}
        </p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#ff9f1a] px-4 py-2 text-sm font-black text-black transition-all hover:brightness-110"
        >
          {showForm ? "✕ Fechar" : "📢 Criar anúncio"}
        </button>
      </div>

      {showForm && (
        <div className="game-card flex flex-col gap-3 p-4">
          <h3 className="text-sm font-black">📢 Criar anúncio de troca</h3>
          <label className="flex flex-col gap-1 text-[11px] text-gray-400">
            Título (ex.: "Troco espada mítica por armaduras")
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Troco espada mítica por armaduras épicas"
              className="rounded-xl border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#ffd700] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-gray-400">
            O que você quer em troca (descrição livre)
            <input
              value={want}
              onChange={(e) => setWant(e.target.value)}
              placeholder="Ex.: armaduras épicas ou lendárias, 500k de ouro..."
              className="rounded-xl border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#ffd700] focus:outline-none"
            />
          </label>
          <div>
            <p className="mb-1.5 text-[11px] text-gray-400">Itens que você oferece:</p>
            <div className="flex flex-wrap gap-1.5">
              {myItems.map((it) => {
                const sel = Number(adSel[it.inv.id] || 0);
                return (
                  <button
                    key={it.inv.id}
                    onClick={() =>
                      setAdSel((s) => {
                        const next = { ...s };
                        if (sel > 0) delete next[it.inv.id];
                        else next[it.inv.id] = 1;
                        return next;
                      })
                    }
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-1.5 py-1 transition-all ${
                      sel > 0 ? "border-[#ffd700] bg-[#ffd700]/10" : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <ItemIcon template={it.template} className="h-9 w-9 object-contain" emojiClass="text-xl" alt="" />
                    <span className="max-w-[70px] truncate text-[8px] text-gray-300">{itemName(it.template, locale)}</span>
                    {sel > 0 && it.stackable && (
                      <input
                        type="number"
                        min={1}
                        max={it.quantity}
                        value={sel}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setAdSel((s) => ({ ...s, [it.inv.id]: Math.max(1, Math.min(it.quantity, Math.floor(Number(e.target.value) || 1))) }))
                        }
                        className="w-12 rounded bg-[#0f141f] px-1 py-0.5 text-center text-[9px] text-white"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={createAd}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-[#ffd700] to-[#ff9f1a] py-2.5 text-sm font-black text-black transition-all hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "…" : "📢 Publicar anúncio"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <span className="animate-bounce text-3xl">📢</span>
        </div>
      ) : ads.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-12 text-sm text-gray-500">
          Nenhum anúncio de troca ativo. Crie o primeiro!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ads.map((entry: any) => {
            const ad = entry.record;
            const poster = entry.poster;
            const isMine = ad.posterId === characterId;
            const isOpen = openAdId === ad.id;
            return (
              <div key={ad.id} className={`game-card flex flex-col gap-2 p-3 ${isMine ? "border-[#ffd700]/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{ad.title || "Troca"}</p>
                    <p className="text-[10px] text-gray-500">
                      {poster ? `${poster.name} · Lv ${poster.level}` : "Jogador"}
                      {isMine && <span className="ml-1.5 text-[#ffd700]">(você)</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isMine && (
                      <button
                        onClick={() => void removeAd(ad.id)}
                        disabled={busy}
                        className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] font-bold text-gray-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                        title="Remover anúncio"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      onClick={() => toggleChat(ad.id)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                        isOpen ? "bg-[#7c5cfc] text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
                      }`}
                    >
                      💬 {isOpen ? "Fechar" : "Chat"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {entry.offeredItems.map((o: any, i: number) => (
                    <ItemChip key={i} item={{ template: o.template, quantity: o.quantity }} locale={locale} />
                  ))}
                </div>

                <p className="rounded-lg bg-[#ffd700]/5 px-2.5 py-1.5 text-[11px] text-gray-300">
                  <span className="font-bold text-[#ffd700]">Quer:</span> {ad.want || "—"}
                </p>

                {isOpen && (
                  <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
                    {/* DONO do anúncio: seletor de conversa (cada interessado tem a própria) */}
                    {isMine && (() => {
                      const byPlayer = chatByPlayer[ad.id] || {};
                      const threadIds = Object.keys(byPlayer);
                      const activeId = activeThread[ad.id] || threadIds[0] || null;
                      const msgs = activeId ? byPlayer[activeId] || [] : [];
                      const otherName = activeId
                        ? byPlayer[activeId][0]?.senderName || "Jogador"
                        : "";
                      return (
                        <>
                          {threadIds.length === 0 ? (
                            <p className="py-2 text-center text-[11px] text-gray-500">
                              Ninguém falou com você ainda. Quando um jogador te chamar, a conversa aparece aqui.
                            </p>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-1.5">
                                {threadIds.map((tid) => {
                                  const name = byPlayer[tid]?.[0]?.senderName || "Jogador";
                                  return (
                                    <button
                                      key={tid}
                                      onClick={() => setActiveThread((a) => ({ ...a, [ad.id]: tid }))}
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                                        activeId === tid ? "bg-[#7c5cfc] text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
                                      }`}
                                    >
                                      💬 {name}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                                {msgs.length === 0 ? (
                                  <p className="py-2 text-center text-[11px] text-gray-500">Conversa vazia.</p>
                                ) : (
                                  msgs.map((m: any, i: number) => (
                                    <div key={i} className={`flex ${m.senderId === characterId ? "justify-end" : "justify-start"}`}>
                                      <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] ${m.senderId === characterId ? "bg-[#7c5cfc]/25 text-white" : "bg-white/10 text-gray-200"}`}>
                                        <span className="mr-1.5 font-bold text-[#7c5cfc]">{m.senderId === characterId ? "Você" : m.senderName}:</span>
                                        {m.text}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={chatMsg}
                                  onChange={(e) => setChatMsg(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && activeId && sendChat(ad.id, activeId)}
                                  placeholder={`Responder ${otherName}...`}
                                  className="flex-1 rounded-lg border border-white/10 bg-[#0f141f]/80 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-[#7c5cfc] focus:outline-none"
                                />
                                <button
                                  onClick={() => activeId && sendChat(ad.id, activeId)}
                                  className="rounded-lg bg-[#7c5cfc] px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  ➤
                                </button>
                              </div>
                              {activeId && (
                                <button
                                  onClick={() => openSession(ad.id, activeId)}
                                  disabled={openingSession}
                                  className="w-full rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#e94560] py-2 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-50"
                                >
                                  {openingSession ? "…" : "🔁 Iniciar trade"}
                                </button>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}

                    {/* INTERESSADO: conversa dele com o dono + botão iniciar trade */}
                    {!isMine && (() => {
                      const msgs = chats[ad.id] || [];
                      return (
                        <>
                          <p className="text-[10px] text-gray-500">
                            💬 Conversa privada com <b className="text-[#7c5cfc]">{poster?.name || "Jogador"}</b> — ninguém mais vê.
                          </p>
                          <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                            {msgs.length === 0 ? (
                              <p className="py-2 text-center text-[11px] text-gray-500">Comece a negociação...</p>
                            ) : (
                              msgs.map((m: any, i: number) => (
                                <div key={i} className={`flex ${m.senderId === characterId ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] ${m.senderId === characterId ? "bg-[#7c5cfc]/25 text-white" : "bg-white/10 text-gray-200"}`}>
                                    <span className="mr-1.5 font-bold text-[#7c5cfc]">{m.senderId === characterId ? "Você" : m.senderName}:</span>
                                    {m.text}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={chatMsg}
                              onChange={(e) => setChatMsg(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && sendChat(ad.id)}
                              placeholder="Negociar..."
                              className="flex-1 rounded-lg border border-white/10 bg-[#0f141f]/80 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-[#7c5cfc] focus:outline-none"
                            />
                            <button onClick={() => sendChat(ad.id)} className="rounded-lg bg-[#7c5cfc] px-3 py-1.5 text-xs font-bold text-white">
                              ➤
                            </button>
                          </div>
                          <button
                            onClick={() => openSession(ad.id)}
                            disabled={openingSession}
                            className="w-full rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#e94560] py-2 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-50"
                          >
                            {openingSession ? "…" : "🔁 Iniciar trade"}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== PAINEL PRINCIPAL ==================== */
export default function MarketPanel() {
  const { character, characterId, locale, notify, setCharacter } = useGameStore();
  const [tab, setTab] = useState<"browse" | "sell" | "ads">("browse");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const char = character as any;

  // Recarrega personagem + inventário juntos (após anunciar/comprar/cancelar).
  const refreshAll = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      if (data.inventory) {
        const { setInventory } = useGameStore.getState();
        setInventory(data.inventory);
      }
    } catch {
      /* silencioso */
    }
  }, [characterId, setCharacter]);

  // Recarrega ao abrir o painel para o inventário nunca ficar desatualizado.
  useEffect(() => {
    if (characterId) void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const handleRefresh = refreshAll;

  const level = Number(char?.level) || 1;
  const canUse = level >= MARKET_MIN_LEVEL;

  if (!character) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#ffd700]/50 bg-gradient-to-br from-[#7c5cfc] to-[#e94560] shadow-[0_0_20px_rgba(233,69,96,0.35)]">
            <img src="/images/marketplace/icone_marketplace.png" alt="Mercado" className="h-10 w-10 object-contain" draggable={false} />
          </div>
          <div>
            <h1 className="text-2xl font-black">
              <span className="bg-gradient-to-r from-[#ffd700] via-[#ff6b6b] to-[#7c5cfc] bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
                Mercado
              </span>
            </h1>
            <p className="text-xs text-gray-500">Compre, venda e troque com outros jogadores</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-xl border border-white/10 bg-bg-surface px-3 py-1.5 font-bold text-yellow-300">
            {fmt(char?.gold)} 🪙
          </span>
          <span className="rounded-xl border border-white/10 bg-bg-surface px-3 py-1.5 font-bold text-cyan-300">
            {fmt(char?.diamonds)} 💎
          </span>
        </div>
      </div>

      {!canUse && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          🔒 O mercado desbloqueia no nível {MARKET_MIN_LEVEL}. Atualmente você está no nível {level}.
        </div>
      )}

      {/* Abas */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("browse")} className={chipCls(tab === "browse")}>
          🛍️ Mercado
        </button>
        <button onClick={() => setTab("sell")} className={chipCls(tab === "sell")}>
          📦 Vender
        </button>
        <button onClick={() => setTab("ads")} className={chipCls(tab === "ads")}>
          <img src="/images/marketplace/icone_trade.png" alt="" className="mr-1 inline h-4 w-4 object-contain" draggable={false} />
          Anúncios de Troca
        </button>
      </div>

      {sessionId ? (
        <TradeSessionView
          sessionId={sessionId}
          onClose={() => {
            setSessionId(null);
            setTab("ads");
          }}
        />
      ) : !canUse ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-16 text-sm text-gray-500">
          Suba para o nível {MARKET_MIN_LEVEL} para usar o mercado.
        </div>
      ) : (
        <>
          {tab === "browse" && <BrowseTab onRefreshCharacter={handleRefresh} />}
          {tab === "sell" && <SellTab onRefreshCharacter={handleRefresh} />}
          {tab === "ads" && <TradeAdsTab onRefreshCharacter={handleRefresh} onOpenSession={setSessionId} />}
        </>
      )}
    </div>
  );
}
