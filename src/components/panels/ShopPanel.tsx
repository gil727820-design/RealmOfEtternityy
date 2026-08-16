"use client";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { RARITY_COLORS } from "@/game/constants";
import { RARITY_ORDER } from "@/game/drops";
import { EGG_RARITY_WEIGHTS } from "@/game/pets";
import { VIP_TIERS, currentVipTier, vipRemainingMs } from "@/game/vip";
import { t } from "@/i18n";
import { pityStatus } from "@/game/pity";

const CHESTS = [
  { id: "common", name: "shop.chestBasic", cost: 1500, type: "gold", image: "/images/chests/bau_comum_transparente.png", desc: "shop.chestBasic.desc", topRarity: "uncommon" },
  { id: "uncommon", name: "shop.chestUncommon", cost: 3500, type: "gold", image: "/images/chests/bau_incomum_transparente.png", desc: "shop.chestUncommon.desc", topRarity: "rare" },
  { id: "rare", name: "shop.chestRare", cost: 7000, type: "gold", image: "/images/chests/bau_raro_transparente.png", desc: "shop.chestRare.desc", topRarity: "epic" },
  { id: "epic", name: "shop.chestEpic", cost: 150, type: "diamond", image: "/images/chests/bau_epico_transparente.png", desc: "shop.chestEpic.desc", topRarity: "epic" },
  { id: "legendary", name: "shop.chestLegendary", cost: 450, type: "diamond", image: "/images/chests/bau_lendario_transparente.png", desc: "shop.chestLegendary.desc", topRarity: "legendary" },
  { id: "mythic", name: "shop.chestMythic", cost: 900, type: "diamond", image: "/images/chests/bau_mitico_transparente.png", desc: "shop.chestMythic.desc", topRarity: "mythic" },
  { id: "divine", name: "shop.chestDivine", cost: 1800, type: "diamond", image: "/images/chests/bau_divino_transparente.png", desc: "shop.chestDivine.desc", topRarity: "divine" },
  { id: "secret", name: "shop.chestSecret", cost: 4000, type: "diamond", image: "/images/chests/bau_secreto_transparente.png", desc: "shop.chestSecret.desc", topRarity: "supreme" },
];

/** Chance de cada raridade em um baú (mesma conta do servidor: peso 0.5^(distância do topo)). */
function chestOdds(chest: { topRarity: string }) {
  const topIdx = RARITY_ORDER.indexOf(chest.topRarity);
  const rows: Array<{ rarity: string; weight: number; chance: number }> = [];
  let total = 0;
  for (let idx = 0; idx <= Math.max(0, topIdx); idx++) {
    const w = Math.pow(0.5, Math.max(0, topIdx) - idx);
    rows.push({ rarity: RARITY_ORDER[idx], weight: w, chance: 0 });
    total += w;
  }
  return rows.map((r) => ({ ...r, chance: Math.round((r.weight / total) * 1000) / 10 }));
}

/** Chance de cada raridade em um ovo (mesma conta do servidor: EGG_RARITY_WEIGHTS). */
function eggOdds(quality: "basic" | "rare" | "epic") {
  const top: Record<string, string> = { basic: "rare", rare: "legendary", epic: "divine" };
  const topRarity = top[quality] ?? "rare";
  const maxIdx = RARITY_ORDER.indexOf(topRarity);
  const rows: Array<{ rarity: string; weight: number; chance: number }> = [];
  let total = 0;
  for (let idx = 0; idx <= maxIdx; idx++) {
    const rar = RARITY_ORDER[idx];
    const w = EGG_RARITY_WEIGHTS[rar as keyof typeof EGG_RARITY_WEIGHTS] ?? 0;
    if (w <= 0) continue;
    rows.push({ rarity: rar, weight: w, chance: 0 });
    total += w;
  }
  return rows.map((r) => ({ ...r, chance: Math.round((r.weight / total) * 1000) / 10 }));
}

/** Pacotes de diamantes vendidos por PIX (valores em reais). */
const PIX_PACKS = [5, 10, 20, 50, 100];

