"use client";

import type { CSSProperties } from "react";

export interface WarriorSpriteProps {
  /** URLs das camadas, em ordem de baixo para cima (já ordenadas). */
  layers: string[];
  className?: string;
  alt?: string;
  style?: CSSProperties;
}

/**
 * Guerreiro em camadas: empilha os PNGs (todos no mesmo canvas 1632×2176,
 * alinhados) como <img> absolutas dentro de um contêiner 3:4. É a composição
 * em tempo real dentro do site, sem geração estática.
 */
export default function WarriorSprite({ layers, className = "", alt = "", style }: WarriorSpriteProps) {
  if (!layers.length) return null;
  return (
    <div
      className={`relative overflow-hidden select-none pointer-events-none ${className}`}
      style={{ aspectRatio: "3 / 4", ...style }}
    >
      {layers.map((src) => (
        <img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ))}
    </div>
  );
}

interface SpriteOrEmojiProps {
  /** URL do sprite sheet; se ausente cai para o emoji. */
  src?: string;
  emoji?: string;
  alt?: string;
  className?: string;
  emojiClass?: string;
}

/**
 * Preview de item: mostra o sprite/camada do guerreiro quando o item tem
 * arte (sheet), ou o emoji padrão do template caso contrário.
 */
export function SpriteOrEmoji({ src, emoji, alt = "", className = "w-10 h-10", emojiClass = "text-2xl" }: SpriteOrEmojiProps) {
  if (src) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
        <img src={src} alt={alt} draggable={false} loading="lazy" decoding="async" className="h-full w-full object-contain object-center" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center shrink-0 leading-none ${emojiClass}`}>
      {emoji || "❔"}
    </span>
  );
}