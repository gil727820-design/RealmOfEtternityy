"use client";
import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { REGIONS, regionWithAlpha } from "@/game/constants";
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
import RankingsPanel from "./panels/RankingsPanel";
import ForgePanel from "./panels/ForgePanel";
import AchievementsPanel from "./panels/AchievementsPanel";
import AfkPanel from "./panels/AfkPanel";
import DungeonPanel from "./panels/DungeonPanel";
import MailboxPanel from "./panels/MailboxPanel";
import CodePanel from "./panels/CodePanel";
import ReportPanel from "./panels/ReportPanel";
import DonatePanel from "./panels/DonatePanel";
import SettingsPanel from "./panels/SettingsPanel";
import MusicController from "./MusicController";
import ServerNotice from "./ServerNotice";

export default function GameScreen() {
  const { activeTab, characterId, setCharacter, character, notification, clearNotification, setInventory, setActiveMissions, setAvailableMissions, setAfkRewards, setMailboxCount, logout, locale } = useGameStore();
  const [collapsed, setCollapsed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCharData = useCallback(async () => {
    if (!characterId) {
      setInitialLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/character/${characterId}`);
      if (res.status === 403) {
        // Conta banida — volta ao login.
        logout();
        return;
      }
      if (res.status === 404) {
        // Personagem não existe mais (foi deletado/deslogado) — volta ao login.
        logout();
        return;
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
    } catch (e) {
      console.error("Load error:", e);
      setLoadError(e instanceof Error ? e.message : t("general.loadDataError", locale));
    } finally {
      setInitialLoading(false);
    }
  }, [characterId, setCharacter, setInventory, setActiveMissions, setAvailableMissions, setAfkRewards, setMailboxCount, logout]);

  useEffect(() => { loadCharData(); }, [loadCharData]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

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
      case "rankings": return <RankingsPanel />;
      case "forge": return <ForgePanel />;
      case "achievements": return <AchievementsPanel />;
      case "afk": return <AfkPanel />;
      case "dungeon": return <DungeonPanel />;
      case "mailbox": return <MailboxPanel />;
      case "code": return <CodePanel />;
      case "report": return <ReportPanel />;
      case "donate": return <DonatePanel />;
      case "settings": return <SettingsPanel />;
      default: return <DashboardPanel />;
    }
  };

  const regionId = (character?.currentRegion as string) || "starter_village";
  const currentRegion = REGIONS.find((r) => r.id === regionId) || REGIONS[0];
  const regionAccent = currentRegion.accent;

  return (
    <div
      className="min-h-screen relative overflow-hidden text-white"
      style={{ "--region-accent": regionAccent } as CSSProperties}
    >
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
      <ServerNotice />

      <div className={"relative z-10 transition-all duration-500 ease-in-out " + (collapsed ? "md:pl-0" : "md:pl-56")}>
        <header
          className="sticky top-0 z-30 px-6 py-4 border-b glass-effect transition-colors duration-700"
          style={{
            borderColor: regionWithAlpha(regionAccent, 0.25),
            boxShadow: `0 1px 0 ${regionWithAlpha(regionAccent, 0.15)}, 0 8px 30px ${regionWithAlpha(regionAccent, 0.06)}`,
          }}
        >
          <TopBar />
        </header>

        <main className="p-6 max-w-7xl mx-auto">
          {renderPanel()}
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
