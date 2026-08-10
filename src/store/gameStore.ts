"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type GameTab = "dashboard" | "character" | "missions" | "inventory" | "map" | "tower" | "pvp" | "guild" | "shop" | "rankings" | "forge" | "achievements" | "afk" | "dungeon" | "mailbox" | "code" | "report" | "donate" | "settings";

interface GameState {
  userId: string | null;
  characterId: string | null;
  character: Record<string, unknown> | null;
  inventory: Array<Record<string, unknown>>;
  activeMissions: Array<Record<string, unknown>>;
  availableMissions: Array<Record<string, unknown>>;
  afkRewards: { gold: number; xp: number; duration: number } | null;
  locale: string;
  activeTab: GameTab;
  isLoggedIn: boolean;
  hasCharacter: boolean;
  loading: boolean;
  battleLog: string[];
  notification: { message: string; type: "success" | "error" | "info" } | null;
  mailbox: Array<Record<string, unknown>>;
  mailboxCount: number;
  soundOn: boolean;
  volume: number;

  setUser: (userId: string, locale?: string) => void;
  setCharacter: (char: Record<string, unknown>) => void;
  setTab: (tab: GameTab) => void;
  setLocale: (l: string) => void;
  setLoading: (l: boolean) => void;
  setInventory: (inv: Array<Record<string, unknown>>) => void;
  setActiveMissions: (m: Array<Record<string, unknown>>) => void;
  setAvailableMissions: (m: Array<Record<string, unknown>>) => void;
  setAfkRewards: (r: { gold: number; xp: number; duration: number } | null) => void;
  setBattleLog: (log: string[]) => void;
  setMailbox: (m: Array<Record<string, unknown>>) => void;
  setMailboxCount: (n: number) => void;
  setSoundOn: (on: boolean) => void;
  setVolume: (v: number) => void;
  notify: (message: string, type: "success" | "error" | "info") => void;
  clearNotification: () => void;
  /** Mantém a sessão logada mas zera o personagem (usado ao trocar de conta). */
  resetSession: () => void;
  logout: () => void;
}

const initialState = {
  userId: null as string | null,
  characterId: null as string | null,
  character: null as Record<string, unknown> | null,
  inventory: [] as Array<Record<string, unknown>>,
  activeMissions: [] as Array<Record<string, unknown>>,
  availableMissions: [] as Array<Record<string, unknown>>,
  afkRewards: null as { gold: number; xp: number; duration: number } | null,
  locale: "pt-BR",
  activeTab: "dashboard" as GameTab,
  isLoggedIn: false,
  hasCharacter: false,
  loading: false,
  battleLog: [] as string[],
  notification: null as { message: string; type: "success" | "error" | "info" } | null,
  mailbox: [] as Array<Record<string, unknown>>,
  mailboxCount: 0,
  soundOn: true,
  volume: 0.6,
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (userId, locale) => set({ userId, isLoggedIn: true, locale: locale || "pt-BR" }),
      setCharacter: (char) => set({ character: char, characterId: char?.id as string, hasCharacter: true }),
      setTab: (tab) => set({ activeTab: tab }),
      setLocale: (locale) => set({ locale }),
      setLoading: (loading) => set({ loading }),
      setInventory: (inventory) => set({ inventory }),
      setActiveMissions: (activeMissions) => set({ activeMissions }),
      setAvailableMissions: (availableMissions) => set({ availableMissions }),
      setAfkRewards: (afkRewards) => set({ afkRewards }),
      setBattleLog: (battleLog) => set({ battleLog }),
      setMailbox: (mailbox) => set({ mailbox }),
      setMailboxCount: (mailboxCount) => set({ mailboxCount }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      notify: (message, type) => set({ notification: { message, type } }),
      clearNotification: () => set({ notification: null }),
      resetSession: () => set({
        character: null,
        characterId: null,
        hasCharacter: false,
        inventory: [],
        activeMissions: [],
        availableMissions: [],
        afkRewards: null,
        mailbox: [],
        mailboxCount: 0,
        battleLog: [],
        activeTab: "dashboard",
      }),
      logout: () => set({ ...initialState }),
    }),
    {
      name: "realm-of-eternity-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        characterId: state.characterId,
        character: state.character,
        inventory: state.inventory,
        activeMissions: state.activeMissions,
        availableMissions: state.availableMissions,
        afkRewards: state.afkRewards,
        locale: state.locale,
        activeTab: state.activeTab,
        isLoggedIn: state.isLoggedIn,
        hasCharacter: state.hasCharacter,
        mailboxCount: state.mailboxCount,
        soundOn: state.soundOn,
        volume: state.volume,
      }),
    }
  )
);