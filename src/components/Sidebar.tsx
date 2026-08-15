"use client";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGameStore, type GameTab } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";
import { skinById } from "@/game/skins";
import PreloadImages from "./ui/PreloadImages";

type NavItem = { tab: GameTab; icon: string; image: string; labelKey: string; color: string; isNew?: boolean };
type NavSection = { titleKey?: string; items: NavItem[] };

/** Navegação organizada em seções: Aventura / Combate / Economia / Conta. */
const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.sec.aventura",
    items: [
      { tab: "dashboard", icon: "🏠", image: "/images/sidebar/menu_personagem.png", labelKey: "nav.character", color: "#ff6b6b" },
      { tab: "missions", icon: "📜", image: "/images/sidebar/menu_missoes.png", labelKey: "nav.missions", color: "#4ecdc4" },
      { tab: "inventory", icon: "🎒", image: "/images/sidebar/menu_inventario.png", labelKey: "nav.inventory", color: "#ffd700" },
      { tab: "map", icon: "🗺️", image: "/images/sidebar/menu_mapa.png", labelKey: "nav.map", color: "#22c55e" },
      { tab: "tower", icon: "🗼", image: "/images/sidebar/menu_torre.png", labelKey: "nav.tower", color: "#a855f7" },
    ],
  },
  {
    titleKey: "nav.sec.combate",
    items: [
      { tab: "pvp", icon: "⚔️", image: "/images/sidebar/menu_arena.png", labelKey: "nav.pvp", color: "#ef4444" },
      { tab: "dungeon", icon: "🕳️", image: "/images/sidebar/menu_masmorras.png", labelKey: "nav.dungeon", color: "#8b5cf6" },
      { tab: "guild", icon: "🏰", image: "/images/sidebar/menu_guilda.png", labelKey: "nav.guild", color: "#3b82f6" },
      { tab: "rankings", icon: "🏆", image: "/images/sidebar/menu_rankings.png", labelKey: "nav.rankings", color: "#f59e0b" },
    ],
  },
  {
    titleKey: "nav.sec.economia",
    items: [
      { tab: "shop", icon: "🛒", image: "/images/sidebar/menu_loja.png", labelKey: "nav.shop", color: "#ec4899" },
      { tab: "market", icon: "🏪", image: "/images/marketplace/icone_marketplace.png", labelKey: "nav.market", color: "#f59e0b", isNew: true },
      { tab: "forge", icon: "🔨", image: "/images/sidebar/menu_forja.png", labelKey: "nav.forge", color: "#f97316" },
      { tab: "afk", icon: "💤", image: "/images/sidebar/menu_afk.png", labelKey: "nav.afk", color: "#06b6d4" },
      { tab: "skills", icon: "🌳", image: "/images/sidebar/menu_habilidades.png", labelKey: "nav.skills", color: "#a855f7" },
      { tab: "achievements", icon: "🏅", image: "/images/sidebar/menu_conquistas.png", labelKey: "nav.achievements", color: "#8b5cf6" },
    ],
  },
  {
    titleKey: "nav.sec.conta",
    items: [
      { tab: "mailbox", icon: "📬", image: "/images/sidebar/menu_correio.png", labelKey: "nav.mailbox", color: "#facc15" },
      { tab: "code", icon: "🎟️", image: "/images/sidebar/menu_codigo.png", labelKey: "nav.code", color: "#a855f7" },
      { tab: "donate", icon: "💖", image: "/images/sidebar/menu_doar.png", labelKey: "nav.donate", color: "#ff4d6d" },
      { tab: "settings", icon: "⚙️", image: "/images/sidebar/menu_configuracoes.png", labelKey: "nav.settings", color: "#6b7280" },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { activeTab, setTab, locale, character, logout, mailboxCount } = useGameStore();

  const xpPct = character ? Math.min(100, ((typeof character.xp === "number" ? character.xp : 0) / Math.max(1, typeof character.xpToNext === "number" ? character.xpToNext : 100)) * 100) : 0;

  // Avatar: usa a skin equipada se houver, senão a imagem padrão da classe.
  const avatarSrc =
    (() => {
      const sid = character ? (character as any)?.activeSkinId : null;
      return sid ? skinById(String(sid))?.image : null;
    })() ||
    classImage(((character?.classType as ClassName) || "warrior"), (character?.sex as string) || "male");

  const navImages = NAV_SECTIONS.flatMap((s) => s.items).map((n) => n.image);

  return (
    <>
      {/* Pré-carrega os ícones fixos do menu (HUD) e o avatar */}
      <PreloadImages urls={[...new Set([...navImages, avatarSrc])]} />
      {/* Click-outside overlay: fecha a sidebar ao clicar em qualquer canto fora dela */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm cursor-pointer"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Floating toggle (visible when sidebar is hidden) — draggable */}
      {collapsed && <FloatingToggle onClick={onToggle} />}

      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-500 ease-in-out ${collapsed ? "-translate-x-full" : "translate-x-0"} w-60`}
        style={{
          background: "linear-gradient(180deg, rgba(13, 15, 28, 0.72) 0%, rgba(8, 9, 16, 0.78) 100%)",
          borderRight: "1px solid rgba(255, 107, 107, 0.12)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Logo + botão recolher */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3 shrink-0">
          <button
            onClick={onToggle}
            className="text-2xl hover:scale-110 transition-transform flex flex-col gap-1.5 p-1"
            aria-label="Toggle sidebar"
          >
            <span className="block w-6 h-0.5 bg-white rounded-full" />
            <span className="block w-6 h-0.5 bg-white rounded-full" />
            <span className="block w-6 h-0.5 bg-white rounded-full" />
          </button>
          {!collapsed && (
            <span className="text-sm font-black bg-gradient-to-r from-[#ff6b6b] to-[#ffd700] bg-clip-text text-transparent">
              Realm of Eternity
            </span>
          )}
        </div>

        {/* Character Mini Card */}
        {!collapsed && character && (
          <div className="p-4 border-b border-white/5 shrink-0">
            <div className="game-card p-3 text-center">
              <img
                src={avatarSrc}
                alt={character.name as string}
                className="w-16 h-16 mx-auto mb-1 rounded-full border-2 border-[#ff6b6b]/40 object-cover shadow-[0_0_15px_rgba(255,107,107,0.3)] animate-float"
              />
              <div className="text-sm font-bold truncate text-white">{(character.name as string) || "Player"}</div>
              <div className="text-xs text-gray-400 mb-2">Lv.{String(character.level ?? 1)}</div>
              <div className="bar-container h-1.5">
                <div className="xp-bar h-1.5" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {String(character.xp ?? 0)} / {String(character.xpToNext ?? 100)} XP
              </div>
            </div>
          </div>
        )}

        {/* Navegação em seções */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.titleKey ?? section.items[0].tab} className="space-y-1">
              {!collapsed && section.titleKey && (
                <>
                  <div className="px-2 mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                    {t(section.titleKey, locale)}
                  </div>
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-2" />
                </>
              )}
              {collapsed && <div className="h-px bg-white/5 mx-2 mb-2" />}
              {section.items.map((item) => {
                const active = activeTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    onClick={() => setTab(item.tab)}
                    title={collapsed ? t(item.labelKey, locale) : undefined}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      active ? "text-white font-bold" : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                    style={active ? { background: `linear-gradient(90deg, ${item.color}2e, transparent 85%)` } : undefined}
                  >
                    {/* Barra indicadora da aba ativa */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full"
                        style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` }}
                      />
                    )}
                    <span className="relative shrink-0">
                      <img
                        src={item.image}
                        alt={t(item.labelKey, locale)}
                        className="w-7 h-7 object-contain transition-transform group-hover:scale-110"
                        draggable={false}
                      />
                      {!collapsed && item.isNew && (
                        <span className="absolute -top-1 -right-2 px-1 py-px rounded-full text-[8px] font-black bg-[#f59e0b] text-black shadow-[0_0_8px_rgba(245,158,11,0.7)]">
                          {t("nav.badge.new", locale)}
                        </span>
                      )}
                    </span>
                    {!collapsed && <span className="truncate">{t(item.labelKey, locale)}</span>}
                    {!collapsed && item.tab === "mailbox" && mailboxCount > 0 && (
                      <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#ffd700] text-black text-[10px] font-black flex items-center justify-center">
                        {mailboxCount}
                      </span>
                    )}
                    {!collapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: item.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="shrink-0 p-4 border-t border-white/5 bg-black/20">
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10 transition-all ${collapsed ? "justify-center" : ""}`}
          >
            <span className="text-xl">🚪</span>
            {!collapsed && <span>{t("auth.logout", locale)}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

/**
 * Botão flutuante das 3 barras — pode ser arrastado livremente pela tela.
 * Um clique simples (sem arrasto) reabre o menu lateral.
 */
function FloatingToggle({ onClick }: { onClick: () => void }) {
  const [pos, setPos] = useState({ x: 12, y: 16 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  // Flag PERSISTENTE de arrasto: sobrevive ao pointerup, para o `click` saber
  // se o gesto foi um drag (não abre o menu nesse caso).
  const draggedRef = useRef(false);

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    draggedRef.current = false;
    window.addEventListener("pointermove", handleWindowMove);
    window.addEventListener("pointerup", handleWindowUp, { once: true });
    window.addEventListener("pointercancel", handleWindowUp, { once: true });
  };

  const handleWindowMove = (e: globalThis.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    // Limiar de 10px: um "tap" com micro-movimento no celular não vira drag.
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) draggedRef.current = true;
    setPos({
      x: clamp(drag.current.baseX + dx, 4, window.innerWidth - 56),
      y: clamp(drag.current.baseY + dy, 4, window.innerHeight - 56),
    });
  };

  const handleWindowUp = () => {
    window.removeEventListener("pointermove", handleWindowMove);
    window.removeEventListener("pointerup", handleWindowUp);
    window.removeEventListener("pointercancel", handleWindowUp);
    drag.current = null;
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onClick={() => {
        // Só abre se o gesto não foi um arrasto.
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onClick();
      }}
      aria-label="Open sidebar"
      title="Arraste para mover • Clique para abrir o menu"
      className="fixed z-50 bg-[#1a1a2e]/90 border border-white/10 rounded-xl p-2.5 flex flex-col gap-1.5 items-center hover:border-accent/40 hover:scale-105 transition-transform duration-150 shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      <span className="block w-6 h-0.5 bg-white rounded-full" />
      <span className="block w-6 h-0.5 bg-white rounded-full" />
      <span className="block w-6 h-0.5 bg-white rounded-full" />
    </button>
  );
}