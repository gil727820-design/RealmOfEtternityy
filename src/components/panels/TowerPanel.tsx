"use client";
import { useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import {
  classImage,
  towerBossForFloor,
  towerMonsterImage,
  type ClassName,
} from "@/game/constants";
import useBattleFx, { BattleFxLayer } from "@/components/ui/BattleFx";
import useSpriteAnim from "@/components/ui/useSpriteAnim";
import Confetti from "@/components/ui/Confetti";

// Cooldown (ms) entre andares no modo automático (anti-spam).
const AUTO_NEXT_COOLDOWN_MS = 4000;

export default function TowerPanel() {
  const { characterId, character, locale, notify, setCharacter, setTab, autoBattle, setAutoBattle } = useGameStore();
  const [stage, setStage] = useState<"arena" | "battle" | "result">("arena");
  const [battle, setBattle] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<Array<{ id: number; target: string; amount: number; crit: boolean }>>([]);
  const [pShake, setPShake] = useState(0);
  const [mShake, setMShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const fx = useBattleFx();
  const spriteAnim = useSpriteAnim();
  const autoStop = useRef(false);
  const floatId = useRef(0);
  // Guarda contra cliques duplicados no botão de lutar: sem isso, dois "start"
  // simultâneos criam duas batalhas concorrentes no MESMO andar e o andar acaba
  // avançando de 2 em 2 (a 2ª vitória lê o andar já incrementado pela 1ª).
  const starting = useRef(false);

  // Automático contínuo: cooldown entre andares + ref de controle (leitura segura no timeout)
  const [nextIn, setNextIn] = useState(0);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoActive = useRef(false);

  if (!character) return null;

  const floor = character.towerFloor as number;
  const towerCoins = character.towerCoins as number;
  const isBossFloor = floor % 10 === 0;
  const playerImg = classImage(character.classType as ClassName, character.sex as string);
  const playerName = (character.name as string) || t("tower.your", locale);

  // Ícones de atributos (mesmos usados no painel de status) para a torre
  const fIcons = {
    attack: "/images/attributes/attr_ataque.png",
    defense: "/images/attributes/attr_defesa.png",
    speed: "/images/attributes/attr_velocidade.png",
    critical: "/images/attributes/attr_critico.png",
    dodge: "/images/attributes/attr_esquiva.png",
  };
  const fStats = {
    attack: Number(character.attack) || 0,
    defense: Number(character.defense) || 0,
    speed: Number(character.speed) || 0,
    critical: Number(character.critical) || 0,
    dodge: Number(character.dodge) || 0,
  };
  const compareRows = (b: any) => [
    { key: "stat.attack", icon: fIcons.attack, p: fStats.attack, m: Math.round(b.monAttack) },
    { key: "stat.defense", icon: fIcons.defense, p: fStats.defense, m: Math.round(b.monDefense) },
    { key: "stat.speed", icon: fIcons.speed, p: fStats.speed, m: Math.round(b.monSpeed) },
    { key: "stat.critical", icon: fIcons.critical, p: `${fStats.critical}%`, m: `${Math.round(b.monCritical)}%` },
    { key: "stat.dodge", icon: fIcons.dodge, p: `${fStats.dodge}%`, m: `${Math.round(b.monDodge)}%` },
  ];

  const sendAction = async (action: string, state: any, auto?: any) => {
    const res = await fetch("/api/tower/fight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, action, state, auto }),
    });
    return res.json();
  };

  // Envia uma rodada do AUTO BATTLE: o servidor decide a ação pelo modo.
  const sendAuto = (state: any) => sendAction("auto", state, autoBattle);

  const refreshChar = async () => {
    try {
      const r = await fetch(`/api/character/${characterId}`);
      const d = await r.json();
      if (d.character) setCharacter(d.character);
    } catch {
      /* ignora */
    }
  };

  // Aplica uma rodada retornada pelo servidor: atualiza HP (da), log e efeitos visuais
  const applyRound = (data: any) => {
    if (!data || !data.battle) return false;
    setBattle(data.battle);
    if (data.log?.length) setLog((prev) => [...prev, ...data.log]);

    // Efeitos visuais: partículas, anel de impacto, debuffs e curas.
    fx.applyRound(data, { player: "player", enemy: "monster" });

    // Animações de sprite (investida, recuo, esquiva, fúria, morte...).
    spriteAnim.processEvents(data.events, !!data.won, !!data.lost);

    (data.events || []).forEach((ev: any) => {
      if (ev.amount && (ev.type === "hit" || ev.type === "crit" || ev.type === "skill")) {
        const id = ++floatId.current;
        setFloats((f) => [...f, { id, target: ev.target, amount: ev.amount, crit: ev.type === "crit" }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
      }
      if (ev.target === "monster" && ev.type !== "dodge") setMShake((x) => x + 1);
      if (ev.target === "player" && ev.type !== "dodge") setPShake((x) => x + 1);
      if (ev.type === "crit" || ev.type === "skill") setFlash((x) => x + 1);
    });

    if (data.won || data.lost) {
      setResult(data);
      setStage("result");
      refreshChar();
      if (data.won && autoActive.current) {
        // Automático venceu → cooldown e segue SOZINHO para o próximo andar.
        scheduleAutoNext();
      } else if (data.lost) {
        // Automático perdeu → para aqui (fica no andar atual, sem reset).
        cancelAutoNext();
        autoActive.current = false;
      }
      return true;
    }
    return false;
  };

  const startBattle = async () => {
    if (starting.current) return; // ignora chamadas duplicadas enquanto inicia
    starting.current = true;
    cancelAutoNext();
    setBusy(true);
    try {
      const data = await sendAction("start", null);
      if (data.error) {
        notify(data.error, "error");
        return;
      }
      setBattle(data.battle);
            setLog([]);
            setResult(null);
            fx.clear();
            spriteAnim.triggerRunIn();
            autoActive.current = true;
      setStage("battle");
      autoStop.current = false;
      setTimeout(() => autoLoop(data.battle), 900);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };

  // Luta automática: o servidor decide a ação pelo modo escolhido
  const autoLoop = async (state: any) => {
    if (autoStop.current || !state) return;
    const data = await sendAuto(state);
    if (!data || data.error) {
      // Batalha expirada (ficou fora da página / parado demais): recomeça do
      // zero no andar atual — não dá mais pra "abandonar e continuar no auto".
      if (data && data.code === "battle_expired") {
        autoStop.current = false;
        startBattle();
        return;
      }
      if (data && data.code === "no_mana") {
        // Modo manual sem mana não acontece no auto (servidor decide), mas
        // mantém o fallback por segurança.
        const d2 = await sendAction("attack", state);
        const ended = applyRound(d2);
        if (!ended && d2.battle) setTimeout(() => autoLoop(d2.battle), 1200);
      }
      return;
    }
    const ended = applyRound(data);
    if (!ended && data.battle) setTimeout(() => autoLoop(data.battle), 1200);
  };

  const cancelAutoNext = () => {
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }
    if (nextTick.current) { clearInterval(nextTick.current); nextTick.current = null; }
    setNextIn(0);
  };

  // Automático: após vencer, aguarda o cooldown e JÁ inicia o próximo andar sozinho.
  const scheduleAutoNext = () => {
    cancelAutoNext();
    if (!autoActive.current) return;
    setNextIn(Math.ceil(AUTO_NEXT_COOLDOWN_MS / 1000));
    // eslint-disable-next-line react-hooks/purity -- timer de jogo (evento assíncrono)
    const started = Date.now();
    nextTick.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((AUTO_NEXT_COOLDOWN_MS - (Date.now() - started)) / 1000));
      setNextIn(left);
    }, 200);
    nextTimer.current = setTimeout(() => {
      if (nextTick.current) { clearInterval(nextTick.current); nextTick.current = null; }
      setNextIn(0);
      if (autoActive.current) startBattle();
    }, AUTO_NEXT_COOLDOWN_MS);
  };

  const stopFighting = () => {
    autoStop.current = true;
    cancelAutoNext();
    autoActive.current = false;
    setBattle(null);
    setLog([]);
    setResult(null);
    fx.clear();
    setStage("arena");
  };

  // Formata números grandes (XP/recompensas em níveis altos viram 1e+73):
  // mostra "12,4M" / "850K" em vez de notação científica quebrada.
  const fmtNum = (n: unknown): string => {
    const v = Number(n) || 0;
    if (!Number.isFinite(v)) return String(v);
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v >= 10_000_000_000 ? 0 : 1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
    return Math.floor(v).toString();
  };

  const goNext = () => {
    // Re-ataca SEMPRE (vitória após o cooldown automático ou derrota clicando
    // em "Atacar novamente"). ANTES, após uma DERROTA o botão levava de volta
    // pra arena em vez de iniciar outra batalha — parecia que a torre
    // "parava de batalhar" depois da primeira luta.
    cancelAutoNext();
    startBattle();
  };

  const monsterName = battle ? t(battle.monNameKey, locale) : "";
  const floatEls = (side: string) =>
    floats
      .filter((f) => f.target === side)
      .map((f) => (
        <span key={f.id} className={`damage-float ${f.crit ? "damage-float-crit" : ""}`}>
          {f.crit ? "💥" : ""}-{f.amount}
        </span>
      ));

  const hpPct = (cur: number, max: number) =>
    Math.max(0, Math.min(100, max > 0 ? (cur / max) * 100 : 0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <img src="/images/sidebar/menu_torre.png" alt={t("tower.title", locale)} className="w-10 h-10 object-contain" /> {t("tower.title", locale)}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTab("ghostshop")}
            className="flex items-center gap-2 rounded-xl px-4 py-2 border border-[#7c5cfc]/50 bg-[#7c5cfc]/10 text-purple-200 hover:bg-[#7c5cfc]/20 hover:text-white transition-colors text-sm font-bold cursor-pointer"
          >
            👻 {t("nav.ghostShop", locale)}
          </button>
          <div className="group relative">
            <div className="text-sm bg-purple-900/50 px-3 py-1 rounded-full border border-purple-500 cursor-help">
              {t("tower.coins", locale)}: {towerCoins} 🪙
            </div>
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a2e] border border-purple-500/50 rounded-xl p-3 text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
              <div className="font-bold text-purple-300 mb-1">🪙 Moedas da Torre</div>
              <p className="text-gray-400 text-[10px] mb-2">Ganhas a cada andar conquistado na torre.</p>
              <div className="text-[10px] text-gray-500">
                <div>• Mob comum: 6 + (andar/10)</div>
                <div>• Boss: 40 + (andar/8)</div>
              </div>
              <div className="text-[10px] text-purple-400 mt-1">🛍️ Use na Loja Fantasma!</div>
            </div>
          </div>
        </div>
      </div>

      {stage === "arena" && (
        <div className="game-card p-8 text-center relative overflow-hidden bg-gradient-to-b from-gray-900/80 to-black/70 border-purple-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          <div className="relative">
            <img
              src="/images/tower/torre_infinita.png"
              alt={t("tower.title", locale)}
              className="w-40 h-40 mx-auto mb-3 object-contain animate-float drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]"
            />
            <div className="text-5xl font-black mb-1 animate-glow">
              <span className={`bg-clip-text text-transparent bg-gradient-to-r ${isBossFloor ? "from-yellow-300 to-yellow-600" : "from-white to-gray-400"}`}>
                {t("tower.floor", locale)} {floor}
              </span>
            </div>
            <p className="text-gray-400 mb-3">
              {isBossFloor && <span className="text-yellow-400 font-bold">⚠️ {t("tower.bossFloor", locale)}</span>}
            </p>
            {isBossFloor && (
              <div className="flex items-center justify-center gap-3 mb-4 bg-yellow-500/5 border border-yellow-500/30 rounded-xl px-4 py-3 max-w-sm mx-auto">
                <img
                  src={towerMonsterImage(towerBossForFloor(floor))}
                  alt={t(`monster.${towerBossForFloor(floor)}`, locale)}
                  className="w-16 h-16 rounded-xl border border-yellow-500/50 object-cover shadow-[0_0_20px_rgba(234,179,8,0.4)]"
                />
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-yellow-400 font-bold">{t("tower.bossFloor", locale)}</div>
                  <div className="font-black text-white">{t(`monster.${towerBossForFloor(floor)}`, locale)}</div>
                </div>
              </div>
            )}
            {/* Configurações do Auto Battle: modo, auto-skill e auto-poção */}
            <div className="mt-5 mx-auto max-w-md rounded-2xl border border-purple-700/40 bg-black/40 p-4 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-black uppercase tracking-widest text-purple-300">⚙️ {t("tower.autoSettings", locale)}</div>
                <div className="text-[10px] text-gray-500">{t("tower.autoSettingsHint", locale)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(["aggressive", "balanced", "defensive"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAutoBattle({ mode: m })}
                    className={`rounded-xl px-2 py-2 text-xs font-bold border transition-all cursor-pointer ${
                      autoBattle.mode === m
                        ? "border-purple-400 bg-purple-500/30 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {m === "aggressive" ? "🗡️" : m === "balanced" ? "⚖️" : "🛡️"}{" "}
                    {t(`tower.mode.${m}`, locale)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-3 text-xs text-gray-300 cursor-pointer">
                  <span>💥 {t("tower.autoSkill", locale)}</span>
                  <input
                    type="checkbox"
                    checked={autoBattle.useSkill}
                    onChange={(e) => setAutoBattle({ useSkill: e.target.checked })}
                    className="accent-purple-500 w-4 h-4 cursor-pointer"
                  />
                </label>
                <div className="text-[10px] text-gray-600 text-center italic">🧪 Poções automáticas em breve — ainda não disponíveis no jogo.</div>
              </div>
            </div>
            <div className="flex justify-center gap-3 flex-wrap mt-4">
              <button
                onClick={startBattle}
                disabled={busy}
                className={`bg-transparent text-lg font-bold px-6 py-4 rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {t("tower.fightAuto", locale)}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {compareRows({ monAttack: 0, monDefense: 0, monSpeed: 0, monCritical: 0, monDodge: 0 }).map((s) => (
                <span
                  key={s.key}
                  title={t(s.key, locale)}
                  className="flex items-center gap-1.5 bg-black/50 border border-purple-700/40 rounded-full px-3 py-1.5 text-xs font-bold text-purple-100"
                >
                  <img src={s.icon} alt={t(s.key, locale)} className="w-[18px] h-[18px] object-contain" />
                  {t(s.key, locale)}: <span className="text-green-400">{s.p}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === "battle" && battle && (
        <div className="game-card relative overflow-hidden border-purple-800 bg-gradient-to-b from-gray-900/80 to-black/70 p-4 sm:p-6">
          {flash > 0 && <div key={flash} className="absolute inset-0 pointer-events-none z-20 battle-flash" />}
          <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
            <div>
              <div className="text-xl font-black flex items-center gap-2">
                <img src="/images/tower/torre_infinita.png" className="w-7 h-7 object-contain" alt="" />
                {t("tower.floor", locale)} {floor}
                {battle.boss && (
                  <span className="text-[10px] bg-yellow-600/30 text-yellow-300 border border-yellow-500 rounded-full px-2 py-0.5 animate-pulse-soft">
                    {t("tower.bossFloor", locale)}
                  </span>
                )}
                {!!battle.scaled && (
                  <span className="text-[10px] bg-red-600/30 text-red-300 border border-red-500 rounded-full px-2 py-0.5 animate-pulse-soft">
                    🔥 {t("tower.scaledBoss", locale)}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">{t("tower.round", locale)} {battle.round || 0}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-300 animate-pulse-soft">⚡ {t("tower.auto", locale)}</span>
              <button onClick={stopFighting} className="text-xs text-red-400 border border-red-500/40 rounded-lg px-3 py-1 hover:bg-red-500/10">
                {t("tower.flee", locale)}
              </button>
            </div>
          </div>

          {/* Lutadores */}
          <div className="flex items-start justify-between gap-2 relative">
            <div className="flex-1 text-center">
                          <div className="relative inline-block">
                            <div key={pShake}>
                              <div className={`relative w-28 h-28 sm:w-36 sm:h-36 ${spriteAnim.playerAnim || (pShake > 0 ? "animate-hit-shake" : "")}`}>
                                <img
                                  src={playerImg}
                                  alt={playerName}
                                  className={`w-full h-full rounded-2xl border-2 border-[#4ecdc4]/60 object-cover shadow-[0_0_25px_rgba(78,205,196,0.35)] ${!spriteAnim.playerAnim && !pShake ? "animate-float" : ""}`}
                                />
                              </div>
                            </div>
                            {floatEls("player")}
                            <BattleFxLayer fx={fx} target="player" />
                          </div>
              <div className="mt-2 font-bold text-white tracking-wider truncate max-w-[140px] mx-auto">{playerName}</div>
              <div className="mt-1 mx-auto max-w-[170px]">
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${hpPct(battle.charHp, battle.charMaxHp)}%` }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{battle.charHp}/{battle.charMaxHp} {t("tower.hp", locale)}</div>
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${hpPct(battle.charMp, battle.charMaxMp)}%` }} />
                </div>
                <div className="text-[10px] text-gray-400">{battle.charMp}/{battle.charMaxMp} {t("tower.mp", locale)}</div>
              </div>
            </div>

            <div className="flex-1 self-center text-center text-3xl sm:text-4xl font-black text-purple-400 animate-pulse-soft pb-14">VS</div>

            <div className="flex-1 text-center">
              <div className="relative inline-block">
                <div key={mShake}>
                  <div className={`relative w-28 h-28 sm:w-36 sm:h-36 ${spriteAnim.monsterAnim || (mShake > 0 ? "animate-hit-shake" : "")}`}>
                    <img
                      src={battle.monImage}
                      alt={monsterName}
                      className={`w-full h-full rounded-2xl border-2 object-cover ${
                        battle.boss
                          ? "border-yellow-500/70 shadow-[0_0_25px_rgba(234,179,8,0.4)]"
                          : "border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]"
                      } ${!spriteAnim.monsterAnim && !mShake ? "animate-floatSlow" : ""}`}
                    />
                    {/* Arco de corte no alvo */}
                    {spriteAnim.showSlash && (
                      <span className={`slash-trail ${spriteAnim.slashCrit ? "slash-trail-crit" : ""}`} />
                    )}
                  </div>
                </div>
                {floatEls("monster")}
                <BattleFxLayer fx={fx} target="enemy" />
              </div>
              <div className="mt-2 font-bold text-white tracking-wider truncate max-w-[140px] mx-auto">{monsterName}</div>
              <div className="mt-1 mx-auto max-w-[170px]">
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                  <div className={`h-full transition-all duration-500 ${battle.boss ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-red-500 to-red-400"}`} style={{ width: `${hpPct(battle.monHp, battle.monMaxHp)}%` }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{battle.monHp}/{battle.monMaxHp} {t("tower.hp", locale)}</div>
              </div>
            </div>
          </div>

          {/* Comparativo de atributos (jogador vs monstro) */}
          <div className="mt-4 mx-auto max-w-2xl grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 items-center border border-white/10 rounded-xl bg-black/40 p-3">
            <div className="text-center text-[11px] font-black uppercase tracking-widest text-green-400 pb-1">{playerName}</div>
            <div className="text-center text-[11px] font-black text-purple-400 pb-1">VS</div>
            <div className="text-center text-[11px] font-black uppercase tracking-widest text-red-400 pb-1">{monsterName}</div>
            {compareRows(battle).map((row) => (
              <div key={row.key} className="contents">
                <div className="flex items-center justify-end gap-1">
                  <span className={`text-sm font-black ${row.m > row.p ? "text-gray-400" : "text-green-400"}`}>{row.p}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-300 font-semibold">
                  <img src={row.icon} alt={t(row.key, locale)} className="w-4 h-4 object-contain" />
                  {t(row.key, locale)}
                </div>
                <div className="flex items-center justify-start gap-1">
                  <span className={`text-sm font-black ${row.m > row.p ? "text-red-400" : "text-gray-400"}`}>{row.m}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Status do combate automático */}
          <div className="mt-4 text-center text-sm text-purple-300 animate-pulse-soft">⚡ {t("tower.fighting", locale)}</div>

          {/* Log da batalha */}
          <div className="mt-4 bg-black/50 rounded-xl p-3 max-h-32 overflow-y-auto font-mono text-xs space-y-1 border border-white/5 min-h-[72px]">
            {log.length === 0 && <div className="text-gray-500 animate-pulse-soft">{t("tower.fighting", locale)}</div>}
            {log.map((l, i) => (
              <div
                key={i}
                className={`py-0.5 px-2 rounded ${
                  l.includes("💥") || l.includes("CRÍTICO")
                    ? "text-gold font-bold"
                    : l.toLowerCase().includes("esquiv")
                    ? "text-gray-500"
                    : l.includes("defesa") || l.includes("Desvia")
                    ? "text-teal-300"
                    : l.includes("Você") || l.includes("você")
                    ? "text-mana-blue"
                    : "text-gray-300"
                }`}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <div className="game-card p-8 text-center animate-scaleIn relative overflow-hidden">
          {result.won && <Confetti />}
          <div className="text-7xl mb-3 animate-bounceIn">{result.won ? "🏆" : "💀"}</div>
          <h3 className={`text-4xl font-black mb-2 ${result.won ? "text-gold" : "text-hp-red"}`}>
            {result.won ? t("tower.youWin", locale) : t("tower.youLose", locale)}
          </h3>
          <p className="text-gray-300 mb-1">
            {monsterName} — {t("tower.floor", locale)} {result.floor}
          </p>
          {result.won && result.rewards && (
            <div className="my-4 flex justify-center flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 font-bold">🪙 {fmtNum(result.rewards.gold)}</span>
              <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/40 text-green-300 font-bold">⚡ {fmtNum(result.rewards.xp)} XP</span>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/40 text-purple-300 font-bold">🪙 {fmtNum(result.rewards.coins)} {t("tower.coins", locale)}</span>
              {result.rewards.levelUp && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/40 text-blue-300 font-bold animate-glow-pulse">
                  ⬆️ Lv {result.rewards.newLevel}!
                </span>
              )}
              {result.rewards.bossEnchant && (
                <span className="px-3 py-1 rounded-full bg-red-600/20 border border-red-500/60 text-red-300 font-bold animate-glow-pulse">
                  {result.rewards.bossEnchant.icon} Encanto de Chefe: {result.rewards.bossEnchant.stat === "attack" ? "⚔️ Ataque" : result.rewards.bossEnchant.stat === "defense" ? "🛡️ Defesa" : result.rewards.bossEnchant.stat === "maxHp" ? "❤️ Vida" : result.rewards.bossEnchant.stat === "speed" ? "👟 Velocidade" : "💥 Crítico"} +{result.rewards.bossEnchant.amount} na sua arma!
                </span>
              )}
            </div>
          )}
          {!result.won && <p className="text-gray-400 mb-2">{t("tower.dontGiveUp", locale)}</p>}
          <div className="mt-5 flex justify-center items-center gap-3 flex-wrap">
            {result.won ? (
              <div className="px-8 py-3 rounded-xl font-bold text-lg border border-purple-500/40 bg-purple-500/10 text-purple-200 animate-pulse-soft">
                ⏳ {t("tower.nextFloor", locale)} → {result.rewards?.newFloor} {t("tower.inSeconds", locale)} {nextIn}s…
              </div>
            ) : (
              <button onClick={goNext} className="bg-transparent px-8 py-3 rounded-xl font-bold text-lg border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 transition-all">
                🔄 {t("tower.attackBtn", locale)}
              </button>
            )}
            <button
              onClick={stopFighting}
              className="bg-transparent px-8 py-3 rounded-xl font-bold text-lg border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 transition-all"
            >
              🏰 {t("tower.backTower", locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
