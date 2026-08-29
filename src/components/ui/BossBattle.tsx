"use client";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";
import useSpriteAnim from "@/components/ui/useSpriteAnim";

/**
 * Batalha de Chefe ⚔️ — interface de combate igual à TORRE, reutilizável
 * para o mini-boss regional, o boss regional e o boss de guilda.
 *
 * Fluxo: arena (prévia do monstro) → batalha automática (barras de HP, log,
 * animações) → resultado (recompensas). O servidor decide as ações pelo modo
 * de Auto Battle configurado (a mesma lógica da torre).
 */

export interface BossBattleMonsterPreview {
  nameKey: string;
  image: string;
  icon?: string;
  stats: { maxHp: number; attack: number; defense: number; speed: number; critical: number; dodge: number };
}

interface BossBattleProps {
  /** Endpoint do POST (ex.: /api/region/mini-boss). */
  apiUrl: string;
  /** Monstro exibido na prévia (mesma imagem/stats do GET). */
  monster: BossBattleMonsterPreview;
  /** Título do card (ex.: 🐲 Mini-boss da região). */
  title: string;
  /** Rótulo do botão de lutar. */
  fightLabel: string;
  /** Body extra enviado junto (ex.: { extra: true } no boss de guilda). */
  extraBody?: Record<string, unknown>;
  /** Chamado quando a batalha termina (resultado final com recompensas). */
  onFinished: (result: any) => void;
  /** Chamado quando o jogador fecha/sai da batalha. */
  onExit: () => void;
  /** Conteúdo extra do resultado (drops, mensagens do boss de guilda...). */
  renderResult?: (result: any) => React.ReactNode;
  /** Cor de destaque (borda/botão). */
  accent?: string;
}

