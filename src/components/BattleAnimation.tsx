"use client";
import { useState, useEffect } from "react";

type BattleLine = string;

export default function BattleAnimation({ log, onComplete, playerImg, enemyImg }: { log: BattleLine[]; onComplete: () => void; playerImg?: string; enemyImg?: string }) {
  const [visible, setVisible] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!log || log.length === 0) { onComplete(); return; }
    
    const interval = setInterval(() => {
      setVisible(prev => {
        if (prev >= log.length) {
          clearInterval(interval);
          setIsComplete(true);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, [log, onComplete]);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  // Handle enemy name extraction from log: find the first line matching "NAME →" or "🛡️ NAME →"
  let enemyName = "INIMIGO";
  if (log.length > 0) {
    const first = log[0];
    const match = first.match(/^(?:⚔️|🛡️)?\s*([^→]+?)\s*→/);
    const otherName = match ? match[1].trim() : null;
    if (otherName && otherName !== "VOCÊ") {
      // Try to identify the name that is not the attacker (attacker appears in "⚔️" lines)
      for (const line of log) {
        const m = line.match(/^🛡️\s*([^→]+?)\s*→/);
        if (m) { enemyName = m[1].trim().toUpperCase(); break; }
      }
      if (enemyName === "INIMIGO") enemyName = otherName.toUpperCase();
    }
  }

  return (
    <div className="game-card p-6 animate-scaleIn relative overflow-hidden min-h-[350px] border-accent/20 bg-gradient-to-b from-gray-900/70 to-black/60">
      {/* Brilho radial de arena */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#4ecdc4]/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-4 left-4 text-6xl animate-float">⚔️</div>
        <div className="absolute bottom-4 right-4 text-6xl animate-floatSlow">🛡️</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl animate-pulse-glow">💥</div>
      </div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="text-center">
          {playerImg ? (
            <img
              src={playerImg}
              alt="Você"
              className={`w-24 h-24 mx-auto mb-2 rounded-xl border-2 border-[#4ecdc4]/50 object-cover shadow-[0_0_20px_rgba(78,205,196,0.3)] ${visible >= log.length ? "animate-bounceIn" : "animate-float"}`}
            />
          ) : (
            <div className={`text-6xl mb-2 ${visible >= log.length ? "animate-bounceIn" : "animate-float"}`}>🧙♂️</div>
          )}
          <div className="text-sm font-bold text-white tracking-wider">VOCÊ</div>
        </div>
        
        <div className="text-center px-4">
          <div className="text-4xl font-black text-accent glow-text animate-pulse-soft">
            {visible}/{log.length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">rounds</div>
        </div>
        
        <div className="text-center">
          {enemyImg ? (
            <img
              src={enemyImg}
              alt="Inimigo"
              className={`w-24 h-24 mx-auto mb-2 rounded-xl border-2 border-[#ef4444]/50 object-cover shadow-[0_0_20px_rgba(239,68,68,0.3)] ${visible >= log.length ? "animate-shake" : "animate-floatSlow"}`}
            />
          ) : (
            <div className={`text-6xl mb-2 ${visible >= log.length ? "animate-shake" : "animate-floatSlow"}`}>👹</div>
          )}
          <div className="text-sm font-bold text-white tracking-wider">{enemyName}</div>
        </div>
      </div>
      
      <div className="relative bg-bg-primary/80 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-sm space-y-2 border border-white/5 shadow-inner">
        {log.slice(0, visible).map((line, i) => (
          <div 
            key={i}
            className={`py-1.5 px-3 rounded-lg transition-all animate-fadeIn ${
              line.includes("CRIT") ? "bg-gold/10 text-gold font-bold shadow-sm" :
              line.includes("MISS") || line.includes("ESQUIVA") ? "text-gray-600" :
              line.includes("derrotado") || line.includes("🏆") ? "text-xp-green font-bold" :
              line.includes("caiu") || line.includes("💀") ? "text-hp-red font-bold" :
              line.includes("Você") ? "text-mana-blue" :
              "text-gray-400"
            }`}
          >
            {line}
          </div>
        ))}
        {visible < log.length && (
          <div className="flex items-center gap-3 text-accent animate-pulse-soft py-2">
            <div className="spinner spinner-sm border-accent"></div>
            <span>Lutando...</span>
          </div>
        )}
        {isComplete && (
          <div className="text-center py-4 animate-bounceIn">
            <span className="text-3xl">⚔️</span>
            <span className="text-gold font-bold ml-3 text-lg glow-text">Batalha concluída!</span>
          </div>
        )}
      </div>
    </div>
  );
}