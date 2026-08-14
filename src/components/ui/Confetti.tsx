"use client";
import { useState } from "react";

/**
 * Confetes caindo — usado na tela de vitória (Torre e PvP).
 * Renderiza N pedaços com cores/durações/atrasos aleatórios calculados UMA vez
 * (lazy initializer do useState → sem chamadas impuras durante o render).
 */
const COLORS = [
  "#ffd700", "#ff5252", "#4ecdc4", "#a855f7",
  "#00ff88", "#3b82f6", "#ff8c2e", "#ec4899",
];

function makePieces(count: number) {
  return Array.from({ length: count }).map(() => ({
    id: Math.random().toString(36).slice(2),
    left: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 2.6 + Math.random() * 2.4,
    delay: Math.random() * 1.6,
    width: 7 + Math.random() * 5,
    height: 12 + Math.random() * 8,
  }));
}

export default function Confetti({ count = 70 }: { count?: number }) {
  const [pieces] = useState(() => makePieces(count));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.width,
            height: p.height,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
