"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

const CHESTS = [
  { id: "common", name: "shop.chestBasic", cost: 500, type: "gold", image: "/images/chests/bau_comum_transparente.png", desc: "shop.chestBasic.desc" },
  { id: "uncommon", name: "shop.chestUncommon", cost: 1000, type: "gold", image: "/images/chests/bau_incomum_transparente.png", desc: "shop.chestUncommon.desc" },
  { id: "rare", name: "shop.chestRare", cost: 2000, type: "gold", image: "/images/chests/bau_raro_transparente.png", desc: "shop.chestRare.desc" },
  { id: "epic", name: "shop.chestEpic", cost: 100, type: "diamond", image: "/images/chests/bau_epico_transparente.png", desc: "shop.chestEpic.desc" },
  { id: "legendary", name: "shop.chestLegendary", cost: 300, type: "diamond", image: "/images/chests/bau_lendario_transparente.png", desc: "shop.chestLegendary.desc" },
  { id: "mythic", name: "shop.chestMythic", cost: 600, type: "diamond", image: "/images/chests/bau_mitico_transparente.png", desc: "shop.chestMythic.desc" },
  { id: "divine", name: "shop.chestDivine", cost: 1200, type: "diamond", image: "/images/chests/bau_divino_transparente.png", desc: "shop.chestDivine.desc" },
  { id: "secret", name: "shop.chestSecret", cost: 2500, type: "diamond", image: "/images/chests/bau_secreto_transparente.png", desc: "shop.chestSecret.desc" },
];

const POTIONS = [
  { id: "vida", name: "shop.potionLife", cost: 100, type: "gold", image: "/images/potions/pocao_vida.png", desc: "shop.potionLife.desc" },
  { id: "mana", name: "shop.potionMana", cost: 100, type: "gold", image: "/images/potions/pocao_mana.png", desc: "shop.potionMana.desc" },
  { id: "energia", name: "shop.potionEnergy", cost: 150, type: "gold", image: "/images/potions/pocao_energia.png", desc: "shop.potionEnergy.desc" },
  { id: "forca", name: "shop.potionStrength", cost: 200, type: "gold", image: "/images/potions/pocao_forca.png", desc: "shop.potionStrength.desc" },
  { id: "velocidade", name: "shop.potionSpeed", cost: 200, type: "gold", image: "/images/potions/pocao_velocidade.png", desc: "shop.potionSpeed.desc" },
  { id: "vigor", name: "shop.potionVigor", cost: 250, type: "gold", image: "/images/potions/pocao_vigor.png", desc: "shop.potionVigor.desc" },
  { id: "experiencia", name: "shop.potionExperience", cost: 300, type: "diamond", image: "/images/potions/pocao_experiencia.png", desc: "shop.potionExperience.desc" },
  { id: "antidoto", name: "shop.potionAntidote", cost: 150, type: "gold", image: "/images/potions/pocao_antidoto.png", desc: "shop.potionAntidote.desc" },
];

// Toda a Loja Imperial está em manutenção (assim como a forja): baús, poções
// E a aba VIP ficam bloqueadas até reabrir.
const SHOP_MAINTENANCE_TABS: string[] = ["chests", "potions", "vip"];

export default function ShopPanel() {
  const { character, locale, notify, setCharacter } = useGameStore();
  const [tab, setTab] = useState("vip");
  const [buying, setBuying] = useState<string | null>(null);
  
  if (!character) return null;

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
      notify(`${t("general.success", locale)} - ${t(itemName, locale)} ${t("shop.bought", locale)}!`, "success");
    } catch (e) {
      notify(t("general.error", locale), "error");
    } finally {
      setBuying(null);
    }
  };

  const tabs = [
    { id: "chests", label: `📦 ${t("shop.chests", locale)}`, icon: "📦" },
    { id: "potions", label: `🧪 ${t("shop.potions", locale)}`, icon: "🧪" },
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
                onClick={() => buyItem(chest.id, chest.name, chest.type, chest.cost)} 
              />
            ))}
          </>
        )}
        {tab === "potions" && (
          <>
            {POTIONS.map((potion) => (
              <ShopItem 
                key={potion.id}
                name={t(potion.name, locale)} 
                cost={potion.cost} 
                image={potion.image}
                desc={t(potion.desc, locale)} 
                type={potion.type} 
                disabled={buying === potion.id}
                onClick={() => buyItem(potion.id, potion.name, potion.type, potion.cost)} 
              />
            ))}
          </>
        )}
        {tab === "vip" && (
          <ShopItem name={t("shop.vip1", locale)} cost={500} icon="👑" desc={t("shop.vip1.desc", locale)} type="diamond" disabled={buying === "vip1"} onClick={() => buyItem("vip1", "shop.vip1", "diamond", 500)} />
        )}
      </div>
      )}
    </div>
  );
}

const ShopItem = ({ name, cost, icon, image, desc, type, onClick, disabled }: any) => (
  <div className="game-card p-6 flex flex-col items-center text-center gap-4 hover-lift">
    {image ? (
      <img src={image} alt={name} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
    ) : (
      <div className="text-6xl">{icon}</div>
    )}
    <h3 className="text-xl font-bold">{name}</h3>
    <p className="text-sm text-gray-400 flex-1">{desc}</p>
    <button onClick={onClick} disabled={disabled} className={`game-btn ${type === 'diamond' ? 'game-btn-purple' : 'game-btn-gold'} w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {type === 'diamond' ? '💎' : '💰'} {cost}
    </button>
  </div>
);