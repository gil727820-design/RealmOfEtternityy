"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS, classImage, powerCalc, type ClassName } from "@/game/constants";
import { skinById, SKIN_CATALOG, type SkinTemplate } from "@/game/skins";
import { skinBuffDesc } from "@/game/skinBuffs";
import { boostSummary, formatBoostMs } from "@/game/boosts";
import ItemIcon from "@/components/ui/ItemIcon";

// ---------------------------------------------------------------- utilidades
function chipCls(active: boolean) {
  return `px-3 py-1.5 rounded-full text-sm border transition-all ${
    active
      ? "bg-[#e94560] text-white font-bold border-[#e94560]"
      : "bg-white/10 text-gray-300 hover:text-white border-white/10"
  }`;
}

/** Formata número com separador de milhar. */
function fmt(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("pt-BR");
}

/** Normaliza texto para busca ignorando acentos/maiúsculas. */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function rarityLabel(rarity: string | undefined, locale: string): string {
  if (!rarity) return "—";
  const key = `rarity.${rarity}`;
  const label = t(key, locale);
  return label === key ? rarity : label;
}

/** Traduz o efeito de um consumível, ex.: "Restaura 150 de vida". */
function effectLabel(effectKey: string, value: number, locale: string): string {
  const map: Record<string, string> = {
    hp: "eff.hp",
    mana: "eff.mana",
    energy: "eff.energy",
    xp: "eff.xp",
    boostXpHours: "eff.boostXpHours",
    boostEnergyHours: "eff.boostEnergyHours",
  };
  const key = map[effectKey] ?? "eff.hp";
  return t(key, locale).replace("{0}", fmt(value));
}

/**
 * Aba "Skins" do inventário: mostra as skins recebidas, deixa equipar/desequipar
 * (só as da própria classe) e exibe o buff de combate ativado pela skin.
 */
