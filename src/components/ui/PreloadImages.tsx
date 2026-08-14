"use client";

import { useEffect, useRef } from "react";

/**
 * Preloading de imagens críticas (personagem, HUD, sidebar).
 *
 * Injeta <link rel="preload" as="image"> no <head> assim que o componente
 * monta, fazendo o navegador baixar essas imagens ANTES de serem exibidas —
 * evitando o "flash" / atraso ao trocar de painel. Ideal para o avatar do
 * personagem e os ícones fixos do HUD (sempre visíveis).
 */
export default function PreloadImages({ urls }: { urls: string[] }) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const url of urls) {
      if (!url || seen.current.has(url)) continue;
      seen.current.add(url);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.fetchPriority = "high";
      document.head.appendChild(link);
    }
  }, [urls]);

  return null;
}