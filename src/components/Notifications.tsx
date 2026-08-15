"use client";
import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";

const LS_KEY = "realm_notifications_enabled";
const POLL_MS = 30_000;

/**
 * Notificações do NAVEGADOR (desktop/celular): avisa quando a energia enche,
 * a Loja Fantasma abre ou o Boss Mundial aparece — mesmo com o jogo em outra
 * aba. Ativável nas Configurações (persiste em localStorage).
 */
export default function Notifications() {
  const { characterId } = useGameStore();
  const enabledRef = useRef(false);
  const lastRef = useRef({ energyFull: false, ghostShopOpen: false, worldBossOpen: false });

  // Ativa/desativa por mudanças no localStorage (o SettingsPanel controla).
  useEffect(() => {
    const read = () => {
      enabledRef.current = typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "1";
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("realm-notifications-change", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("realm-notifications-change", read);
    };
  }, []);

  useEffect(() => {
    if (!characterId || typeof window === "undefined") return;
    let stopped = false;

    const maybeNotify = (title: string, body: string) => {
      try {
        // Só notifica se o jogo não estiver focado (não atrapalha quem está jogando).
        if (document.visibilityState === "visible") return;
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        new Notification(title, { body, icon: "/images/sidebar/menu_torre.png" });
      } catch { /* ignora */ }
    };

    const poll = async () => {
      if (stopped || !enabledRef.current || !characterId) return;
      try {
        const res = await fetch(`/api/notifications/check?characterId=${encodeURIComponent(characterId)}`);
        const d = await res.json();
        const last = lastRef.current;
        if (d.energyFull && !last.energyFull) {
          maybeNotify("⚡ Energia cheia!", "Sua energia está no máximo — aproveite para jogar!");
        }
        if (d.ghostShopOpen && !last.ghostShopOpen) {
          maybeNotify("👻 Loja Fantasma aberta!", "A loja de moedas da torre acabou de abrir!");
        }
        if (d.worldBossOpen && !last.worldBossOpen) {
          maybeNotify("🌍 Boss Mundial!", "O Evento Global começou — junte sua squad e lute!");
        }
        lastRef.current = { energyFull: !!d.energyFull, ghostShopOpen: !!d.ghostShopOpen, worldBossOpen: !!d.worldBossOpen };
      } catch { /* silencioso */ }
    };

    // Estado inicial silencioso (não dispara notificação logo de cara).
    (async () => {
      try {
        const res = await fetch(`/api/notifications/check?characterId=${encodeURIComponent(characterId)}`);
        const d = await res.json();
        lastRef.current = { energyFull: !!d.energyFull, ghostShopOpen: !!d.ghostShopOpen, worldBossOpen: !!d.worldBossOpen };
      } catch { /* silencioso */ }
    })();

    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [characterId]);

  return null;
}
