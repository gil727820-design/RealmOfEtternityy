"use client";

import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { TITLES } from "@/game/titles";
import { skinById } from "@/game/skins";

export default function TopBar({ onRefresh, refreshing }: { onRefresh?: () => void; refreshing?: boolean }) {
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
    <div className="flex items-center justify-between w-full gap-2">
      {/* Resources — compacto no mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-wrap min-w-0">
        <ResourcePill
          icon="💰"
          img="/images/icons/icone_moeda.png"
          value={gold.toLocaleString()}
          color="gold"
          front
          compact
        />
        <ResourcePill
          icon="💎"
          img="/images/icons/icone_diamante.png"
          value={diamonds.toLocaleString()}
          color="diamond"
          compact
        />
        <ResourcePill
          icon="⚡"
          img="/images/icons/icone_raio.png"
          value={`${energy}/${maxEnergy}`}
          color="energy-yellow"
          compact
        />
        <button
          onClick={() => setTab("mailbox")}
          title={t("nav.mailbox", locale)}
          className="relative flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/10 hover:border-[#d4a843]/50 transition-colors group cursor-pointer touch-target"
        >
          <span className="text-lg sm:text-xl group-hover:animate-bounceIn">📬</span>
          <span className="text-xs sm:text-sm font-bold text-gray-300 group-hover:text-white hidden sm:inline">
            {t("nav.mailbox", locale)}
          </span>
          {mailboxCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 min-w-[18px] sm:min-w-5 h-[18px] sm:h-5 px-1 rounded-full bg-[#d4a843] text-black text-[9px] sm:text-[10px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(212,168,67,0.6)] animate-pulse">
              {mailboxCount}
            </span>
          )}
        </button>
      </div>
      
      {/* Right side — compacto no mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0">
        {character.activeTitle ? (
          (() => {
            const title = TITLES.find((x) => x.id === character.activeTitle);
            return title ? (
              <div
                className="hidden lg:flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-1.5 border border-[#facc15]/30"
                title={t(title.nameKey, locale)}
              >
                <span>{title.icon}</span>
                <span className="text-xs font-bold text-[#facc15]">{t(title.nameKey, locale)}</span>
              </div>
            ) : null;
          })()
        ) : null}
        <div className="hidden sm:flex items-center gap-1.5 bg-bg-surface rounded-xl px-2.5 sm:px-3 py-1.5 border border-white/5">
          <span className="text-gold font-bold text-xs sm:text-sm">Lv.{level}</span>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-bg-surface rounded-xl px-3 py-1.5 border border-white/5 text-gray-400 text-sm">
          <span>{t(`region.${region}`, locale)}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <img
            src={avatarSrc}
            alt={(character.name as string) || "Player"}
            className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full border-2 border-[#d4a843]/45 object-cover shadow-[0_0_10px_rgba(212,168,67,0.25)]"
          />
          <span className="hidden lg:block text-sm font-bold text-white">{(character.name as string) || "Player"}</span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title={t("general.refresh", locale)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/10 hover:border-[#d4a843]/50 transition-colors group cursor-pointer disabled:opacity-60 disabled:cursor-wait touch-target"
          >
            <span className={`text-lg sm:text-xl ${refreshing ? "animate-spin" : "group-hover:animate-bounceIn"}`}>🔄</span>
            <span className="text-xs sm:text-sm font-bold text-gray-300 group-hover:text-white hidden sm:inline">
              {refreshing ? t("general.loading", locale) : t("general.refresh", locale)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const ResourcePill = ({ icon, value, color, img, front, compact }: { icon: string, value: string | number, color: string, img?: string, front?: boolean, compact?: boolean }) => (
  <div
    className={
      "flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/10 hover:border-[#d4a843]/50 transition-colors group stat-card " +
      (front ? "z-20 -mr-1 ring-1 ring-[#d4a843]/40 bg-gradient-to-r from-[#2a2210]/90 to-[#1c1c2f] shadow-[0_0_12px_rgba(212,168,67,0.15)]" : "")
    }
  >
    {img ? (
      <img
        src={img}
        alt={icon}
        className={`${compact ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:w-6 sm:h-6'} object-contain group-hover:animate-bounceIn`}
        draggable={false}
      />
    ) : (
      <span className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} group-hover:animate-bounceIn`}>{icon}</span>
    )}
    <span className={`font-bold text-white whitespace-nowrap ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>{value}</span>
  </div>
);