function SkinsTab() {
  const { character, characterId, locale, notify, setCharacter } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);

  const owned: string[] = Array.isArray(character?.skins) ? (character.skins as string[]) : [];
  const active = character?.activeSkinId as string | null | undefined;
  const list = owned
    .map((id) => skinById(id))
    .filter((s): s is SkinTemplate => !!s);

  const activeSkin = active ? skinById(active) : null;

  const equip = async (skinId: string | null) => {
    if (!characterId || busy) return;
    setBusy(skinId ?? "unequip");
    try {
      const res = await fetch("/api/inventory/skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, skinId, unequip: skinId == null }),
      });
      const d = await res.json();
      if (!res.ok || !d.character) {
        notify(d?.error || t("general.error", locale), "error");
      } else {
        setCharacter(d.character);
        notify(
          skinId ? `✅ ${t("inv.skinEquip", locale)}!` : `${t("inv.skinUnequip", locale)}!`,
          "success"
        );
      }
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">🎨 {t("inv.skins", locale)}</h2>
        <span className="text-xs text-gray-400">{list.length}/{SKIN_CATALOG.length}</span>
      </div>

      {activeSkin && (
        <div className="flex items-center gap-3 rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 p-3">
          <img src={activeSkin.image} alt="" className="h-16 w-16 object-contain" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#e94560]">
              {t("inv.skinEquipped", locale)}
            </p>
            <p className="truncate text-sm font-bold text-white">{t(activeSkin.nameKey, locale)}</p>
            <p className="text-[11px] text-gray-300">{skinBuffDesc(activeSkin.id, locale)}</p>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">🎨 {t("inv.noSkins", locale)}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {list.map((s) => {
            const isActive = active === s.id;
            const equipable = s.className === character?.classType;
            return (
              <div
                key={s.id}
                className={`game-card flex flex-col items-center gap-2 p-3 text-center ${isActive ? "ring-2 ring-[#e94560]" : ""}`}
                style={{ borderColor: RARITY_COLORS[s.rarity] ?? "#ffffff33" }}
              >
                <img src={s.image} alt="" className="h-20 w-20 object-contain" />
                <span className="block w-full truncate text-xs font-bold text-white">{t(s.nameKey, locale)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: RARITY_COLORS[s.rarity] ?? "#3b4252" }}
                >
                  {rarityLabel(s.rarity, locale)}
                </span>
                <span className="text-[10px] text-gray-500">{skinBuffDesc(s.id, locale)}</span>
                {!equipable && !isActive && (
                  <span className="text-[9px] text-gray-500">{t("skin.otherClass", locale)}</span>
                )}
                <button
                  onClick={() => equip(isActive ? null : s.id)}
                  disabled={busy !== null || (!equipable && !isActive)}
                  className={`w-full rounded-lg py-1.5 text-xs font-black transition-all ${
                    isActive
                      ? "border border-white/15 bg-white/10 text-gray-300"
                      : equipable
                        ? "bg-gradient-to-r from-[#e94560] to-[#ff7b81] text-white"
                        : "bg-white/5 text-gray-500"
                  }`}
                >
                  {busy === s.id ? "…" : isActive ? t("inv.skinUnequip", locale) : t("inv.skinEquip", locale)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Aba "Boosts" (abaixo da seção de skins): mostra os boosts ATIVOS (2x XP /
 * 2x Energia com tempo restante) e as poções de boost disponíveis para usar.
 */
function BoostSection() {
  const { character, characterId, inventory, locale, notify, setCharacter, setInventory } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Renova o contador de tempo restante a cada segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const s = boostSummary(character);

  // Poções de boost (stacked) presentes no inventário.
  const pots = (Array.isArray(inventory) ? inventory : [])
    .map((entry) => ({
      inv: (entry as any).item || (entry as any).inv || entry,
      template: (entry as any).template || {},
      quantity: (entry as any).quantity ?? (entry as any).item?.quantity ?? 1,
    }))
    .filter((it) => it.template?.type === "consumable")
    .filter((it) => {
      const e = it.template.effect || {};
      return Number(e.boostXpHours || 0) > 0 || Number(e.boostEnergyHours || 0) > 0;
    })
    .filter((it) => (it.quantity ?? 1) > 0);

  const refresh = async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/character/${characterId}`);
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      if (data.inventory) setInventory(data.inventory);
    } catch {}
  };

  const usePotion = async (id: string) => {
    if (!characterId) return;
    setBusy(id);
    try {
      const res = await fetch("/api/inventory/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId: id, characterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("boost.useError", locale));
      notify(t("boost.activated", locale), "success");
      await refresh();
    } catch (e: any) {
      notify(e?.message || t("boost.useError", locale), "error");
    }
    setBusy(null);
  };

  const cards = [
    { key: "xp", on: s.xpActive, ms: s.xpRemainingMs, icon: "🚀", labelKey: "boost.xp" },
    { key: "energy", on: s.energyActive, ms: s.energyRemainingMs, icon: "🔋", labelKey: "boost.energy" },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <div>
          <h2 className="text-sm font-black">{t("boost.title", locale)}</h2>
          <p className="text-[10px] text-gray-500">{t("boost.subtitle", locale)}</p>
        </div>
      </div>

      {/* Boosts ativos */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cards.map((b) => (
          <div
            key={b.key}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
              b.on
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{b.icon}</span>
              <span className="text-xs font-bold text-gray-200">{t(b.labelKey, locale)}</span>
            </div>
            {b.on ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                2x • {formatBoostMs(b.ms)}
              </span>
            ) : (
              <span className="text-[10px] text-gray-500">{t("boost.inactive", locale)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Poções de boost disponíveis */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">
          {t("boost.potions", locale)}
        </span>
        {pots.length === 0 ? (
          <p className="text-xs text-gray-500">{t("boost.noPotions", locale)}</p>
        ) : (
          pots.map((it) => (
            <div
              key={it.inv.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              style={{ borderColor: RARITY_COLORS[it.template.rarity] ?? "#ffffff1a" }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <ItemIcon template={it.template} emojiClass="text-lg" alt={t(it.template?.nameKey || "", locale)} />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-white">
                    {t(it.template.nameKey || "", locale)}
                  </span>
                  <span className="text-[10px] text-gray-500">×{it.quantity}</span>
                </div>
              </div>
              <button
                onClick={() => usePotion(it.inv.id)}
                disabled={busy === it.inv.id}
                className="shrink-0 rounded-lg bg-gradient-to-r from-[#e94560] to-[#ff7b81] px-3 py-1 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-50"
              >
                {busy === it.inv.id ? "…" : t("boost.use", locale)}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
// ------------------------------------------------------------------- dados
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"];

const SLOT_ICON: Record<string, string> = {
  weapon: "⚔️", shield: "🛡️", helmet: "⛑️", armor: "🦺", pants: "👖",
  boots: "👢", gloves: "🧤", ring: "💍", amulet: "📿", relic: "🔮", artifact: "🗿",
};

const EQUIP_SLOTS: Array<{ slot: string; cell: string }> = [
  { slot: "ring", cell: "col-start-1 row-start-1" },
  { slot: "helmet", cell: "col-start-2 row-start-1" },
  { slot: "amulet", cell: "col-start-3 row-start-1" },
  { slot: "relic", cell: "col-start-1 row-start-2" },
  { slot: "artifact", cell: "col-start-3 row-start-2" },
  { slot: "gloves", cell: "col-start-1 row-start-3" },
  { slot: "armor", cell: "col-start-2 row-start-3" },
  { slot: "weapon", cell: "col-start-3 row-start-3" },
  { slot: "shield", cell: "col-start-1 row-start-4" },
  { slot: "pants", cell: "col-start-2 row-start-4" },
  { slot: "boots", cell: "col-start-3 row-start-4" },
];

const CATEGORY_GROUPS: Record<string, string[]> = {
  weapons: ["weapon"],
  armor: ["armor", "helmet", "shield", "pants", "boots", "gloves"],
  accessories: ["ring", "amulet", "relic", "artifact"],
};

const CATEGORY_ICONS: Record<string, string> = {
  all: "🗂️",
  visual: "🧍",
  weapons: "⚔️",
  armor: "🛡️",
  accessories: "💍",
  consumables: "🧪",
  skins: "🎨",
};

const STATS: Array<{ key: string; labelKey: string }> = [
  { key: "attack", labelKey: "stat.attack" },
  { key: "defense", labelKey: "stat.defense" },
  { key: "hp", labelKey: "stat.hp" },
  { key: "speed", labelKey: "stat.speed" },
  { key: "critical", labelKey: "stat.critical" },
];

const EFFECT_ORDER = ["hp", "mana", "energy", "xp", "boostXpHours", "boostEnergyHours"];

function WalletPill({ img, alt, value, tint }: { img: string; alt: string; value: string; tint?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-bg-surface border border-white/10">
      <img src={img} alt={alt} className="w-5 h-5 object-contain" draggable={false} />
      <span className={`text-sm font-bold whitespace-nowrap ${tint || "text-white"}`}>{value}</span>
    </div>
  );
}
// ===================================================================== painel
function VisualTab() {
  const { character, locale } = useGameStore();
  const char = character as any;
  const cls = (char?.classType as ClassName) || "warrior";
  const sex = (char?.sex as string) || "male";
  const baseImg = classImage(cls, sex);
  const activeSkin = (char?.activeSkinId as string | null | undefined)
    ? skinById(String(char?.activeSkinId))
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">🧍 {t("inv.visual.title", locale)}</h2>
        <span className="text-xs text-gray-400">{t("inv.visual.subtitle", locale)}</span>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[220px_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2436] to-[#0f141f] p-4">
          <div className="pointer-events-none absolute top-2 right-3 text-[9px] uppercase tracking-widest text-gray-600">
            {t("inv.visual.title", locale)}
          </div>
          <div className="grid place-items-center pt-4 pb-2">
            <img
              src={baseImg}
              alt={cls}
              className="h-40 w-auto max-w-full object-contain animate-float drop-shadow-[0_0_18px_rgba(233,69,96,0.4)]"
              draggable={false}
            />
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[11px]">
            <span className="rounded-full bg-[#e94560]/20 px-2 py-0.5 font-bold text-[#e94560]">
              Lv {char?.level ?? 1}
            </span>
            <span className="text-gray-400">{char?.power ?? 0} ⚡</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-gray-400">
            🧍 {t("inv.visual.legend", locale)}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <span className="text-[10px] uppercase tracking-widest text-gray-500">🎨 {t("inv.skinEquipped", locale)}</span>
            {activeSkin ? (
              <div className="flex items-center gap-2">
                <img src={activeSkin.image} alt="" className="h-9 w-9 object-contain" />
                <span className="text-sm font-bold text-white">{t(activeSkin.nameKey, locale)}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-500">{t("inv.visualNone", locale)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPanel() {
  const { characterId, locale, notify, character, setCharacter, setInventory } = useGameStore();
  const char = character as any;

  const [items, setItems] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [slotFilter, setSlotFilter] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sellPending, setSellPending] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<string | null>(null);
  const [sellAllPending, setSellAllPending] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [equipFx, setEquipFx] = useState<{ tick: number; slot: string | null }>({ tick: 0, slot: null });
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const charImg = classImage((char?.classType as ClassName) || "warrior", (char?.sex as string) || "male");

  // Limpa timers ao desmontar
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Depois de 4s os botões de "confirmar" voltam ao normal
  const scheduleReset = (id: string) => {
    const timer = setTimeout(() => {
      setSellPending((p) => (p === id ? null : p));
      setRemovePending((p) => (p === id ? null : p));
      setSellAllPending((p) => (p === id ? null : p));
    }, 4000);
    timers.current.push(timer);
  };

  // Seleciona um item e reinicia a quantidade escolhida para vender/remover
  const selectItem = (id: string | null) => {
    setSelectedId(id);
    setAmount(1);
  };

  const loadAll = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/character/${characterId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      if (data.inventory) setInventory(data.inventory);
      const inv = (data.inventory ?? []).map((entry: any) => ({
        inv: entry.item || entry.inv || entry,
        template: entry.template || {},
        stackable: !!entry.stackable || entry.template?.type === "consumable",
        quantity: entry.quantity ?? entry.item?.quantity ?? entry.inv?.quantity ?? 1,
        totalSellValue: entry.totalSellValue ?? (entry.template?.sellPrice || 0) * (entry.item?.quantity ?? 1),
      }));
      setItems(inv);
      setSelectedId((sel) => (sel && !inv.some((it: any) => it.inv.id === sel) ? null : sel));
    } catch {
      notify(t("inv.loadError", locale), "error");
    }
    setLoading(false);
  }, [characterId, locale, notify, setCharacter, setInventory]);

  useEffect(() => {
    // Dispara no próximo tick para evitar setState síncrono no corpo do efeito
    const timer = setTimeout(() => void loadAll(), 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  // Mapa de slot → item equipado (usado nos slots e na comparação de stats)
  const equippedMap = useMemo(() => {
    const m = new Map<string, any>();
    items.forEach((it) => {
      if (it.inv?.equipped && it.template?.slot) m.set(it.template.slot, it);
    });
    return m;
  }, [items]);

  // Avatar: imagem estática da classe por enquanto (o sistema de skins
  // substituirá essa renderização no futuro).

  const availableSlots = useMemo(
    () => Array.from(new Set(items.map((it) => it.template?.slot).filter(Boolean))) as string[],
    [items]
  );
  const availableRarities = useMemo(
    () => Array.from(new Set(items.map((it) => it.template?.rarity).filter(Boolean))) as string[],
    [items]
  );

  const totalSlots = items.length;
  const capacity = 60;
  const totalValue = useMemo(
    () => items.reduce((acc, it) => acc + (it.template?.sellPrice || 0) * (it.quantity ?? 1), 0),
    [items]
  );

  // Filtragem + ordenação (busca normalizada, categoria, slot, raridade, sort)
  const visible = useMemo(() => {
    const q = normalize(search);
    const group = CATEGORY_GROUPS[category] ?? null;
    const filtered = items.filter((it) => {
      const tmpl = it.template || {};
      if (q && !normalize(t(tmpl.nameKey || "", locale)).includes(q)) return false;
      if (category === "consumables" && tmpl.type !== "consumable") return false;
      if (category !== "consumables" && group && !group.includes(tmpl.slot)) return false;
      if (slotFilter && tmpl.slot !== slotFilter) return false;
      if (rarityFilter && tmpl.rarity !== rarityFilter) return false;
      return true;
    });
    const sorted = [...filtered];
    const rank = (r?: string) => {
      const i = RARITY_ORDER.indexOf(r || "");
      return i === -1 ? -1 : i;
    };
    switch (sortBy) {
      case "rarity":
        sorted.sort(
          (a, b) =>
            rank(b.template?.rarity) - rank(a.template?.rarity) ||
            (b.template?.minLevel || 1) - (a.template?.minLevel || 1)
        );
        break;
      case "level":
        sorted.sort(
          (a, b) =>
            (b.template?.minLevel || 1) - (a.template?.minLevel || 1) ||
            rank(b.template?.rarity) - rank(a.template?.rarity)
        );
        break;
      case "value":
        sorted.sort((a, b) => (b.totalSellValue || 0) - (a.totalSellValue || 0));
        break;
      case "name":
        sorted.sort((a, b) =>
          t(a.template?.nameKey || "", locale).localeCompare(t(b.template?.nameKey || "", locale))
        );
        break;
      default:
        break; // "newest": a API já retorna ordenado por obtainedAt
    }
    return sorted;
  }, [items, search, category, slotFilter, rarityFilter, sortBy, locale]);
const selected = items.find((it) => it.inv.id === selectedId) ?? null;
  const selectedCur = selected?.template?.slot ? equippedMap.get(selected.template.slot) : null;
  const isConsumable = selected?.template?.type === "consumable";
  const levelOk = selected ? (char?.level ?? 1) >= (selected.template?.minLevel ?? 1) : false;
  const classOk = selected
    ? !selected.template?.classReq || selected.template.classReq === char?.classType
    : false;
  const canEquip = Boolean(levelOk && classOk);
  const selectedQty = selected ? selected.quantity ?? 1 : 0;
  const safeAmount = selected ? Math.max(1, Math.min(amount, selectedQty)) : 1;

  // Stats do item selecionado vs. o equipado no mesmo slot (deltas coloridos)
  const statDeltas = useMemo(() => {
    if (!selected) return [];
    const cur = selectedCur?.template || {};
    return STATS.map((s) => ({
      key: s.key,
      label: t(s.labelKey, locale),
      value: selected.template?.[s.key] || 0,
      current: cur[s.key] || 0,
    }));
  }, [selected, selectedCur, locale]);

  // Poder (powerCalc) do item selecionado vs. o equipado no mesmo slot
  const powerInfo = useMemo(() => {
    if (!selected || isConsumable) return null;
    const lvl = Number(char?.level) || 1;
    const calc = (tpl: any) =>
      powerCalc({
        attack: Number(tpl?.attack) || 0,
        defense: Number(tpl?.defense) || 0,
        hp: Number(tpl?.hp) || 0,
        speed: Number(tpl?.speed) || 0,
        critical: Number(tpl?.critical) || 0,
        level: lvl,
      });
    const cur = selectedCur?.template;
    const itemPower = calc(selected.template);
    const curPower = cur ? calc(cur) : 0;
    return { itemPower, curPower, delta: itemPower - curPower };
  }, [selected, selectedCur, isConsumable, char?.level]);

  // Porta-voz dos handlers; marca o slot como "piscando" ao equipar/desequipar
  const triggerEquipFx = (slot: string | undefined) => {
    setEquipFx((p) => ({ tick: p.tick + 1, slot: slot ?? null }));
    const timer = setTimeout(() => setEquipFx((p) => ({ ...p, slot: null })), 1000);
    timers.current.push(timer);
  };

  const run = async (url: string, extra: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, characterId }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { ...data, failed: true };
  };

  const handleEquip = async (it: any, unequip: boolean) => {
    const id = it.inv.id;
    setBusy(id);
    try {
      const res: any = await run("/api/inventory/equip", { inventoryItemId: id, unequip });
      if (res.failed) {
        notify(res.error ?? t("general.error", locale), "error");
        return;
      }
      notify(unequip ? t("inv.unequipSuccess", locale) : t("inv.equipSuccess", locale), "success");
      triggerEquipFx(it.template?.slot);
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      await loadAll();
      setBusy(null);
    }
  };

  const handleUse = async (it: any) => {
    const id = it.inv.id;
    setBusy(id);
    try {
      const res: any = await run("/api/inventory/use", { inventoryItemId: id });
      if (res.failed) {
        notify(res.error ?? t("general.error", locale), "error");
        return;
      }
      notify(
        res.leveledUp
          ? `${t("inv.useSuccess", locale)} 🎉 ${t("stat.level", locale)} ${res.leveledUp}!`
          : t("inv.useSuccess", locale),
        "success"
      );
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      await loadAll();
      setBusy(null);
    }
  };

  const doSell = async (id: string, qty: number) => {
    setBusy(id);
    try {
      const res: any = await run("/api/inventory/sell", { inventoryItemId: id, quantity: qty });
      if (res.failed) {
        notify(res.error ?? t("general.error", locale), "error");
        return;
      }
      notify(`${t("inv.sold", locale)} ${fmt(res.goldEarned ?? 0)} 🪙`, "success");
      setSelectedId((s) => (s === id ? null : s));
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      await loadAll();
      setBusy(null);
    }
  };

  const doRemove = async (id: string, qty: number) => {
    setBusy(id);
    try {
      const res: any = await run("/api/inventory/remove", { inventoryItemId: id, quantity: qty });
      if (res.failed) {
        notify(res.error ?? t("general.error", locale), "error");
        return;
      }
      notify(t("inv.removed", locale), "success");
      setSelectedId((s) => (s === id ? null : s));
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      await loadAll();
      setBusy(null);
    }
  };

  // Vender/remover: 1º clique arma a confirmação, 2º clique executa
  const confirmMaybe = (kind: "sell" | "remove" | "sellAll", id: string, qty: number) => {
    if (kind === "sell") {
      if (sellPending === id) {
        setSellPending(null);
        doSell(id, qty);
      } else {
        setSellPending(id);
        setRemovePending(null);
        setSellAllPending(null);
        scheduleReset(id);
      }
    } else if (kind === "remove") {
      if (removePending === id) {
        setRemovePending(null);
        doRemove(id, qty);
      } else {
        setRemovePending(id);
        setSellPending(null);
        setSellAllPending(null);
        scheduleReset(id);
      }
    } else {
      if (sellAllPending === id) {
        setSellAllPending(null);
        doSell(id, selectedQty);
      } else {
        setSellAllPending(id);
        setSellPending(null);
        setRemovePending(null);
        scheduleReset(id);
      }
    }
  };

  // Limpa o filtro de slot ao trocar de categoria
  const changeCategory = (c: string) => {
    setCategory(c);
    setSlotFilter(null);
  };
const categories = [
    { key: "all", label: t("inv.category.all", locale) },
    { key: "visual", label: t("inv.category.visual", locale) },
    { key: "weapons", label: t("inv.category.weapons", locale) },
    { key: "armor", label: t("inv.category.armor", locale) },
    { key: "accessories", label: t("inv.category.accessories", locale) },
    { key: "consumables", label: t("inv.category.consumables", locale) },
    { key: "skins", label: t("inv.category.skins", locale) },
  ];

  if (loading && items.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <span className="animate-bounce text-3xl">🎒</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* ---------- cabeçalho ---------- */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎒</span>
          <div>
            <h1 className="text-xl font-black">{t("inv.title", locale)}</h1>
            <p className="text-[11px] text-gray-500">
              {t("inv.value", locale)} {fmt(totalValue)} 🪙
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <WalletPill img="/images/icons/icone_moeda.png" alt="Gold" value={fmt(char?.gold)} />
          <WalletPill img="/images/icons/icone_diamante.png" alt="Diamonds" value={fmt(char?.diamonds)} tint="text-cyan-300" />
        </div>

        {/* barra de capacidade */}
        <div className="w-full">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-500">
            <span>{fmt(totalSlots)} / {capacity} {t("inv.slots", locale)}</span>
            <span className="text-[#e94560]">{Math.max(0, capacity - totalSlots)} {t("inv.free", locale)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/30">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                totalSlots / capacity > 0.85
                  ? "from-red-600 to-[#e94560]"
                  : "from-[#7c5cfc] to-[#e94560]"
              }`}
              style={{ width: `${Math.min(100, (totalSlots / capacity) * 100)}%` }}
            />
          </div>
        </div>
      </header>

      {category === "skins" ? (
        <>
          <SkinsTab />
          <BoostSection />
        </>
      ) : category === "visual" ? (
        <>
          <VisualTab />
          <BoostSection />
        </>
      ) : (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[270px_1fr] xl:grid-cols-[280px_1fr_300px]">
        {/* ---------- esquerda: personagem + equipamento ---------- */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2436] to-[#0f141f] p-2">
            <div className="pointer-events-none absolute top-2 right-3 text-[9px] uppercase tracking-widest text-gray-600">
              {t("inv.slotsTitle", locale)}
            </div>
            {/* Personagem em área própria (não fica por cima dos slots) */}
            <div className="grid place-items-center pb-1 pt-3">
              <img
                src={charImg}
                alt={String(char?.classType ?? "warrior")}
                className={`h-20 w-auto max-w-full object-contain animate-float drop-shadow-[0_0_14px_rgba(233,69,96,0.35)] ${
                  equipFx.tick > 0 ? "char-equip-glow" : ""
                }`}
                draggable={false}
              />
            </div>
            <div className="grid grid-cols-3 grid-rows-4 place-items-center pt-2">
              {EQUIP_SLOTS.map(({ slot, cell }) => {
                const entry = equippedMap.get(slot);
                const fxOn = equipFx.slot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      if (entry) selectItem(entry.inv.id);
                      else {
                        const first = items.find((it) => it.template?.slot === slot);
                        if (first) selectItem(first.inv.id);
                      }
                    }}
                    className={`relative z-10 flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition-all ${cell} ${
                      fxOn ? "animate-pulse-soft border-[#e94560] bg-[#e94560]/20" : "border-white/10 bg-black/20 hover:bg-white/10"
                    } ${selected?.template?.slot === slot ? "ring-2 ring-[#e94560]/60" : ""}`}
                  >
                    {entry ? (
                      <ItemIcon template={entry.template} emojiClass="text-2xl" alt="" />
                    ) : (
                      <span className="text-xl opacity-40">{SLOT_ICON[slot]}</span>
                    )}
                    <span className="text-[8px] uppercase tracking-wider text-gray-500">{t(`slot.${slot}`, locale)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[11px]">
              <span className="rounded-full bg-[#e94560]/20 px-2 py-0.5 font-bold text-[#e94560]">
                Lv {char?.level ?? 1}
              </span>
              <span className="text-gray-400">{char?.power ?? 0} ⚡</span>
            </div>
          </div>

          {/* chips do que está equipado (clique foca o item no inventário) */}
          <div className="flex flex-wrap gap-1.5">
            {EQUIP_SLOTS.map(({ slot }) => {
              const entry = equippedMap.get(slot);
              if (!entry) return null;
              return (
                <button
                  key={slot}
                  onClick={() => selectItem(entry.inv.id)}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-bg-card px-2 py-0.5 text-[10px] text-gray-300 transition-all hover:border-[#e94560] hover:text-white"
                >
                  <span>{SLOT_ICON[slot]}</span>
                  <span className="max-w-[90px] truncate">{t(entry.template.nameKey ?? "", locale)}</span>
                </button>
              );
            })}
          </div>
        </section>
{/* ---------- centro: filtros + grade ---------- */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4">
          {/* busca + ordenação */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("inv.search", locale)}
              className="w-full flex-1 rounded-xl border border-white/10 bg-[#0f141f]/80 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-[#e94560] focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0f141f]/80 px-2 py-2 text-sm text-gray-200 focus:outline-none"
            >
              <option value="newest">{t("inv.sort.newest", locale)}</option>
              <option value="rarity">{t("inv.sort.rarity", locale)}</option>
              <option value="level">{t("inv.sort.level", locale)}</option>
              <option value="value">{t("inv.sort.value", locale)}</option>
              <option value="name">{t("inv.sort.name", locale)}</option>
            </select>
          </div>

          {/* categorias */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const count =
                c.key === "skins" || c.key === "visual"
                  ? undefined
                  : c.key === "consumables"
                    ? items.filter((it) => it.template?.type === "consumable").length
                    : c.key === "all"
                      ? items.length
                      : items.filter((it) => (CATEGORY_GROUPS[c.key] ?? []).includes(it.template?.slot)).length;
              return (
                <button key={c.key} onClick={() => changeCategory(c.key)} className={chipCls(category === c.key)}>
                  <span className="mr-1">{CATEGORY_ICONS[c.key] ?? "❔"}</span>
                  {c.label}
                  {count !== undefined && (
                    <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${category === c.key ? "bg-white/20" : "bg-white/10"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* filtros de slot e raridade */}
          {(availableSlots.length > 0 || availableRarities.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {availableSlots.map((s) => (
                <button
                  key={s}
                  onClick={() => setSlotFilter(slotFilter === s ? null : s)}
                  className={chipCls(slotFilter === s)}
                >
                  {SLOT_ICON[s] ?? "❔"} {t(`slot.${s}`, locale)}
                </button>
              ))}
              {availableRarities.map((r) => (
                <button
                  key={r}
                  onClick={() => setRarityFilter(rarityFilter === r ? null : r)}
                  className={chipCls(rarityFilter === r)}
                >
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ background: RARITY_COLORS[r] ?? "#fff" }}
                  />
                  {rarityLabel(r, locale)}
                </button>
              ))}
              {(slotFilter || rarityFilter) && (
                <button
                  onClick={() => {
                    setSlotFilter(null);
                    setRarityFilter(null);
                  }}
                  className="text-[11px] text-[#e94560] hover:underline"
                >
                  ✕ {t("inv.clearFilters", locale)}
                </button>
              )}
            </div>
          )}

          {/* contador */}
          <div className="text-[11px] text-gray-500">
            {fmt(visible.length)} {t("inv.items", locale)}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 py-10 text-gray-500">
              <span className="text-4xl opacity-50">📦</span>
              <p className="text-sm">{t("inv.empty", locale)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {visible.map((it) => {
                const tpl = it.template || {};
                const id = it.inv.id;
                const active = selectedId === id;
                const rarityHex = RARITY_COLORS[tpl.rarity];
                const sub =
                  tpl.type === "consumable" ? t("inv.consumable", locale) : t(`slot.${tpl.slot}`, locale);
                return (
                  <button
                    key={id}
                    onClick={() => selectItem(id)}
                    className={`group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border bg-bg-card px-2 pt-2 pb-1.5 transition-all hover:-translate-y-0.5 hover:bg-bg-surface hover:shadow-lg ${
                      active ? "border-[#e94560] ring-2 ring-[#e94560]/40" : ""
                    }`}
                    style={
                      !active && rarityHex
                        ? { borderColor: `${rarityHex}66`, boxShadow: `0 0 12px ${rarityHex}22 inset` }
                        : undefined
                    }
                  >
                    <div className="relative grid w-full place-items-center">
                      <ItemIcon template={tpl} className="h-12 w-12 object-contain" emojiClass="text-3xl" alt="" />
                      {it.inv?.equipped && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-[#e94560] px-1.5 text-[9px] font-black text-white">
                          ✓
                        </span>
                      )}
                      {(it.quantity ?? 1) > 1 && (
                        <span className="absolute right-0.5 bottom-0 rounded bg-black/70 px-1 text-[10px] font-bold text-yellow-300">
                          ×{it.quantity}
                        </span>
                      )}
                    </div>
                    <div className="w-full text-center">
                      <div className="truncate text-[11px] leading-tight font-semibold text-gray-200">
                        {t(tpl.nameKey || "", locale)}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[9px] font-bold"
                        style={{ color: rarityHex ?? "#6b7280" }}
                      >
                        {rarityLabel(tpl.rarity, locale)} • {sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
{/* ---------- direita: detalhes do item ---------- */}
        <section className="rounded-2xl border border-white/10 bg-bg-surface p-3 sm:p-4 lg:sticky lg:top-4">
          {selected ? (
            <div className="flex flex-col gap-3">
              {/* cabeçalho do item */}
              <div className="flex items-start gap-3">
                <div
                  className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl border bg-bg-card"
                  style={{ borderColor: RARITY_COLORS[selected.template?.rarity] ?? "#ffffff33" }}
                >
                  <ItemIcon template={selected.template} className="h-12 w-12 object-contain" emojiClass="text-4xl" alt="" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-gray-100">
                    {t(selected.template.nameKey || "", locale)}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span
                      className="rounded-full px-2 py-0.5 font-bold text-white"
                      style={{ background: RARITY_COLORS[selected.template?.rarity] ?? "#3b4252" }}
                    >
                      {rarityLabel(selected.template?.rarity, locale)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-bg-card px-2 py-0.5 text-gray-300">
                      {selected.template.type === "consumable"
                        ? t("inv.consumable", locale)
                        : `${SLOT_ICON[selected.template.slot] ?? "❔"} ${t(`slot.${selected.template.slot}`, locale)}`}
                    </span>
                    {selected.inv?.equipped && (
                      <span className="rounded-full bg-[#e94560]/20 px-2 py-0.5 font-bold text-[#e94560]">
                        {t("inv.equipped", locale)}
                      </span>
                    )}
                    {(selected.quantity ?? 1) > 1 && (
                      <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 font-bold text-yellow-300">
                        ×{(selected.quantity ?? 1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* requisitos */}
              {!isConsumable && (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      levelOk ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {t("inv.levelReq", locale)} {selected.template?.minLevel ?? 1}
                  </span>
                  {selected.template?.classReq && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        classOk ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {selected.template.classReq}
                    </span>
                  )}
                </div>
              )}

              {/* stats de equipamento + delta vs. o atual */}
              {!isConsumable && (
                <div className="flex flex-col gap-1.5">
                  {powerInfo && (
                    <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-sm">
                      <span className="flex items-center gap-1.5 font-bold text-yellow-300">
                        ⚡ {t("inv.power", locale)}
                      </span>
                      <span className="flex items-center gap-2">
                        {powerInfo.curPower > 0 && (
                          <span className="text-[10px] text-gray-400">{powerInfo.curPower}</span>
                        )}
                        <span
                          className={`font-black ${
                            powerInfo.delta > 0
                              ? "text-green-400"
                              : powerInfo.delta < 0
                                ? "text-red-400"
                                : "text-gray-200"
                          }`}
                        >
                          {powerInfo.itemPower}
                          {powerInfo.delta > 0 && <span className="ml-1">▲ +{powerInfo.delta}</span>}
                          {powerInfo.delta < 0 && <span className="ml-1">▼ {powerInfo.delta}</span>}
                        </span>
                      </span>
                    </div>
                  )}
                  {statDeltas.map((d) => {
                    const delta = d.value - d.current;
                    return (
                      <div
                        key={d.key}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                      >
                        <span className="text-gray-400">{d.label}</span>
                        <span className="flex items-center gap-2">
                          {d.current > 0 && (
                            <span className="text-[10px] text-gray-500">{d.current}</span>
                          )}
                          <span
                            className={`font-bold ${
                              delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-gray-200"
                            }`}
                          >
                            {d.value > 0 ? `+${d.value}` : "—"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* efeito de consumível */}
              {isConsumable && (
                <div className="flex flex-col gap-1.5">
                  {EFFECT_ORDER.map((k) => {
                    const v = selected.template?.effect?.[k];
                    if (!v) return null;
                    return (
                      <div
                        key={k}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
                      >
                        <span>{k === "hp" ? "❤️" : k === "mana" ? "💧" : k === "energy" ? "⚡" : k === "boostXpHours" ? "🚀" : k === "boostEnergyHours" ? "🔋" : "⭐"}</span>
                        {effectLabel(k, v, locale)}
                      </div>
                    );
                  })}
                  {selected.template?.legend && (
                    <p className="text-[10px] italic text-gray-500">{selected.template.legend}</p>
                  )}
                </div>
              )}
{/* descrição */}
              {selected.template?.descKey && (
                <p className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
                  {t(selected.template.descKey, locale)}
                </p>
              )}

              {/* quantidade selecionada (empilháveis) */}
              {selected.stackable && selectedQty > 1 && (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                  <span className="text-[11px] text-gray-400">{t("inv.amount", locale)}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAmount(Math.max(1, safeAmount - 1))}
                      className="h-6 w-6 rounded-md bg-white/10 text-sm font-bold text-gray-200 hover:bg-white/20"
                    >
                      −
                    </button>
                    <span className="w-12 text-center text-xs font-bold text-yellow-300">{safeAmount}</span>
                    <button
                      onClick={() => setAmount(Math.min(selectedQty, safeAmount + 1))}
                      className="h-6 w-6 rounded-md bg-white/10 text-sm font-bold text-gray-200 hover:bg-white/20"
                    >
                      +
                    </button>
                    <span className="text-[10px] text-gray-500">/ {selectedQty}</span>
                  </div>
                </div>
              )}

              {/* ações */}
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                {isConsumable ? (
                  <button
                    onClick={() => handleUse(selected)}
                    disabled={busy === selected.inv.id}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#e94560] to-[#ff7b81] px-3 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(233,69,96,0.35)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {busy === selected.inv.id ? "…" : `⚡ ${t("inv.use", locale)}`}
                  </button>
                ) : selected.inv?.equipped ? (
                  <button
                    onClick={() => handleEquip(selected, true)}
                    disabled={busy === selected.inv.id}
                    className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-gray-200 transition-all hover:bg-white/20 disabled:opacity-40"
                  >
                    {busy === selected.inv.id ? "…" : t("inv.unequip", locale)}
                  </button>
                ) : (
                  <button
                    onClick={() => handleEquip(selected, false)}
                    disabled={busy === selected.inv.id || !canEquip}
                    title={
                      !canEquip
                        ? (selected.template?.minLevel ?? 1) > (char?.level ?? 1)
                          ? t("inv.levelTooLow", locale)
                          : t("inv.classRestriction", locale)
                        : undefined
                    }
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#e94560] to-[#ff7b81] px-3 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(233,69,96,0.35)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {busy === selected.inv.id ? "…" : !canEquip ? `${t("inv.equip", locale)} ⚠` : t("inv.equip", locale)}
                  </button>
                )}
                <button
                  onClick={() => confirmMaybe("sell", selected.inv.id, safeAmount)}
                  disabled={busy === selected.inv.id || !!selected.inv?.equipped}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-all disabled:opacity-40 ${
                    sellPending === selected.inv.id
                      ? "animate-pulse-soft border-yellow-500/60 bg-yellow-500/20 text-yellow-300"
                      : "border-white/15 bg-white/10 text-gray-200 hover:bg-white/20"
                  }`}
                >
                  {sellPending === selected.inv.id ? `${t("inv.confirmSell", locale)}!` : t("inv.sell", locale)}
                </button>

                {selected.stackable && selectedQty > 1 && (
                  <button
                    onClick={() => confirmMaybe("sellAll", selected.inv.id, selectedQty)}
                    disabled={busy === selected.inv.id || !!selected.inv?.equipped}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-all disabled:opacity-40 ${
                      sellAllPending === selected.inv.id
                        ? "animate-pulse-soft border-yellow-500/60 bg-yellow-500/20 text-yellow-300"
                        : "border-white/15 bg-white/10 text-gray-200 hover:bg-white/20"
                    }`}
                  >
                    {sellAllPending === selected.inv.id
                      ? `${t("inv.confirmSell", locale)}!`
                      : `${t("inv.sell", locale)} ×${selectedQty}`}
                  </button>
                )}

                <button
                  onClick={() => confirmMaybe("remove", selected.inv.id, safeAmount)}
                  disabled={busy === selected.inv.id || !!selected.inv?.equipped}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-all disabled:opacity-40 ${
                    removePending === selected.inv.id
                      ? "animate-pulse-soft border-red-500/70 bg-red-500/20 text-red-200"
                      : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  }`}
                >
                  {removePending === selected.inv.id ? `${t("inv.confirmRemove", locale)}!` : t("inv.remove", locale)}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-500">
              <span className="text-4xl opacity-50">🔍</span>
              <p className="text-sm">{t("inv.hint", locale)}</p>
            </div>
          )}
        </section>
        </div>
      )}
    </div>
  );
}