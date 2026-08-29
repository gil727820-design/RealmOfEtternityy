"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_AUTO_BATTLE, type AutoBattleSettings } from "@/game/autoBattle";

export type GameTab = "dashboard" | "character" | "missions" | "inventory" | "map" | "tower" | "pets" | "pvp" | "guild" | "shop" | "ghostshop" | "worldboss" | "market" | "rankings" | "forge" | "achievements" | "afk" | "dungeon" | "skills" | "mastery" | "mailbox" | "code" | "donate" | "settings" | "guide" | "dailylogin" | "bestiary" | "relics" | "specialization" | "collection" | "advancedclass" | "ascension" | "season" | "crafting" | "trade" | "challenge" | "dailyevents" | "skinshop" | "questlines" | "enchantments" | "refinement" | "worldexplore" | "inheritance" | "survivalarena";

interface GameState {
  userId: string | null;
  characterId: string | null;
  character: Record<string, unknown> | null;
  /** Todos os personagens da conta (para a tela de seleção). */
  characters: Array<Record<string, unknown>>;
  /** True enquanto a tela de escolha de personagem deve aparecer. */
  showCharacterSelect: boolean;
  /** True enquanto a tela de criação deve aparecer (inclusive para criar um 2º/3º personagem). */
  creatingCharacter: boolean;
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
  /** Preferências do Auto Battle (modo, auto-skill, auto-poção). */
  autoBattle: AutoBattleSettings;

  setUser: (userId: string, locale?: string) => void;
  setCharacter: (char: Record<string, unknown>) => void;
  setCharacters: (chars: Array<Record<string, unknown>>) => void;
  setShowCharacterSelect: (show: boolean) => void;
  setCreatingCharacter: (v: boolean) => void;
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
  setAutoBattle: (s: Partial<AutoBattleSettings>) => void;
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
  characters: [] as Array<Record<string, unknown>>,
  showCharacterSelect: false,
  creatingCharacter: false,
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
  volume: 0.08,
  autoBattle: { ...DEFAULT_AUTO_BATTLE },
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (userId, locale) => set({ userId, isLoggedIn: true, locale: locale || "pt-BR" }),
      setCharacter: (char) =>
        set({ character: char, characterId: char?.id as string, hasCharacter: true, showCharacterSelect: false }),
      setCharacters: (chars) =>
        set({ characters: chars, hasCharacter: chars.length > 0, creatingCharacter: false }),
      setShowCharacterSelect: (show) => set({ showCharacterSelect: show }),
      setCreatingCharacter: (v) => set({ creatingCharacter: v, showCharacterSelect: v ? false : undefined }),
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
      setAutoBattle: (patch) => set((s) => ({ autoBattle: { ...s.autoBattle, ...patch } })),
      notify: (message, type) => set({ notification: { message, type } }),
      clearNotification: () => set({ notification: null }),
      resetSession: () => set({
        character: null,
        characterId: null,
        characters: [],
        showCharacterSelect: false,
        creatingCharacter: false,
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
      logout: () => {
        // Limpa a sessão no servidor (cookie httpOnly) e o estado local.
        fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }).catch(() => {});
        set({ ...initialState });
      },
    }),
    {
      // v2: NÃO guarda mais dados de jogo no localStorage (personagem,
      // inventário, missões, aba ativa...). Isso causava "cache velho": ao
      // reentrar, o jogo exibia dados antigos em vez de buscar do servidor
      // (ex.: mercado bloqueado por nível desatualizado, updates sumindo).
      // Agora só preferências persistem; a sessão é restaurada via cookie
      // httpOnly (rota /api/auth/me) e os dados vêm frescos do banco.
      name: "realm-of-eternity-storage-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        locale: state.locale,
        soundOn: state.soundOn,
        volume: state.volume,
        autoBattle: state.autoBattle,
      }),
    }
  )
);