export default function BossBattle({
  apiUrl,
  monster,
  title,
  fightLabel,
  extraBody,
  onFinished,
  onExit,
  renderResult,
  accent = "#f59e0b",
}: BossBattleProps) {
  const { characterId, character, locale, notify, setCharacter, autoBattle } = useGameStore();
  const [stage, setStage] = useState<"arena" | "battle" | "result">("arena");
  const [battle, setBattle] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [floats, setFloats] = useState<Array<{ id: number; target: string; amount: number; crit: boolean; super?: boolean }>>([]);
  const [pShake, setPShake] = useState(0);
  const [mShake, setMShake] = useState(0);
  const [rageFx, setRageFx] = useState(false);
  const rageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spriteAnim = useSpriteAnim();
  const autoStop = useRef(false);
  const starting = useRef(false);
  const floatId = useRef(0);

  if (!character) return null;

  const playerImg = classImage(character.classType as ClassName, character.sex as string);
  const playerName = (character.name as string) || t("tower.your", locale);
  const monsterName = t(battle?.monNameKey || monster.nameKey, locale);

  const send = async (action: string, state: any) => {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, action, state, auto: autoBattle, ...(extraBody || {}) }),
    });
    return res.json();
  };

  const refreshChar = async () => {
    try {
      const r = await fetch(`/api/character/${characterId}`);
      const d = await r.json();
      if (d.character) setCharacter(d.character);
    } catch {
      /* ignora */
    }
  };

  const applyRound = (data: any): boolean => {
    if (!data || !data.battle) return false;
    setBattle(data.battle);
    if (data.log?.length) setLog((prev) => [...prev, ...data.log]);

    // Animações de sprite (investida, recuo, rage, morte...).
    spriteAnim.processEvents(data.events, !!data.won, !!data.lost);

    (data.events || []).forEach((ev: any) => {
      if (ev.amount && (ev.type === "hit" || ev.type === "crit" || ev.type === "skill")) {
        const id = ++floatId.current;
        setFloats((f) => [...f, { id, target: ev.target, amount: ev.amount, crit: ev.type === "crit" }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
      }
      // SUPER ATAQUE: float gigante vermelho + tremor forte no jogador
      if (ev.type === "super") {
        const id = ++floatId.current;
        setFloats((f) => [...f, { id, target: "player", amount: ev.amount, crit: true, super: true }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1500);
        setPShake((x) => x + 2);
      }
      // RAGE: banner "😡 RAGE!" no meio da tela
      if (ev.type === "rage") {
        setRageFx(true);
        if (rageTimer.current) clearTimeout(rageTimer.current);
        rageTimer.current = setTimeout(() => setRageFx(false), 1900);
      }
      if (ev.target === "monster" && ev.type !== "dodge") setMShake((x) => x + 1);
      if (ev.target === "player" && ev.type !== "dodge") setPShake((x) => x + 1);
    });

    if (data.won || data.lost) {
      setResult(data);
      setStage("result");
      refreshChar();
      onFinished(data);
      return true;
    }
    return false;
  };

  const startBattle = async () => {
    if (starting.current) return;
    starting.current = true;
    try {
      const data = await send("start", null);
      if (data.error) {
        notify(data.error, "error");
        return;
      }
      setBattle(data.battle);
      setLog([]);
      setResult(null);
      spriteAnim.triggerRunIn();
      autoStop.current = false;
      setStage("battle");
      setTimeout(() => autoLoop(data.battle), 900);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      starting.current = false;
    }
  };

  const autoLoop = async (state: any) => {
    if (autoStop.current || !state) return;
    const data = await send("auto", state);
    if (!data || data.error) {
      // Batalha expirada (ficou fora da página): recomeça do zero.
      if (data && data.code === "battle_expired") {
        autoStop.current = false;
        startBattle();
        return;
      }
      if (data && data.code === "no_mana") {
        const d2 = await send("attack", state);
        const ended = applyRound(d2);
        if (!ended && d2.battle) setTimeout(() => autoLoop(d2.battle), 1200);
        return;
      }
      return;
    }
    const ended = applyRound(data);
    if (!ended && data.battle) setTimeout(() => autoLoop(data.battle), 1200);
  };

  const stopFighting = () => {
    autoStop.current = true;
    setBattle(null);
    setLog([]);
    setResult(null);
    setRageFx(false);
    if (rageTimer.current) clearTimeout(rageTimer.current);
    setStage("arena");
    onExit();
  };

  const floatEls = (side: string) =>
    floats
      .filter((f) => f.target === side)
      .map((f) => (
        <span
          key={f.id}
          className={`damage-float ${f.crit ? "damage-float-crit" : ""}`}
          style={f.super ? { fontSize: "1.9rem", color: "#ef4444", textShadow: "0 0 18px rgba(239,68,68,0.95)" } : undefined}
        >
          {f.super ? "💢" : f.crit ? "💥" : ""}-{f.amount}
        </span>
      ));

  const hpPct = (cur: number, max: number) => Math.max(0, Math.min(100, max > 0 ? (cur / max) * 100 : 0));
  const fmtNum = (n: unknown): string => {
    const v = Number(n) || 0;
    if (!Number.isFinite(v)) return String(v);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
    return Math.floor(v).toString();
  };

  const statRows = [
    { key: "stat.attack", p: Number(character.attack) || 0, m: Math.round(battle?.monAttack ?? monster.stats.attack) },
    { key: "stat.defense", p: Number(character.defense) || 0, m: Math.round(battle?.monDefense ?? monster.stats.defense) },
    { key: "stat.speed", p: Number(character.speed) || 0, m: Math.round(battle?.monSpeed ?? monster.stats.speed) },
    { key: "stat.critical", p: `${Number(character.critical) || 0}%`, m: `${Math.round(battle?.monCritical ?? monster.stats.critical)}%` },
    { key: "stat.dodge", p: `${Number(character.dodge) || 0}%`, m: `${Math.round(battle?.monDodge ?? monster.stats.dodge)}%` },
  ];

  return (
    <div className="game-card relative overflow-hidden border-2 p-5 sm:p-6 bg-gradient-to-b from-gray-900/80 to-black/70" style={{ borderColor: `${accent}66` }}>
      {/* Prévia: monstro + stats + lutar */}
      {stage === "arena" && (
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: accent }}>{title}</div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <img
              src={monster.image}
              alt={t(monster.nameKey, locale)}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 animate-float"
              style={{ borderColor: `${accent}88`, boxShadow: `0 0 25px ${accent}55` }}
            />
            <div className="text-left text-xs text-gray-400">
              <div className="text-lg font-black text-white">{t(monster.nameKey, locale)}</div>
              <div>{t("map.bossHp", locale)}: <b className="text-white">{fmtNum(monster.stats.maxHp)}</b></div>
              <div>{t("map.bossAtk", locale)}: <b className="text-white">{fmtNum(monster.stats.attack)}</b></div>
              <div>{t("map.bossDef", locale)}: <b className="text-white">{fmtNum(monster.stats.defense)}</b></div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2.5">
            {statRows.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-3 py-1.5 text-xs font-bold text-gray-200">
                {t(s.key, locale)}: <span className="text-green-400">{s.p}</span>
              </span>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-3 flex-wrap">
            <button
              onClick={startBattle}
              className="px-8 py-3 rounded-xl font-bold text-lg transition-all border-2 hover:brightness-110"
              style={{ borderColor: accent, color: "#fff", background: `${accent}22` }}
            >
              {fightLabel}
            </button>
            <button onClick={stopFighting} className="px-5 py-3 rounded-xl font-bold text-sm border border-white/20 text-gray-300 hover:bg-white/10">
              {t("general.cancel", locale)}
            </button>
          </div>
        </div>
      )}

      {/* Batalha: barras de HP + log */}
      {stage === "battle" && battle && (
        <div className="relative">
          {/* Banner de RAGE (super ataque do chefe) */}
          {rageFx && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="animate-bounceIn text-center">
                <div className="text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.95)]">😡 RAGE!</div>
                <div className="mt-1 text-sm font-black uppercase tracking-widest text-red-400 animate-pulse-soft">Super Ataque</div>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
            <div>
              <div className="text-xl font-black" style={{ color: accent }}>{title}</div>
              <div className="text-xs text-gray-400">{t("tower.round", locale)} {battle.round || 0}</div>
            </div>
            <button onClick={stopFighting} className="text-xs text-red-400 border border-red-500/40 rounded-lg px-3 py-1 hover:bg-red-500/10">
              {t("tower.flee", locale)}
            </button>
          </div>

          <div className="flex items-start justify-between gap-2 relative">
            <div className="flex-1 text-center">
              <div className="relative inline-block">
                <div key={pShake}>
                  <div className={`relative w-24 h-24 sm:w-32 sm:h-32 ${spriteAnim.playerAnim || (pShake > 0 ? "animate-hit-shake" : "")}`}>
                    <img
                      src={playerImg}
                      alt={playerName}
                      className={`w-full h-full rounded-2xl border-2 border-[#4ecdc4]/60 object-cover shadow-[0_0_25px_rgba(78,205,196,0.35)] ${!spriteAnim.playerAnim && !pShake ? "animate-float" : ""}`}
                    />
                  </div>
                </div>
                {floatEls("player")}
              </div>
              <div className="mt-1 font-bold text-white text-sm truncate max-w-[130px] mx-auto">{playerName}</div>
              <div className="mt-1 mx-auto max-w-[160px]">
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${hpPct(battle.charHp, battle.charMaxHp)}%` }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{fmtNum(battle.charHp)}/{fmtNum(battle.charMaxHp)} {t("tower.hp", locale)}</div>
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${hpPct(battle.charMp, battle.charMaxMp)}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1 self-center text-center text-3xl sm:text-4xl font-black animate-pulse-soft pb-12" style={{ color: accent }}>VS</div>

            <div className="flex-1 text-center">
              <div className="relative inline-block">
                <div key={mShake}>
                  <div className={`relative w-24 h-24 sm:w-32 sm:h-32 ${spriteAnim.monsterAnim || (mShake > 0 ? "animate-hit-shake" : "")} ${battle.monRaged ? "animate-rage-pulse" : ""}`}>
                    <img
                      src={battle.monImage || monster.image}
                      alt={monsterName}
                      className={`w-full h-full rounded-2xl border-2 object-cover ${!spriteAnim.monsterAnim && !mShake ? "animate-floatSlow" : ""}`}
                      style={{
                        borderColor: battle.monRaged ? "#ef4444" : `${accent}aa`,
                        boxShadow: battle.monRaged ? "0 0 30px rgba(239,68,68,0.75)" : `0 0 25px ${accent}55`,
                      }}
                    />
                    {/* Arco de corte no alvo */}
                    {spriteAnim.showSlash && (
                      <span className={`slash-trail ${spriteAnim.slashCrit ? "slash-trail-crit" : ""}`} />
                    )}
                    {battle.monRaged && (
                      <span className="absolute -top-2 -right-2 text-xl animate-pulse-soft" title="RAGE!">😡</span>
                    )}
                  </div>
                </div>
                {floatEls("monster")}
              </div>
              <div className="mt-1 font-bold text-white text-sm truncate max-w-[130px] mx-auto">{monsterName}</div>
              <div className="mt-1 mx-auto max-w-[160px]">
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className="h-full transition-all duration-500" style={{ width: `${hpPct(battle.monHp, battle.monMaxHp)}%`, background: "linear-gradient(90deg,#f59e0b,#ef4444)" }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{fmtNum(battle.monHp)}/{fmtNum(battle.monMaxHp)} {t("tower.hp", locale)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-sm animate-pulse-soft" style={{ color: accent }}>⚡ {t("tower.fighting", locale)}</div>

          <div className="mt-3 bg-black/50 rounded-xl p-3 max-h-32 overflow-y-auto font-mono text-xs space-y-1 border border-white/5 min-h-[60px]">
            {log.length === 0 && <div className="text-gray-500 animate-pulse-soft">{t("tower.fighting", locale)}</div>}
            {log.map((l, i) => (
              <div key={i} className="py-0.5 px-2 rounded text-gray-300">{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* Resultado */}
      {stage === "result" && result && (
        <div className="text-center animate-scaleIn">
          <div className="text-7xl mb-3 animate-bounceIn">{result.won ? "🏆" : "💀"}</div>
          <h3 className={`text-3xl font-black mb-2 ${result.won ? "text-gold" : "text-hp-red"}`}>
            {result.won ? t("tower.youWin", locale) : result.rageKilled ? "🤡 HUMILHADO!" : t("tower.youLose", locale)}
          </h3>
          <p className="text-gray-300 mb-1">
            {result.rageKilled
              ? `${monsterName} fingiu ser fraco só para te humilhar no final... 😤💢`
              : monsterName}
          </p>
          {result.won && result.rewards && (
            <div className="my-4 flex justify-center flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 font-bold">🪙 {fmtNum(result.rewards.gold)}</span>
              <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/40 text-green-300 font-bold">⚡ {fmtNum(result.rewards.xp)} XP</span>
              {result.rewards.levelUp && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/40 text-blue-300 font-bold animate-glow-pulse">⬆️ Lv {result.rewards.newLevel}!</span>
              )}
            </div>
          )}
          {renderResult ? renderResult(result) : null}
          <div className="mt-5 flex justify-center gap-3 flex-wrap">
            <button onClick={stopFighting} className="px-6 py-3 rounded-xl font-bold text-sm border border-white/25 text-white/90 hover:bg-white/10">
              {t("general.close", locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
