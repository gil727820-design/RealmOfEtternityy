"use client";
import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { REGIONS, regionWithAlpha, classImage, type ClassName } from "@/game/constants";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import DashboardPanel from "./panels/DashboardPanel";
import MissionsPanel from "./panels/MissionsPanel";
import InventoryPanel from "./panels/InventoryPanel";
import MapPanel from "./panels/MapPanel";
import TowerPanel from "./panels/TowerPanel";
import PvPPanel from "./panels/PvPPanel";
import GuildPanel from "./panels/GuildPanel";
import ShopPanel from "./panels/ShopPanel";
import GhostShopPanel from "./panels/GhostShopPanel";
import WorldBossPanel from "./panels/WorldBossPanel";
import MarketPanel from "./panels/MarketPanel";
import RankingsPanel from "./panels/RankingsPanel";
import ForgePanel from "./panels/ForgePanel";
import AchievementsPanel from "./panels/AchievementsPanel";
import AfkPanel from "./panels/AfkPanel";
import DungeonPanel from "./panels/DungeonPanel";
import SkillTreePanel from "./panels/SkillTreePanel";
import MailboxPanel from "./panels/MailboxPanel";
import CodePanel from "./panels/CodePanel";
import DonatePanel from "./panels/DonatePanel";
import SettingsPanel from "./panels/SettingsPanel";
import MusicController from "./MusicController";
import PreloadImages from "./ui/PreloadImages";
import { skinById } from "@/game/skins";