/** Ovos de pet vendidos na loja (id bate com o /api/shop/buy). */
const PET_EGGS = [
  { id: "pet_egg", name: "shop.petEggBasic", cost: 25000, type: "gold", icon: "🥚", desc: "shop.petEggBasic.desc", eggKey: "egg_basic" },
  { id: "pet_egg_rare", name: "shop.petEggRare", cost: 200, type: "diamond", icon: "🔮", desc: "shop.petEggRare.desc", eggKey: "egg_rare" },
  { id: "pet_egg_epic", name: "shop.petEggEpic", cost: 600, type: "diamond", icon: "✨", desc: "shop.petEggEpic.desc", eggKey: "egg_epic" },
];

const MAX_PROOF_BASE64 = 6 * 1024 * 1024; // 6MB de base64 (~4.5MB de imagem) — limite do servidor

/**
 * Lê o comprovante no navegador e devolve um Data URL JPEG redimensionado.
 * Guardar como base64 (e não em arquivo em public/) funciona em qualquer
 * hospedagem — inclusive serverless, onde o disco é somente leitura.
 */
function proofToDataUrl(file: File, maxSide = 1200, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const raw = String(reader.result || "");
      if (!raw.startsWith("data:image/")) { reject(new Error("not-image")); return; }
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || 1) * scale));
          const h = Math.max(1, Math.round((img.height || 1) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(raw); return; }
          // Fundo branco (comprovantes PIX costumam ter fundo claro).
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", quality);
          resolve(out && out.startsWith("data:image/") ? out : raw);
        } catch {
          reject(new Error("draw-failed"));
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

// Loja reaberta: baús, poções, VIP e diamantes (PIX) disponíveis novamente.
const SHOP_MAINTENANCE_TABS: string[] = [];

function formatVipRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

export default function ShopPanel() {
  const { character, locale, notify, setCharacter } = useGameStore();
  const [tab, setTab] = useState("vip");
  const [buying, setBuying] = useState<string | null>(null);
  const [chestReveal, setChestReveal] = useState<{ name: string; image: string; items: any[] } | null>(null);
  const [phase, setPhase] = useState<"opening" | "reveal">("opening");
  // Informações do baú (conteúdo + chances + pity)
  const [infoChestId, setInfoChestId] = useState<string | null>(null);
  // Revelação do ovo de pet (animação) + informações do ovo
  const [eggReveal, setEggReveal] = useState<{ egg: (typeof PET_EGGS)[number]; pet: any } | null>(null);
  const [infoEggId, setInfoEggId] = useState<string | null>(null);

  // Config PIX (diamantes): chave, QR e conversão por real vindos do admin.
  const [pixSettings, setPixSettings] = useState<{ pixKey: string; qr: string; diamondsPerReal: number }>({ pixKey: "", qr: "", diamondsPerReal: 1000 });
  const [pixPack, setPixPack] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/server/settings")
      .then((r) => r.json())
      .then((d) => {
        setPixSettings({
          pixKey: typeof d.donatePixKey === "string" ? d.donatePixKey : "",
          qr: typeof d.donateQrCode === "string" ? d.donateQrCode : "",
          diamondsPerReal: Number(d.diamondsPerReal) > 0 ? Number(d.diamondsPerReal) : 1000,
        });
      })
      .catch(() => { /* mantém defaults */ });
  }, []);

  // Fecha a "abertura" do baú: toca a animação de vibração/brilho e só depois revela os itens.
  useEffect(() => {
    if (!chestReveal) return;
    const timer = setTimeout(() => setPhase("reveal"), 1400);
    return () => clearTimeout(timer);
  }, [chestReveal]);

  // Mesma lógica para o ovo: animação de choque e depois revela o pet.
  useEffect(() => {
    if (!eggReveal) return;
    setPhase("opening");
    const timer = setTimeout(() => setPhase("reveal"), 1500);
    return () => clearTimeout(timer);
  }, [eggReveal]);

  if (!character) return null;

  const currentVip = currentVipTier(character as any);
  const vipMs = vipRemainingMs(character as any);

  const buyItem = async (itemId: string, itemName: string, costType: string, costValue: number) => {
    if (buying) return;

    // Validação de saldo
    const balance = costType === "diamond" ? Number(character.diamonds ?? 0) : Number(character.gold ?? 0);
    if (balance < costValue) {
      notify(`${t("shop.insufficientFunds", locale)} (${costType === "diamond" ? "💎" : "💰"} ${costValue})`, "error");
      return;
    }

    setBuying(itemId);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, itemId, costType, costValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || t("general.error", locale), "error");
        return;
      }
      if (data.character) setCharacter(data.character);
      // Baú: abre o modal com a animação de revelação dos itens sorteados.
      if (data.type === "chest" && Array.isArray(data.items) && data.items.length > 0) {
        setPhase("opening");
        setChestReveal({ name: t(itemName, locale), image: CHESTS.find((c) => c.id === itemId)?.image || "", items: data.items });
        return;
      }
      if (data.type === "vip") {
        notify(`👑 ${t(itemName, locale)} ${t("pix.activated", locale)}! (30 ${t("general.days", locale)})`, "success");
        return;
      }
      // Ovo de pet: abre a animação de choque e revela o pet (ou duplicata → XP).
      if (data.type === "pet_egg" && data.pet) {
        const egg = PET_EGGS.find((e) => e.id === itemId);
        if (egg) {
          setEggReveal({ egg, pet: data.pet });
        } else {
          const pet = data.pet as { icon: string; nameKey: string; rarity: string; added: boolean };
          notify(
            pet.added
              ? `${pet.icon} ${t("pet.hatched", locale)}: ${t(pet.nameKey, locale)}!`
              : `${pet.icon} ${t(pet.nameKey, locale)} ${t("pet.duplicate", locale)} (+${250} ${t("pet.xp", locale)})`,
            pet.added ? "success" : "info"
          );
        }
        return;
      }
      notify(`${t("general.success", locale)} - ${t(itemName, locale)} ${t("shop.bought", locale)}!`, "success");
    } catch (e) {
      notify(t("general.error", locale), "error");
    } finally {
      setBuying(null);
    }
  };

  const submitPix = async () => {
    if (!pixPack || submitting) return;
    if (!proofFile) {
      notify(t("pix.proofRequired", locale), "error");
      return;
    }
    setSubmitting(true);
    try {
      // Converte o arquivo para Data URL no navegador (redimensionado) e envia
      // por JSON — funciona também em serverless, onde gravar em public/ falha.
      const screenshotData = await proofToDataUrl(proofFile);
      if (screenshotData.length > MAX_PROOF_BASE64) {
        notify(t("general.error", locale), "error");
        return;
      }
      const res = await fetch("/api/pix/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, valueBRL: pixPack, screenshotData }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || t("general.error", locale), "error");
        return;
      }
      notify(t("pix.submitted", locale), "success");
      setPixPack(null);
      setProofFile(null);
    } catch (e) {
      notify(t("general.error", locale), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: "chests", label: `📦 ${t("shop.chests", locale)}`, icon: "📦" },
    { id: "pets", label: `🐾 ${t("shop.pets", locale)}`, icon: "🐾" },
    { id: "diamonds", label: `💎 ${t("pix.title", locale)}`, icon: "💎" },
    { id: "vip", label: "👑 VIP", icon: "👑" },
  ];

  return (
    <div className="animate-fadeInUp">
      <div className="section-header">
        <img src="/images/sidebar/menu_loja.png" alt={t("shop.title", locale)} className="w-10 h-10 object-contain" />
        <h2 className="gradient-text text-3xl font-black">{t("shop.title", locale)}</h2>
      </div>

      <div className="flex bg-bg-surface p-2 rounded-2xl border border-white/5 mb-6 gap-2">
        {tabs.map((tItem) => (
          <button
            key={tItem.id}
            onClick={() => setTab(tItem.id)}
            className={`cursor-pointer px-6 py-3 rounded-xl transition-all font-bold ${tab === tItem.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-gray-400 hover:text-white"}`}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      {(SHOP_MAINTENANCE_TABS.includes(tab) && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 game-card p-6 text-center animate-fadeInDown">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.18),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-5xl animate-pulse-soft">🔧</span>
            <h3 className="text-2xl font-black text-amber-400">{t("shop.maintenance", locale)}</h3>
            <p className="text-sm text-gray-400 max-w-md">{t("shop.maintenanceMsg", locale)}</p>
          </div>
        </div>
      )) || (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tab === "chests" && (
          <>
            {CHESTS.map((chest) => (
              <ShopItem
                key={chest.id}
                name={t(chest.name, locale)}
                cost={chest.cost}
                image={chest.image}
                desc={t(chest.desc, locale)}
                type={chest.type}
                disabled={buying === chest.id}
                pity={pityStatus(character as any, chest.id)}
                onClick={() => buyItem(chest.id, chest.name, chest.type, chest.cost)}
                onInfo={() => setInfoChestId(chest.id)}
              />
            ))}
          </>
        )}
        {tab === "pets" && (
          <>
            <div className="game-card p-5 rounded-2xl border-white/10 col-span-full">
              <p className="text-sm text-gray-300">
                🐾 {t("shop.petsHint", locale)}
              </p>
              <p className="text-xs text-[#ffd700] mt-2">
                🎁 {t("shop.petsPityHint", locale)}
              </p>
            </div>
            {PET_EGGS.map((egg) => (
              <ShopItem
                key={egg.id}
                name={t(egg.name, locale)}
                cost={egg.cost}
                image=""
                icon={egg.icon}
                desc={t(egg.desc, locale)}
                type={egg.type}
                disabled={buying === egg.id}
                pity={pityStatus(character as any, egg.eggKey)}
                onClick={() => buyItem(egg.id, egg.name, egg.type, egg.cost)}
                onInfo={() => setInfoEggId(egg.id)}
              />
            ))}
          </>
        )}
        {tab === "diamonds" && (
          <>
            {currentVip ? (
              <div className="game-card p-5 rounded-2xl border-amber-400/40 col-span-full">
                <p className="text-sm text-gray-300">
                  👑 {t("vip.active", locale)}: <b className="text-amber-400">{t(currentVip.nameKey, locale)}</b> · {t("pix.remaining", locale)}: <b>{formatVipRemaining(vipMs)}</b>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 col-span-full">{t("vip.none", locale)}</p>
            )}
            {PIX_PACKS.map((value) => {
              const diamonds = value * pixSettings.diamondsPerReal;
              return (
                <div key={value} className="game-card p-6 flex flex-col items-center text-center gap-4 hover-lift">
                  <div className="text-6xl">💎</div>
                  <h3 className="text-2xl font-black text-purple-300">+{diamonds.toLocaleString()} 💎</h3>
                  <p className="text-sm text-gray-400 flex-1">{t("pix.value", locale)} R$ {value}</p>
                  <p className="text-xs text-gray-600">({pixSettings.diamondsPerReal.toLocaleString()} 💎 = R$ 1)</p>
                  <button onClick={() => setPixPack(value)} className="game-btn game-btn-purple w-full">
                    🛒 {t("pix.buy", locale)} R$ {value}
                  </button>
                </div>
              );
            })}
          </>
        )}
        {tab === "vip" && (
          <>
            {currentVip ? (
              <div className="game-card p-5 rounded-2xl border-amber-400/40 col-span-full flex items-center gap-4">
                <img src={currentVip.image} alt="" className="w-16 h-16 object-contain" />
                <div>
                  <p className="font-black text-lg text-amber-400">{t(currentVip.nameKey, locale)}</p>
                  <p className="text-xs text-gray-400">{t("vip.active", locale)} · {formatVipRemaining(vipMs)} {t("pix.remaining", locale).toLowerCase()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 col-span-full">{t("vip.none", locale)}</p>
            )}
            {currentVip && (
              <p className="text-xs text-amber-300/90 col-span-full">
                🔒 {t("vip.lockedHint", locale)} <b className="text-amber-400">{t(currentVip.nameKey, locale)}</b>
              </p>
            )}
            {VIP_TIERS.map((tier) => {
              const owned = currentVip?.id === tier.id;
              const lower = !!currentVip && VIP_TIERS.indexOf(currentVip) < VIP_TIERS.indexOf(tier);
              // Inferiores ao VIP atual ficam bloqueados (não pode comprar pior do que já tem).
              const inferior = !!currentVip && VIP_TIERS.indexOf(tier) < VIP_TIERS.indexOf(currentVip);
              return (
                <div key={tier.id} className={`game-card p-6 flex flex-col items-center text-center gap-4 ${inferior ? "opacity-45 saturate-50" : "hover-lift"}`}>
                  <img src={tier.image} alt={t(tier.nameKey, locale)} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
                  <h3 className="text-xl font-bold">{t(tier.nameKey, locale)}</h3>
                  <p className="text-sm text-gray-400 flex-1">{t(tier.descKey, locale)}</p>
                  <p className="text-xs text-purple-300">
                    ⚡ +{Math.round((tier.xpMult - 1) * 100)}% XP · 💰 +{Math.round((tier.goldMult - 1) * 100)}% {t("general.gold", locale)} · ⚡ x{tier.energyRate} {t("general.energy", locale)}
                  </p>
                  <button
                    onClick={() => buyItem(`vip_${tier.id}`, tier.nameKey, "diamond", tier.price)}
                    disabled={buying === `vip_${tier.id}` || inferior}
                    className={`game-btn w-full ${owned ? "game-btn-gold" : "game-btn-purple"} ${buying === `vip_${tier.id}` || inferior ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {inferior ? `🔒 ${t("vip.inferior", locale)}` : owned ? `✅ ${t("vip.owned", locale)}` : `💎 ${tier.price} · 30 ${t("general.days", locale)}${lower ? ` (${t("vip.upgrade", locale)})` : ""}`}
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
      )}

      {/* Modal de INFORMAÇÕES do baú: conteúdo, chances e pity */}
      {infoChestId && (() => {
        const chest = CHESTS.find((c) => c.id === infoChestId);
        if (!chest) return null;
        const odds = chestOdds(chest);
        const pity = pityStatus(character as any, chest.id);
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setInfoChestId(null)}>
            <div className="game-card relative w-full max-w-lg p-7 text-center overflow-hidden animate-scaleIn border-amber-400/40" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.12),transparent_70%)]" />
              <div className="relative">
                <img src={chest.image} alt={t(chest.name, locale)} className="w-24 h-24 mx-auto object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.4)]" />
                <h3 className="text-2xl font-black mt-2">{t(chest.name, locale)}</h3>
                <p className="text-sm text-gray-400 mt-1">{t(chest.desc, locale)}</p>

                {/* Pity */}
                <div className="mt-5 bg-black/40 rounded-xl border border-white/10 p-4 text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-[#ffd700] mb-2">🎁 Pity — Garantia</div>
                  {pity.limit > 0 ? (
                    <>
                      <p className="text-xs text-gray-300">
                        A cada <b className="text-white">{pity.limit} aberturas</b> sem sair a raridade top
                        (<b style={{ color: (RARITY_COLORS as Record<string, string>)[chest.topRarity] || "#ffd700" }}>{t(`rarity.${chest.topRarity}`, locale)}</b>),
                        o próximo item é <b className="text-[#ff6b35]">GARANTIDO</b> como topo. Saíndo o topo antes, o contador zera.
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Seu progresso</span>
                          <span className={pity.guaranteed ? "text-[#ff6b35] font-black" : ""}>{pity.guaranteed ? "⭐ GARANTIDO AGORA!" : `${pity.current}/${pity.limit}`}</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${pity.guaranteed ? "bg-[#ff6b35] animate-pulse-soft" : "bg-[#ffd700]"}`} style={{ width: `${pity.pct}%` }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Sem garantia neste baú.</p>
                  )}
                </div>

                {/* Chances por raridade */}
                <div className="mt-4 bg-black/40 rounded-xl border border-white/10 p-4 text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-300 mb-2">📊 Chance de cada raridade</div>
                  <div className="space-y-1.5">
                    {odds.map((o) => {
                      const color = (RARITY_COLORS as Record<string, string>)[o.rarity] || "#9ca3af";
                      const isTop = o.rarity === chest.topRarity;
                      return (
                        <div key={o.rarity} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold w-24 shrink-0" style={{ color }}>
                            {t(`rarity.${o.rarity}`, locale)}{isTop ? " 👑" : ""}
                          </span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${o.chance}%`, background: color }} />
                          </div>
                          <span className="text-[11px] font-black w-14 text-right text-white">{o.chance}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-3">
                    Os itens sorteados são equipamentos <b className="text-gray-300">do seu nível</b> (até +10 acima) — nunca poções.
                    A chance é ponderada: quanto mais perto do topo, mais raro.
                  </p>
                </div>

                <button onClick={() => setInfoChestId(null)} className="game-btn-gold game-btn w-full mt-5 py-3">
                  {t("general.close", locale)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de INFORMAÇÕES do ovo: chances + pity */}
      {infoEggId && (() => {
        const egg = PET_EGGS.find((e) => e.id === infoEggId);
        if (!egg) return null;
        const odds = eggOdds(egg.eggKey.replace("egg_", "") as "basic" | "rare" | "epic");
        const pity = pityStatus(character as any, egg.eggKey);
        const topRarity = odds[odds.length - 1]?.rarity ?? "rare";
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setInfoEggId(null)}>
            <div className="game-card relative w-full max-w-lg p-7 text-center overflow-hidden animate-scaleIn border-amber-400/40" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.12),transparent_70%)]" />
              <div className="relative">
                <div className="text-7xl">{egg.icon}</div>
                <h3 className="text-2xl font-black mt-2">{t(egg.name, locale)}</h3>
                <p className="text-sm text-gray-400 mt-1">{t(egg.desc, locale)}</p>

                {/* Pity */}
                <div className="mt-5 bg-black/40 rounded-xl border border-white/10 p-4 text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-[#ffd700] mb-2">🎁 Pity — Garantia</div>
                  <p className="text-xs text-gray-300">
                    A cada <b className="text-white">{pity.limit} aberturas</b> sem sair o pet topo
                    (<b style={{ color: (RARITY_COLORS as Record<string, string>)[topRarity] || "#ffd700" }}>{t(`rarity.${topRarity}`, locale)}</b>),
                    o próximo ovo é <b className="text-[#ff6b35]">GARANTIDO</b> como o melhor dele. Saindo o topo antes, o contador zera.
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Seu progresso</span>
                      <span className={pity.guaranteed ? "text-[#ff6b35] font-black" : ""}>{pity.guaranteed ? "⭐ GARANTIDO AGORA!" : `${pity.current}/${pity.limit}`}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${pity.guaranteed ? "bg-[#ff6b35] animate-pulse-soft" : "bg-[#ffd700]"}`} style={{ width: `${pity.pct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Chances por raridade */}
                <div className="mt-4 bg-black/40 rounded-xl border border-white/10 p-4 text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-300 mb-2">📊 Chance de cada raridade</div>
                  <div className="space-y-1.5">
                    {odds.map((o) => {
                      const color = (RARITY_COLORS as Record<string, string>)[o.rarity] || "#9ca3af";
                      const isTop = o.rarity === topRarity;
                      return (
                        <div key={o.rarity} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold w-24 shrink-0" style={{ color }}>
                            {t(`rarity.${o.rarity}`, locale)}{isTop ? " 👑" : ""}
                          </span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${o.chance}%`, background: color }} />
                          </div>
                          <span className="text-[11px] font-black w-14 text-right text-white">{o.chance}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-3">
                    O pet sorteado vai direto para sua coleção — repetido vira <b className="text-gray-300">+250 XP</b> para o pet ativo.
                  </p>
                </div>

                <button onClick={() => setInfoEggId(null)} className="game-btn-gold game-btn w-full mt-5 py-3">
                  {t("general.close", locale)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de abertura do OVO: ovo tremendo + brilho → pet revelado */}
      {eggReveal && (() => {
        const pet = eggReveal.pet as { icon: string; nameKey: string; rarity: string; added: boolean };
        const rarColor = (RARITY_COLORS as Record<string, string>)[pet.rarity] || "#9ca3af";
        const rarLabel = t(`rarity.${pet.rarity}`, locale);
        const pityTriggered = !!eggReveal.pet?.pityTriggered;
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setEggReveal(null)}>
            <div className="game-card relative w-full max-w-md p-8 text-center overflow-hidden animate-scaleIn border-amber-400/40" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.12),transparent_70%)]" />

              {phase === "opening" ? (
                <div className="relative flex flex-col items-center gap-7 py-8">
                  <div className="animate-heartbeat text-8xl">{eggReveal.egg.icon}</div>
                  <p className="text-amber-300 font-black text-lg animate-pulse-soft">🥚 {t("shop.opening", locale)}... chocando...</p>
                  <p className="text-gray-400 text-sm -mt-4">{t(eggReveal.egg.name, locale)}</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    {["✨", "⭐", "✨"].map((s, i) => (
                      <span key={i} className="text-3xl animate-bounceIn" style={{ animationDelay: `${i * 150}ms` }}>{s}</span>
                    ))}
                  </div>
                  <div className="text-8xl animate-bounceIn" style={{ filter: `drop-shadow(0 0 25px ${rarColor}88)` }}>{pet.icon}</div>
                  <h3 className="text-2xl font-black mt-3 animate-fadeInDown">{t(pet.nameKey, locale)}</h3>
                  <p className="text-xs font-black uppercase tracking-widest mt-1" style={{ color: rarColor }}>
                    {rarLabel}{pityTriggered ? " · ⭐ PITY GARANTIDO!" : ""}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {pet.added
                      ? `🎉 ${t("pet.hatched", locale)}! ${t("shop.eggAdded", locale)}`
                      : `🔄 ${t("pet.duplicate", locale)} (+250 ${t("pet.xp", locale)})`}
                  </p>
                  <button onClick={() => setEggReveal(null)} className="game-btn-gold game-btn w-full mt-6 py-3">
                    {t("general.close", locale)}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal de abertura de baú: baú fechado → tremida + brilho → itens revelados */}
      {chestReveal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setChestReveal(null)}>
          <div className="game-card relative w-full max-w-2xl p-8 text-center overflow-hidden animate-scaleIn border-amber-400/40" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.12),transparent_70%)]" />

            {phase === "opening" ? (
              <div className="relative flex flex-col items-center gap-7 py-8">
                <div className="animate-heartbeat">
                  <img src={chestReveal.image} alt={chestReveal.name} className="w-44 h-44 object-contain drop-shadow-[0_0_35px_rgba(255,215,0,0.5)]" />
                </div>
                <p className="text-amber-300 font-black text-lg animate-pulse-soft">🔓 {t("shop.opening", locale)}...</p>
                <p className="text-gray-400 text-sm -mt-4">{chestReveal.name}</p>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center justify-center gap-3 mb-2">
                  {["✨", "⭐", "✨"].map((s, i) => (
                    <span key={i} className="text-3xl animate-bounceIn" style={{ animationDelay: `${i * 150}ms` }}>{s}</span>
                  ))}
                </div>
                <h3 className="gradient-text text-2xl font-black animate-fadeInDown">{t("shop.obtained", locale)}!</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                  {chestReveal.items.map((it: any, i: number) => {
                    const rarity: string = it.rarity || "common";
                    const color = (RARITY_COLORS as Record<string, string>)[rarity] || "#9ca3af";
                    return (
                      <div
                        key={i}
                        className="game-card p-3 rounded-xl animate-bounceIn border"
                        style={{ animationDelay: `${i * 120}ms`, borderColor: color, boxShadow: `0 0 14px ${color}44` }}
                      >
                        <img src={it.image} alt={it.icon} className="w-16 h-16 mx-auto object-contain" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }} />
                        <p className="text-xs font-bold mt-1 leading-tight" style={{ color }}>{t(it.nameKey, locale)}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">{it.slot}</p>
                        <p className="text-[10px] text-gray-500">Lv {it.minLevel} · ATK +{(it.attack || 0)}</p>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setChestReveal(null)} className="game-btn-gold game-btn w-full mt-6 py-3">
                  {t("general.close", locale)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de compra de diamantes via PIX (QR + comprovante) */}
      {pixPack && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setPixPack(null)}>
          <div className="game-card relative w-full max-w-lg p-7 text-center overflow-hidden animate-scaleIn border-purple-400/40 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.15),transparent_70%)]" />
            <div className="relative">
              <h3 className="text-2xl font-black text-purple-300">💎 {(pixPack * pixSettings.diamondsPerReal).toLocaleString()} {t("pix.title", locale)}</h3>
              <p className="text-sm text-gray-400 mt-1">{t("pix.value", locale)} <b className="text-white">R$ {pixPack}</b> · {t("pix.rate", locale)}: {pixSettings.diamondsPerReal.toLocaleString()} 💎 = R$ 1</p>

              {pixSettings.qr ? (
                <div className="mt-5">
                  <p className="text-xs text-gray-400 mb-2">{t("pix.scan", locale)}</p>
                  <img src={pixSettings.qr} alt="QR Code PIX" className="w-48 h-48 mx-auto object-contain rounded-xl bg-white p-2" />
                </div>
              ) : pixSettings.pixKey ? (
                <p className="text-xs text-gray-400 mt-3">{t("pix.key", locale)}</p>
              ) : (
                <p className="text-xs text-amber-400 mt-3">{t("pix.notConfigured", locale)}</p>
              )}

              {pixSettings.pixKey && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 bg-bg-surface rounded-lg p-3 border border-white/10">
                    <span className="text-xs font-mono text-gray-300 break-all">{pixSettings.pixKey}</span>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(pixSettings.pixKey); notify(t("pix.copied", locale), "success"); }
                        catch { notify(pixSettings.pixKey, "info"); }
                      }}
                      className="shrink-0 game-btn-gold game-btn text-xs py-1.5 px-3"
                    >
                      📋 {t("pix.copy", locale)}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 text-left">
                <label className="block text-center cursor-pointer rounded-xl border border-dashed border-purple-400/40 hover:border-purple-400 transition p-3 text-xs text-purple-300 font-bold">
                  {proofFile ? `✅ ${proofFile.name}` : "📤 " + t("pix.upload", locale)}
                  <input type="file" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <button onClick={submitPix} disabled={submitting} className="game-btn-purple game-btn w-full mt-6 py-3">
                {submitting ? "⏳..." : `✅ ${t("pix.sendProof", locale)}`}
              </button>
              <button onClick={() => setPixPack(null)} className="text-xs text-gray-500 mt-3 hover:text-gray-300">
                {t("general.close", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ShopItem = ({ name, cost, icon, image, desc, type, onClick, disabled, pity, onInfo }: any) => (
  <div className="game-card p-6 flex flex-col items-center text-center gap-4 hover-lift">
    {onInfo && (
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        title="Ver conteúdo e chances do baú"
        className="self-end -mb-4 text-xs text-gray-400 hover:text-white border border-white/15 rounded-full w-6 h-6 flex items-center justify-center hover:bg-white/10"
      >
        ℹ️
      </button>
    )}
    {image ? (
      <img src={image} alt={name} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
    ) : (
      <div className="text-6xl">{icon}</div>
    )}
    <h3 className="text-xl font-bold">{name}</h3>
    <p className="text-sm text-gray-400 flex-1">{desc}</p>
    {/* Barra de Pity: garantia do item topo após N aberturas sem sucesso */}
    {pity && pity.limit > 0 && (
      <div className="w-full">
        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
          <span>🎁 {pity.guaranteed ? "⭐ GARANTIDO!" : `${pity.current}/${pity.limit}`}</span>
          <span>{pity.pct}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${pity.guaranteed ? "bg-[#ff6b35] animate-pulse-soft" : "bg-[#ffd700]"}`}
            style={{ width: `${pity.pct}%` }}
          />
        </div>
      </div>
    )}
    <button onClick={onClick} disabled={disabled} className={`game-btn ${type === 'diamond' ? 'game-btn-purple' : 'game-btn-gold'} w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {type === 'diamond' ? '💎' : '💰'} {cost}
    </button>
  </div>
);