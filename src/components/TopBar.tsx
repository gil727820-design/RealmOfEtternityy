"use client";

import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { TITLES } from "@/game/titles";
import { skinById } from "@/game/skins";

export default function TopBar() {
  const { character, locale, mailboxCount, setTab } = useGameStore();
  if (!character) return null;

  const num = (v: unknown, fallback = 0) => typeof v === "number" ? v : fallback;
  const gold = num(character.gold);
  const diamonds = num(character.diamonds);
  const energy = num(character.energy);
  const maxEnergy = num(character.maxEnergy);
  const level = num(character.level, 1);
  const region = (character.currentRegion as string) || "starter_village";

  // Avatar: usa a skin equipada se houver, senão a imagem padrão da classe
  // (desequipar reverte automaticamente para o perfil original).
  const avatarSrc =
    (() => {
      const sid = (character as any)?.activeSkinId;
      return sid ? skinById(String(sid))?.image : null;
    })() ||
    classImage((character.classType as ClassName) || "warrior", (character.sex as string) || "male");

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <ResourcePill
          icon="💰"
          img="/images/icons/icone_moeda.png"
          value={gold.toLocaleString()}
          color="gold"
          front
        />
        <ResourcePill
          icon="💎"
          img="/images/icons/icone_diamante.png"
          value={diamonds.toLocaleString()}
          color="diamond"
        />
        <ResourcePill
          icon="⚡"
          img="/images/icons/icone_raio.png"
          value={`${energy}/${maxEnergy}`}
          color="energy-yellow"
        />
        <button
          onClick={() => setTab("mailbox")}
          title={t("nav.mailbox", locale)}
          className="relative flex items-center gap-2 rounded-xl px-4 py-2 border border-white/10 hover:border-[#facc15]/50 transition-colors group cursor-pointer"
        >
          <span className="text-xl group-hover:animate-bounceIn">📬</span>
          <span className="text-sm font-bold text-gray-300 group-hover:text-white hidden sm:inline">
            {t("nav.mailbox", locale)}
          </span>
          {mailboxCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-[#ffd700] text-black text-[10px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.6)] animate-pulse">
              {mailboxCount}
            </span>
          )}
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        {character.activeTitle ? (
          (() => {
            const title = TITLES.find((x) => x.id === character.activeTitle);
            return title ? (
              <div
                className="hidden md:flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-1.5 border border-[#facc15]/30"
                title={t(title.nameKey, locale)}
              >
                <span>{title.icon}</span>
                <span className="text-xs font-bold text-[#facc15]">{t(title.nameKey, locale)}</span>
              </div>
            ) : null;
          })()
        ) : null}
        <div className="hidden md:flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-1.5 border border-white/5">
          <span className="text-gold font-bold">Lv.{level}</span>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-1.5 border border-white/5 text-gray-400 text-sm">
          <span>{t(`region.${region}`, locale)}</span>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={avatarSrc}
            alt={(character.name as string) || "Player"}
            className="w-9 h-9 rounded-full border-2 border-[#ff6b6b]/40 object-cover shadow-[0_0_10px_rgba(255,107,107,0.2)]"
          />
          <span className="hidden lg:block text-sm font-bold text-white">{(character.name as string) || "Player"}</span>
        </div>
      </div>
    </div>
  );
}

const ResourcePill = ({ icon, value, color, img, front }: { icon: string, value: string | number, color: string, img?: string, front?: boolean }) => (
  <div
    className={
      "flex items-center gap-2 rounded-xl px-4 py-2 border border-white/10 hover:border-accent/40 transition-colors group stat-card " +
      (front ? "z-20 -mr-1 ring-1 ring-[#ffd700]/40 bg-gradient-to-r from-[#3a2f0a]/90 to-[#1c1c2f] shadow-[0_0_12px_rgba(255,215,0,0.15)]" : "")
    }
  >
    {img ? (
      <img
        src={img}
        alt={icon}
        className="w-6 h-6 object-contain group-hover:animate-bounceIn"
        draggable={false}
      />
    ) : (
      <span className="text-xl group-hover:animate-bounceIn">{icon}</span>
    )}
    <span className="font-bold text-white whitespace-nowrap">{value}</span>
  </div>
);