export default function GameScreen() {
  const { activeTab, characterId, setCharacter, character, notification, clearNotification, setInventory, setActiveMissions, setAvailableMissions, setAfkRewards, setMailboxCount, notify, logout, locale } = useGameStore();
  const [collapsed, setCollapsed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Chave usada para remontar o painel atual após o refresh (cada painel
  // busca dados frescos do servidor ao montar).
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Inicia com o menu recolhido no celular (onde a sidebar cobriria a tela),
  // deixando o botão flutuante visível em vez de abrir o painel por padrão.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setCollapsed(true);
    }
  }, []);

  const loadCharData = useCallback(async (): Promise<boolean> => {
    if (!characterId) {
      setInitialLoading(false);
      return false;
    }
    
    try {
      const res = await fetch(`/api/character/${characterId}`);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        // 401 = sessão inválida/expirada, 403 = conta banida, 404 = personagem
        // removido. Em todos os casos volta ao login — sem travar numa tela de
        // erro com retry que nunca resolve.
        logout();
        return false;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("general.loadCharError", locale));
      }
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      if (data.inventory) setInventory(data.inventory);
      if (data.activeMissions) setActiveMissions(data.activeMissions);
      if (data.availableMissions) setAvailableMissions(data.availableMissions);
      if (data.afkRewards) setAfkRewards(data.afkRewards);
      if (typeof data.mailboxCount === "number") setMailboxCount(data.mailboxCount);
      setLoadError(null);
      return true;
    } catch (e) {
      console.error("Load error:", e);
      setLoadError(e instanceof Error ? e.message : t("general.loadDataError", locale));
      return false;
    } finally {
      setInitialLoading(false);
    }
  }, [characterId, setCharacter, setInventory, setActiveMissions, setAvailableMissions, setAfkRewards, setMailboxCount, logout]);

  useEffect(() => { loadCharData(); }, [loadCharData]);

  // Refresh manual: recarrega os dados do servidor e remonta o painel atual
  // (mercado, correio, rankings etc. buscam dados frescos ao montar) — sem
  // precisar recarregar a página inteira.
  const refreshGame = useCallback(async () => {
    if (refreshing || !characterId) return;
    setRefreshing(true);
    try {
      const ok = await loadCharData();
      if (ok) {
        setRefreshKey((k) => k + 1);
        notify(t("general.refreshed", locale), "success");
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, characterId, loadCharData, notify, locale]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  // Heartbeat de presença: mantém o personagem marcado como "online" enquanto o
  // jogo está aberto (o SettingsPanel mostra a contagem real em "/api/presence").
  useEffect(() => {
    if (!characterId) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = () => {
      if (stopped) return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      }).catch(() => {});
    };
    const start = () => {
      if (timer) clearInterval(timer);
      ping();
      timer = setInterval(ping, 45000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", stop);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", stop);
    };
  }, [characterId]);

  const renderPanel = () => {
    if (initialLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
          <div className="text-6xl mb-6 animate-bounce">⚔️</div>
          <div className="spinner mb-4"></div>
          <p className="text-gray-400 text-lg">{t("general.loading", locale)}</p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
          <p className="text-red-400 text-lg mb-4">{loadError}</p>
          <button onClick={loadCharData} className="game-btn">
            🔄 {t("general.retry", locale)}
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard": case "character": return <DashboardPanel />;
      case "missions": return <MissionsPanel />;
      case "inventory": return <InventoryPanel />;
      case "map": return <MapPanel />;
      case "tower": return <TowerPanel />;
      case "pvp": return <PvPPanel />;
      case "guild": return <GuildPanel />;
      case "shop": return <ShopPanel />;
      case "ghostshop": return <GhostShopPanel />;
      case "worldboss": return <WorldBossPanel />;
      case "market": return <MarketPanel />;
      case "rankings": return <RankingsPanel />;
      case "forge": return <ForgePanel />;
      case "achievements": return <AchievementsPanel />;
      case "afk": return <AfkPanel />;
      case "dungeon": return <DungeonPanel />;
      case "skills": return <SkillTreePanel />;
      case "mailbox": return <MailboxPanel />;
      case "code": return <CodePanel />;
      case "donate": return <DonatePanel />;
      case "settings": return <SettingsPanel />;
      default: return <DashboardPanel />;
    }
  };

  const regionId = (character?.currentRegion as string) || "starter_village";
  const currentRegion = REGIONS.find((r) => r.id === regionId) || REGIONS[0];
  const regionAccent = currentRegion.accent;

  const avatarSrc =
    (() => {
      const sid = (character as any)?.activeSkinId;
      return sid ? skinById(String(sid))?.image : null;
    })() ||
    classImage(((character?.classType as ClassName) || "warrior"), (character?.sex as string) || "male");

  return (
    <div
      className="min-h-screen relative overflow-hidden text-white"
      style={{ "--region-accent": regionAccent } as CSSProperties}
    >
      {/* Preload: personagem + HUD + fundo da região atual */}
      <PreloadImages urls={[avatarSrc, currentRegion.bg, currentRegion.image]} />
      {/* Background Effects — fundo da ilha atual */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#0a0a12]" />
        <img
          key={regionId}
          src={currentRegion.bg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover animate-bg-fade"
          style={{ filter: "brightness(0.55) saturate(0.9)" }}
        />
        {/* Overlay para leitura do conteúdo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75" />
        {/* Brilho difuso no tema da ilha */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[128px]"
          style={{ backgroundColor: regionWithAlpha(regionAccent, 0.16) }}
        />
        <div
          className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full blur-[128px]"
          style={{ backgroundColor: regionWithAlpha(regionAccent, 0.13) }}
        />
        <div
          className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] rounded-full blur-[128px]"
          style={{ backgroundColor: regionWithAlpha(regionAccent, 0.12) }}
        />
        {[...Array(9)].map((_, i) => (
            <div key={i} className="particle" />
        ))}
      </div>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <MusicController />

      <div className={"relative z-10 transition-all duration-500 ease-in-out " + (collapsed ? "md:pl-0" : "md:pl-60")}>
        <header
          className="sticky top-0 z-30 px-6 py-4 border-b glass-effect transition-colors duration-700"
          style={{
            borderColor: regionWithAlpha(regionAccent, 0.25),
            boxShadow: `0 1px 0 ${regionWithAlpha(regionAccent, 0.15)}, 0 8px 30px ${regionWithAlpha(regionAccent, 0.06)}`,
          }}
        >
          <TopBar onRefresh={refreshGame} refreshing={refreshing} />
        </header>

        <main className="p-6 max-w-7xl mx-auto">
          {/* key={refreshKey} remonta o painel após o refresh para buscar dados novos */}
          <div key={refreshKey}>{renderPanel()}</div>
        </main>
      </div>

      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideInRight max-w-md rounded-2xl px-6 py-4 text-sm font-medium shadow-2xl border backdrop-blur-xl toast">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {notification.type === "success" ? "✅" : notification.type === "error" ? "❌" : "ℹ️"}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
