"use client";

import { useEffect } from "react";

/** Registra o Service Worker do PWA (instalar no celular/desktop). */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // Falha de registro não deve quebrar o jogo — apenas avisa no console.
      console.warn("[pwa] falha ao registrar service worker:", e);
    });
  }, []);
  return null;
}
