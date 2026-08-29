"use client";
import { useCallback, useRef, useState } from "react";

export type AnimSide = "player" | "monster";

export interface SpriteAnimApi {
  playerAnim: string;
  monsterAnim: string;
  showSlash: boolean;
  slashCrit: boolean;
  processEvents: (events: any[], won: boolean, lost: boolean) => void;
  triggerRunIn: () => void;
}

/**
 * Hook que gerencia animações visuais de sprite para a arena de batalha.
 * Converte eventos de combate em classes CSS animadas.
 *
 * Animações disponíveis:
 *   player → lunge, skill, hit, dodge, death, victory, run-in
 *   monster → lunge, hit, dodge, rage, death, run-in
 */
export default function useSpriteAnim(): SpriteAnimApi {
  const [playerAnim, setPlayerAnim] = useState("");
  const [monsterAnim, setMonsterAnim] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashCrit, setSlashCrit] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAnim = useCallback((side: AnimSide, animClass: string, durationMs: number) => {
    const setter = side === "player" ? setPlayerAnim : setMonsterAnim;
    setter(animClass);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setter(""), durationMs);
  }, []);

  const triggerSlash = useCallback((crit: boolean) => {
    if (slashTimerRef.current) clearTimeout(slashTimerRef.current);
    setShowSlash(true);
    setSlashCrit(crit);
    slashTimerRef.current = setTimeout(() => setShowSlash(false), 450);
  }, []);

  const processEvents = useCallback((events: any[], won: boolean, lost: boolean) => {
    if (!Array.isArray(events)) return;

    for (const ev of events) {
      // "monster" (torre/boss) e "enemy" (PvP) são o mesmo lado adversário.
      const raw = ev.target as string | undefined;
      if (!raw) continue;
      const t: AnimSide | undefined = raw === "player" ? "player" : raw === "monster" || raw === "enemy" ? "monster" : undefined;
      if (!t) continue;

      switch (ev.type) {
        case "hit":
          // Quem atacou: lunge (player ataca → player lunge p/ direita)
          if (t === "monster") {
            triggerAnim("player", "sprite-lunge", 500);
            triggerAnim("monster", "sprite-hit", 550);
            triggerSlash(false);
          } else {
            triggerAnim("monster", "sprite-lunge", 500);
            triggerAnim("player", "sprite-hit", 550);
          }
          break;
        case "crit":
          if (t === "monster") {
            triggerAnim("player", "sprite-lunge", 500);
            triggerAnim("monster", "sprite-hit", 550);
            triggerSlash(true);
          } else {
            triggerAnim("monster", "sprite-lunge", 500);
            triggerAnim("player", "sprite-hit", 550);
          }
          break;
        case "skill":
          if (t === "monster") {
            triggerAnim("player", "sprite-skill", 600);
            triggerAnim("monster", "sprite-hit", 550);
            triggerSlash(true);
          } else {
            triggerAnim("monster", "sprite-lunge", 500);
            triggerAnim("player", "sprite-hit", 550);
          }
          break;
        case "dodge":
          triggerAnim(t, "sprite-dodge", 550);
          break;
        case "rage":
          triggerAnim("monster", "sprite-rage", 1500);
          break;
        case "super":
          triggerAnim("monster", "sprite-lunge", 600);
          triggerAnim("player", "sprite-hit", 550);
          break;
      }
    }

    if (won) {
      triggerAnim("player", "sprite-victory", 1800);
      triggerAnim("monster", "sprite-death", 1100);
    }
    if (lost) {
      triggerAnim("player", "sprite-death", 1100);
    }
  }, [triggerAnim, triggerSlash]);

  const triggerRunIn = useCallback(() => {
    triggerAnim("player", "sprite-run-in", 900);
    triggerAnim("monster", "sprite-run-in", 900);
  }, [triggerAnim]);

  return {
    playerAnim,
    monsterAnim,
    showSlash,
    slashCrit,
    processEvents,
    triggerRunIn,
  };
}