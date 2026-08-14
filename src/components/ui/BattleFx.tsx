"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Efeitos visuais de batalha (Torre + PvP):
 *  - partículas (sparks) que explodem no alvo ao acertar/critar/usar golpe;
 *  - anel de impacto no golpe especial e no crítico;
 *  - ícone do DEBUFF da árvore de habilidades flutuando sobre o alvo;
 *  - cura flutuante verde quando o personagem se cura.
 *
 * Uso:
 *   const fx = useBattleFx();
 *   fx.applyRound(data, { player: "player", enemy: "monster" });
 *   <div className="relative"> <img ... /> <BattleFxLayer fx={fx} /> </div>
 */

export type FxTarget = "player" | "enemy";
export type FxKind = "spark" | "ring" | "debuff" | "heal";

export interface FxItem {
  id: number;
  kind: FxKind;
  target: FxTarget;
  color?: string;
  icon?: string;
  amount?: number;
  /** delay aleatório para partículas (0–0.15s). */
  delay?: number;
  /** tamanho da partícula (px). */
  size?: number;
  /** desvio horizontal da partícula (px). */
  dx?: number;
  /** desvio vertical da partícula (px). */
  dy?: number;
}

export interface BattleFxApi {
  items: FxItem[];
  applyRound: (data: any, sides?: { player?: string; enemy?: string }) => void;
  clear: () => void;
}

const SPARK_COLORS: Record<string, string> = {
  hit: "#ffd700",
  crit: "#ff5252",
  skill: "#a855f7",
  bleed: "#ff4757",
  burn: "#ff8c2e",
  poison: "#22c55e",
};

const DEBUFF_ICONS: Record<string, { icon: string; color: string }> = {
  "🩸": { icon: "🩸", color: "#ff4757" },
  "🔥": { icon: "🔥", color: "#ff8c2e" },
  "🐍": { icon: "🐍", color: "#22c55e" },
  "💫": { icon: "💫", color: "#a855f7" },
  "🔨": { icon: "🔨", color: "#f59e0b" },
  "☠️": { icon: "☠️", color: "#8b5cf6" },
  "🐌": { icon: "🐌", color: "#4ecdc4" },
  "🙈": { icon: "🙈", color: "#e2e4f0" },
};

function detectDebuff(line: string): string | null {
  for (const emoji of Object.keys(DEBUFF_ICONS)) {
    if (line.includes(emoji)) return emoji;
  }
  return null;
}

function useBattleFx(): BattleFxApi {
  const [items, setItems] = useState<FxItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((item: Omit<FxItem, "id" | "delay"> & { delay?: number }, ttl: number) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { ...item, id }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), ttl);
  }, []);

  const spawnSparks = useCallback((target: FxTarget, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      // Valores aleatórios calculados AQUI (fora do render) e guardados no item.
      push({
        kind: "spark",
        target,
        color,
        delay: Math.random() * 0.15,
        size: 7 + Math.random() * 5,
        dx: (Math.random() - 0.5) * 90,
        dy: -40 - Math.random() * 60,
      }, 700);
    }
  }, [push]);

  const clear = useCallback(() => setItems([]), []);

  const applyRound = useCallback((data: any, sides?: { player?: string; enemy?: string }) => {
    if (!data) return;
    const sideFor = (target: string): FxTarget | null => {
      if (sides?.player && target === sides.player) return "player";
      if (sides?.enemy && target === sides.enemy) return "enemy";
      return null;
    };

    const events: any[] = Array.isArray(data.events) ? data.events : [];
    for (const ev of events) {
      const t = sideFor(ev.target);
      if (!t) continue;
      if (ev.type === "hit" || ev.type === "crit" || ev.type === "skill" || ev.type === "bleed") {
        const color = SPARK_COLORS[ev.type] ?? SPARK_COLORS.hit;
        spawnSparks(t, color, ev.type === "crit" ? 14 : ev.type === "skill" ? 12 : 7);
        if (ev.type === "crit" || ev.type === "skill") {
          push({ kind: "ring", target: t }, 600);
        }
        if (ev.type === "bleed") {
          push({ kind: "debuff", target: t, icon: "🩸" }, 1300);
        }
      }
      if (ev.type === "dodge") {
        push({ kind: "debuff", target: t, icon: "💨" }, 1100);
      }
    }

    // Debuffs da árvore de habilidades + curas, detectados pelo log.
    const log: string[] = Array.isArray(data.log) ? data.log : [];
    for (const line of log) {
      const debuff = detectDebuff(line);
      if (debuff && sides?.enemy) {
        push({ kind: "debuff", target: "enemy", icon: debuff }, 1400);
      }
      if (/se cura|cura!|Você se cura/i.test(line)) {
        const m = line.match(/\+(\d+)/);
        if (m && sides?.player) {
          push({ kind: "heal", target: "player", amount: Number(m[1]) }, 1300);
        }
      }
    }
  }, [push, spawnSparks]);

  return { items, applyRound, clear };
}

/** Camada de efeitos — renderize DENTRO do container `relative` do lutador. */
export function BattleFxLayer({ fx, target }: { fx: BattleFxApi; target?: FxTarget }) {
  return (
    <>
      {fx.items.filter((it) => !target || it.target === target).map((it) => {
        if (it.kind === "spark") {
          return (
            <span
              key={it.id}
              className="spark"
              style={{
                backgroundColor: it.color,
                color: it.color,
                width: it.size ?? 8,
                height: it.size ?? 8,
                animationDelay: `${it.delay ?? 0}s`,
                ["--dx" as string]: `${it.dx ?? 0}px`,
                ["--dy" as string]: `${it.dy ?? -40}px`,
              }}
            />
          );
        }
        if (it.kind === "ring") {
          return <span key={it.id} className="impact-ring" style={{ borderColor: it.color ?? "#ffd700" }} />;
        }
        if (it.kind === "debuff") {
          return (
            <span
              key={it.id}
              className="debuff-float"
              style={{ textShadow: `0 0 14px ${DEBUFF_ICONS[it.icon ?? ""]?.color ?? "#ff6b6b"}` }}
            >
              {it.icon}
            </span>
          );
        }
        return <span key={it.id} className="heal-float">+{it.amount}</span>;
      })}
    </>
  );
}

export default useBattleFx;
