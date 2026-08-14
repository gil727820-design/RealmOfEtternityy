"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import {
  PVP_LEAGUES,
  classImage,
  classSkillName,
  type ClassName,
} from "@/game/constants";
import { computePvpDaily, PVP_DAILY_MAX } from "@/game/pvp";
import useBattleFx, { BattleFxLayer } from "@/components/ui/BattleFx";
import Confetti from "@/components/ui/Confetti";

export default function PvPPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [bots, setBots] = useState<Array<any>>([]);
  const [players, setPlayers] = useState<Array<any>>([]);
  const [tab, setTab] = useState<"bots" | "players">("bots");
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<"league" | "battle" | "result">("league");
  const [mode, setMode] = useState<"auto" | "turn" | null>(null);
  const [showLeagues, setShowLeagues] = useState(false);
  const [enemy, setEnemy] = useState<any>(null);
  const [battle, setBattle] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<Array<{ id: number; target: string; amount: number; crit: boolean }>>([]);
  const [pShake, setPShake] = useState(0);
  const [eShake, setEShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const [history, setHistory] = useState<Array<any>>([]);
  const fx = useBattleFx();
  const autoStop = useRef(false);
  const floatId = useRef(0);

  const getLeagueData = (rating: number) => {
    let league: (typeof PVP_LEAGUES)[number] = PVP_LEAGUES[0];
    for (const l of PVP_LEAGUES) {
      if (rating >= l.minRating) league = l;
    }
    return league;
  };

  const loadOpponents = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pvp/fight?characterId=${characterId}`);
      const data = await res.json();
      setBots(data.bots ?? []);
      setPlayers(data.players ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [characterId]);

  const loadHistory = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/pvp/history?characterId=${characterId}&limit=20`);
      const data = await res.json();
      setHistory(data.battles ?? []);
    } catch (e) {
      console.error(e);
    }
  }, [characterId]);

  useEffect(() => {
    loadOpponents();
    loadHistory();
  }, [loadOpponents, loadHistory]);

  if (!character) return null;

  const currentRating = Number(character.pvpRating) || 0;
  const league = getLeagueData(currentRating);

  // Limite diário de batalhas na Arena (zera sozinho a cada dia).
  const pvpDaily = computePvpDaily(character);

  const playerImg = classImage(character.classType as ClassName, character.sex as string);
  const playerName = (character.name as string) || "Você";
  const enemyImg = enemy
    ? classImage((enemy.classType as ClassName) || "warrior", (enemy.sex as string) || "male")
    : undefined;
  const enemyName = enemy ? String(enemy.name) : "Oponente";
  const mySkill = classSkillName(character.classType as ClassName, locale);
  const enemySkill = enemy ? classSkillName((enemy.classType as ClassName) || "warrior", locale) : "";

  const myStats = {
    attack: Number(character.attack) || 0,
    defense: Number(character.defense) || 0,
    speed: Number(character.speed) || 0,
    critical: Number(character.critical) || 0,
    dodge: Number(character.dodge) || 0,
  };
  const fIcons = {
    attack: "/images/attributes/attr_ataque.png",
    defense: "/images/attributes/attr_defesa.png",
    speed: "/images/attributes/attr_velocidade.png",
    critical: "/images/attributes/attr_critico.png",
    dodge: "/images/attributes/attr_esquiva.png",
  };
  const pvpPct = (cur: number, max: number) =>
    Math.max(0, Math.min(100, max > 0 ? (cur / max) * 100 : 0));

  // Botão "fantasma" transparente com borda — mesmo estilo da Torre Infinita
  const ghostBtn =
    "bg-transparent font-bold rounded-xl transition-all border border-white/25 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed";

  const sendAction = async (action: string, state: any, opp: any) => {
    if (!opp) return null;
    const res = await fetch("/api/pvp/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, action, state, defender: opp }),
    });
    return res.json();
  };

  const refreshCharacter = async () => {
    try {
      const r = await fetch(`/api/character/${characterId}`);
      const d = await r.json();
      if (d.character) setCharacter(d.character);
    } catch {
      /* ignora */
    }
  };

  const applyRound = (data: any) => {
    if (!data || !data.battle) return false;
    setBattle(data.battle);
    if (data.log?.length) setLog((prev) => [...prev, ...data.log]);

    // Efeitos visuais: partículas, anel de impacto, debuffs e curas.
    fx.applyRound(data, { player: "player", enemy: "enemy" });

    (data.events || []).forEach((ev: any) => {
      if (ev.amount && (ev.type === "hit" || ev.type === "crit" || ev.type === "skill")) {
        const id = ++floatId.current;
        setFloats((f) => [...f, { id, target: ev.target, amount: ev.amount, crit: ev.type === "crit" || ev.type === "skill" }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
      }
      if (ev.target === "player") setPShake((x) => x + 1);
      if (ev.target === "enemy") setEShake((x) => x + 1);
      if (ev.type === "crit" || ev.type === "skill") setFlash((x) => x + 1);
    });

    if (data.won || data.lost) {
      setResult(data);
      setPhase("result");
      loadHistory();
      if (data.won) {
        if (data.attacker) setCharacter(data.attacker);
        else refreshCharacter();
        loadOpponents();
      }
      return true;
    }
    return false;
  };

  const beginBattle = async (opp: any, m: "auto" | "turn") => {
    setEnemy(opp);
    setBattle(null);
    setLog([]);
    setFloats([]);
    fx.clear();
    setResult(null);
    setMode(m);
    setPhase("battle");
    setBusy(true);
    try {
      const data = await sendAction("start", null, opp);
      if (!data || data.error) {
        notify(data.code === "pvp_daily_limit" ? t("pvp.capNotice", locale) : data.error || "Erro", "error");
        setPhase("league");
        setBusy(false);
        return;
      }
      setBattle(data.battle);
      if (m === "auto") {
        autoStop.current = false;
        setTimeout(() => autoLoop(data.battle, opp), 600);
      }
    } catch {
      notify("Erro de conexão", "error");
      setPhase("league");
    }
    setBusy(false);
  };

  const autoLoop = async (state: any, opp: any) => {
    if (autoStop.current || !state) return;
    const useSkill = state.charMp >= 15 && Math.random() < 0.45;
    const act = useSkill ? "skill" : "attack";
    const data = await sendAction(act, state, opp);
    if (!data) return;
    if (data.error) {
      if (data.code === "no_mana") {
        const d2 = await sendAction("attack", state, opp);
        const ended = applyRound(d2);
        if (!ended && d2.battle) setTimeout(() => autoLoop(d2.battle, opp), 800);
      }
      return;
    }
    const ended = applyRound(data);
    if (!ended && data.battle) setTimeout(() => autoLoop(data.battle, opp), 800);
  };

  const turnAction = async (act: "attack" | "skill" | "defend") => {
    if (busy || !battle || !enemy) return;
    setBusy(true);
    try {
      const data = await sendAction(act, battle, enemy);
      if (!data) return;
      if (data.error) {
        notify(data.error, "error");
        return;
      }
      applyRound(data);
    } catch {
      notify(t("map.connectionError", locale), "error");
    } finally {
      setBusy(false);
    }
  };

  const takeControlMap = () => {
    autoStop.current = true;
    setMode("turn");
  };

  const backToLeague = () => {
    autoStop.current = true;
    setBattle(null);
    setLog([]);
    setResult(null);
    setMode(null);
    setEnemy(null);
    setFloats([]);
    fx.clear();
    setPhase("league");
  };

  const rematch = () => {
    if (enemy) beginBattle(enemy, mode || "auto");
  };

  const floatEls = (side: string) =>
    floats
      .filter((f) => f.target === side)
      .map((f) => (
        <span key={f.id} className={`damage-float ${f.crit ? "damage-float-crit" : ""}`}>
          {f.crit ? "💥" : ""}-{f.amount}
        </span>
      ));

  const compareRows = battle
    ? [
        { key: "stat.attack", icon: fIcons.attack, p: myStats.attack, m: Math.round(battle.oppAttack) },
        { key: "stat.defense", icon: fIcons.defense, p: myStats.defense, m: Math.round(battle.oppDefense) },
        { key: "stat.speed", icon: fIcons.speed, p: myStats.speed, m: Math.round(battle.oppSpeed) },
        { key: "stat.critical", icon: fIcons.critical, p: myStats.critical, m: Math.round(battle.oppCritical) },
        { key: "stat.dodge", icon: fIcons.dodge, p: myStats.dodge, m: Math.round(battle.oppDodge) },
      ]
    : [];

  const renderOpp = (opp: any) => (
    <div key={opp.id} className="game-card p-4 flex justify-between items-center gap-3">
      <div className="flex items-center gap-3">
        <img
          src={classImage((opp.classType as ClassName) || "warrior", (opp.sex as string) || "male")}
          alt={opp.name}
          className="w-12 h-12 rounded-lg border border-white/10 object-cover"
        />
        <div>
          <div className="font-bold">
            {opp.name}{" "}
            {opp.isBot ? (
              <span className="text-[9px] bg-gray-700 text-gray-300 rounded px-1">BOT</span>
            ) : (
              <span className="text-[9px] bg-cyan-900/60 text-cyan-300 rounded px-1">👤 {t("pvp.player", locale)}</span>
            )}
          </div>
          <div className="text-sm text-gray-400">Lv {opp.level} | Power: {opp.power}</div>
          <div className="text-xs text-purple-300">✨ {classSkillName((opp.classType as ClassName) || "warrior", locale)}</div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-bold text-yellow-500 flex items-center gap-1">
          <img src="/images/icons/icone_rating.png" alt="rating" className="w-4 h-4 object-contain" />
          {opp.pvpRating} {t("pvp.rating", locale)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => beginBattle(opp, "auto")}
            disabled={busy}
            className={`${ghostBtn} px-3 py-1 text-xs`}
            title={t("pvp.fightAuto", locale)}
          >
            {t("pvp.auto", locale)}
          </button>
          <button
            onClick={() => beginBattle(opp, "turn")}
            disabled={busy}
            className={`${ghostBtn} px-3 py-1 text-xs`}
            title={t("pvp.fightTurn", locale)}
          >
            {t("pvp.turn", locale)}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      <header className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <img src="/images/sidebar/menu_arena.png" alt={t("pvp.title", locale)} className="w-10 h-10 object-contain" />
          <h2 className="text-3xl font-black">{t("pvp.title", locale)}</h2>
        </div>
        <span className="text-sm bg-amber-900/40 px-3 py-1 rounded-full border border-amber-500/50 font-bold text-amber-300">
          <img src={league.image} alt={league.id} className="w-5 h-5 object-contain inline-block align-[-2px] mr-1" />
          <img src="/images/icons/icone_rating.png" alt="rating" className="w-4 h-4 object-contain inline-block align-[-1px] mr-1" />
          {currentRating} {t("pvp.rating", locale)} · 🪙 {Number(character.pvpCoins) || 0}
        </span>
      <span className="text-sm bg-purple-900/40 px-3 py-1 rounded-full border border-purple-500/50 font-bold text-purple-300">
          ⚔️ {pvpDaily.used}/{PVP_DAILY_MAX} ·{" "}
          <span className={pvpDaily.dailyLeft > 0 ? "text-[#00ff88]" : "text-red-400"}>{pvpDaily.dailyLeft}</span>{" "}
          {t("pvp.remaining", locale)}
        </span>
      </header>

      {phase === "league" && (
        <>
          {/* Card da Liga */}
          <div className="game-card game-card-accent p-6 flex flex-col items-center gap-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/12 via-transparent to-transparent pointer-events-none" />
            <img src={league.image} alt={league.id} className="w-28 h-28 object-contain drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
            <h3 className="text-2xl font-bold z-10">{t(`league.${league.id}`, locale)}</h3>
            <div className="text-4xl font-black text-amber-400 glow-text z-10">{currentRating}</div>
            <div className="w-full bg-white/10 h-2 rounded-full mt-2 z-10 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: "50%" }}></div>
            </div>
            <button onClick={() => setShowLeagues(true)} className="game-btn-purple text-xs font-bold px-3 py-1.5 rounded-lg mt-1 z-10">
              {t("pvp.allLeagues", locale)}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Oponentes */}
            {/* Oponentes — abas: Bots | Players */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">🎯 {t("pvp.opponents", locale)}</h3>
                <button
                  onClick={() => {
                    setTab("bots");
                    loadOpponents();
                  }}
                  className={`${ghostBtn} inline-flex items-center justify-center px-3 py-1.5 text-sm`}
                  title={t("pvp.fightAuto", locale)}
                >
                  🔄
                </button>
              </div>

              {/* Abas: Bots | Players */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTab("bots")}
                  className={`${ghostBtn} flex-1 px-3 py-1.5 text-sm ${tab === "bots" ? "border-purple-400 text-purple-300 bg-purple-500/10" : ""}`}
                >
                  🤖 {t("pvp.bots", locale)} <span className="text-[10px] text-gray-400">({bots.length})</span>
                </button>
                <button
                  onClick={() => setTab("players")}
                  className={`${ghostBtn} flex-1 px-3 py-1.5 text-sm ${tab === "players" ? "border-purple-400 text-purple-300 bg-purple-500/10" : ""}`}
                >
                  👥 {t("pvp.players", locale)} <span className="text-[10px] text-gray-400">({players.length})</span>
                </button>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="text-gray-500 animate-pulse-soft">{t("pvp.noOpponents", locale)}</div>
                ) : tab === "bots" ? (
                  bots.length === 0 ? (
                    <div className="game-card p-3 text-sm text-gray-500">{t("pvp.noOpponents", locale)}</div>
                  ) : (
                    bots.map(renderOpp)
                  )
                ) : players.length === 0 ? (
                  <div className="game-card p-3 text-sm text-gray-500">{t("pvp.noPlayers", locale)}</div>
                ) : (
                  players.map(renderOpp)
                )}
              </div>
            </section>

            {/* Histórico */}
            <section>
              <h3 className="text-xl font-bold mb-4">📜 {t("pvp.history", locale)}</h3>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="game-card p-3 text-sm text-gray-500">{t("pvp.noHistory", locale)}</div>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.id}
                      className={`game-card p-3 border-l-4 flex justify-between items-center gap-2 ${h.won ? "border-green-500" : "border-red-500"}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{h.won ? "✅" : "❌"}</span>
                        <span className="font-bold truncate">{h.opponentName}</span>
                        {h.isBot && <span className="text-[9px] bg-gray-700 text-gray-300 rounded px-1 shrink-0">BOT</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-bold ${h.ratingChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {h.ratingChange >= 0 ? `+${h.ratingChange}` : h.ratingChange}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          {new Date(h.foughtAt).toLocaleString(locale === "pt-BR" ? "pt-BR" : "en-US")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {phase === "battle" && battle && (
        <div className="game-card relative overflow-hidden border-teal-800 bg-gradient-to-b from-gray-900/80 to-black/70 p-4 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent pointer-events-none" />
          {flash > 0 && <div key={flash} className="absolute inset-0 pointer-events-none z-20 battle-flash" />}
          <div className="relative z-10">
            {/* Topo */}
            <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
              <div>
                <div className="text-xl font-black flex items-center gap-2">
                  ⚔️ {enemyName}
                  <span className="text-[10px] bg-red-600/30 text-red-300 border border-red-500 rounded-full px-2 py-0.5">
                    {enemy?.isBot ? "BOT" : "Jogador"}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {t("pvp.round", locale)} {battle.round || 0} · Lv {battle.oppLevel} · Power {battle.oppPower}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mode === "auto" ? (
                  <>
                    <span className="text-xs text-purple-300 animate-pulse-soft">⚡ {t("pvp.auto", locale)}</span>
                    <button onClick={takeControlMap} className="text-xs game-btn px-3 py-1 rounded-lg">
                      {t("pvp.takeControl", locale)}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-teal-300">{t("pvp.turn", locale)}</span>
                )}
                <button onClick={backToLeague} className="text-xs text-red-400 border border-red-500/40 rounded-lg px-3 py-1 hover:bg-red-500/10">
                  {t("pvp.flee", locale)}
                </button>
              </div>
            </div>

            {/* Lutadores */}
            <div className="flex items-start justify-between gap-2 relative">
              <div className="flex-1 text-center">
                <div className="relative inline-block">
                  <div key={pShake} className={pShake > 0 ? "animate-hit-shake" : ""}>
                    <img
                      src={playerImg}
                      alt={playerName}
                      className={`w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-[#4ecdc4]/60 object-cover shadow-[0_0_25px_rgba(78,205,196,0.35)] ${pShake > 0 ? "" : "animate-float"}`}
                    />
                  </div>
                  {floatEls("player")}
                  <BattleFxLayer fx={fx} target="player" />
                </div>
                <div className="mt-2 font-bold text-white tracking-wider truncate max-w-[140px] mx-auto">{playerName}</div>
                <div className="mt-1 mx-auto max-w-[170px]">
                  <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${pvpPct(battle.charHp, battle.charMaxHp)}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{battle.charHp}/{battle.charMaxHp} {t("pvp.hp", locale)}</div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${pvpPct(battle.charMp, battle.charMaxMp)}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{battle.charMp}/{battle.charMaxMp} {t("pvp.mp", locale)}</div>
                </div>
              </div>

              <div className="flex-1 self-center text-center text-3xl sm:text-4xl font-black text-purple-400 animate-pulse-soft pb-14">VS</div>

              <div className="flex-1 text-center">
                <div className="relative inline-block">
                  <div key={eShake} className={eShake > 0 ? "animate-hit-shake" : ""}>
                    <img
                      src={enemyImg}
                      alt={enemyName}
                      className={`w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-red-500/50 object-cover shadow-[0_0_25px_rgba(239,68,68,0.3)] ${eShake > 0 ? "" : "animate-floatSlow"}`}
                    />
                  </div>
                  {floatEls("enemy")}
                  <BattleFxLayer fx={fx} target="enemy" />
                </div>
                <div className="mt-2 font-bold text-white tracking-wider truncate max-w-[140px] mx-auto">{enemyName}</div>
                <div className="text-[10px] text-purple-300">✨ {enemySkill}</div>
                <div className="mt-1 mx-auto max-w-[170px]">
                  <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500" style={{ width: `${pvpPct(battle.oppHp, battle.oppMaxHp)}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{battle.oppHp}/{battle.oppMaxHp} {t("pvp.hp", locale)}</div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${pvpPct(battle.oppMp, battle.oppMaxMp)}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{battle.oppMp}/{battle.oppMaxMp} {t("pvp.mp", locale)}</div>
                </div>
              </div>
            </div>
            {/* Comparativo de atributos */}
            <div className="mt-4 mx-auto max-w-2xl grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 items-center border border-white/10 rounded-xl bg-black/40 p-3">
              <div className="text-center text-[11px] font-black uppercase tracking-widest text-green-400 pb-1">{playerName}</div>
              <div className="text-center text-[11px] font-black text-purple-400 pb-1">VS</div>
              <div className="text-center text-[11px] font-black uppercase tracking-widest text-red-400 pb-1">{enemyName}</div>
              {compareRows.map((row) => (
                <div key={row.key} className="contents">
                  <div className="flex items-center justify-end gap-1">
                    <span className={`text-sm font-black ${Number(row.m) > Number(row.p) ? "text-gray-400" : "text-green-400"}`}>{row.p}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-300 font-semibold">
                    <img src={row.icon} alt="" className="w-4 h-4 object-contain" />
                    {t(row.key, locale)}
                  </div>
                  <div className="flex items-center justify-start gap-1">
                    <span className={`text-sm font-black ${Number(row.m) > Number(row.p) ? "text-red-400" : "text-gray-400"}`}>{row.m}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Controles acima do log */}
            {mode === "turn" ? (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => turnAction("attack")}
                  disabled={busy}
                  className="game-btn-purple px-6 py-3 rounded-xl font-bold text-lg disabled:opacity-50 animate-glow-pulse"
                >
                  ⚔️ {t("pvp.attack", locale)}
                </button>
                <button
                  onClick={() => turnAction("skill")}
                  disabled={busy || battle.charMp < 15}
                  className="game-btn px-6 py-3 rounded-xl font-bold text-lg disabled:opacity-40"
                  title={t("pvp.skillDesc", locale)}
                >
                  ✨ {mySkill} ({battle.charMp}/{15} {t("pvp.mp", locale)})
                </button>
                <button
                  onClick={() => turnAction("defend")}
                  disabled={busy}
                  className="game-btn px-6 py-3 rounded-xl font-bold text-lg disabled:opacity-50"
                >
                  🛡️ {t("pvp.defend", locale)}
                </button>
              </div>
            ) : (
              <div className="mt-4 text-center text-sm text-purple-300 animate-pulse-soft">⚡ {t("pvp.fightAuto", locale)}…</div>
            )}

            {/* Log da batalha */}
            <div className="mt-4 bg-black/50 rounded-xl p-3 max-h-32 overflow-y-auto font-mono text-xs space-y-1 border border-white/5 min-h-[72px]">
              {log.length === 0 && <div className="text-gray-500 animate-pulse-soft">{t("pvp.fight", locale)}…</div>}
              {log.map((l, i) => (
                <div
                  key={i}
                  className={`py-0.5 px-2 rounded ${
                    l.includes("💥") || l.includes("CRÍTICO")
                      ? "text-gold font-bold"
                      : l.toLowerCase().includes("esquiv")
                      ? "text-gray-500"
                      : l.includes("defesa")
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
        </div>
      )}

      {phase === "result" && result && (
        <div className="game-card p-8 text-center relative overflow-hidden border-teal-800 bg-gradient-to-b from-gray-900/80 to-black/70">
          {result.won && <Confetti />}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="text-6xl mb-3">{result.won ? "🏆" : "💀"}</div>
            <h2 className={`text-4xl font-black mb-1 ${result.won ? "text-green-400" : "text-red-400"}`}>
              {result.won ? t("pvp.youWin", locale) : t("pvp.youLose", locale)}
            </h2>
            <p className="text-gray-400 mb-4">
              vs <span className="text-white font-bold">{enemyName}</span> · {t("pvp.round", locale)} {result.battle?.round}
            </p>
            <div className="flex justify-center gap-4 flex-wrap mb-6">
              <span className={`px-4 py-2 rounded-lg border font-bold text-lg flex items-center gap-2 ${result.ratingChange > 0 ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}`}>
                <img src="/images/icons/icone_rating.png" alt="rating" className="w-6 h-6 object-contain" />
                {result.ratingChange > 0 ? "+" : ""}{result.ratingChange} {t("pvp.ratingUp", locale)}
              </span>
              <span className="px-4 py-2 rounded-lg border border-amber-500 text-amber-300 font-bold text-lg flex items-center gap-2">
                <img src="/images/icons/icone_moeda.png" alt="ouro" className="w-6 h-6 object-contain" />
                +{result.goldEarned ?? (result.won ? 12 : 3)}
              </span>
              <span className="px-4 py-2 rounded-lg border border-purple-500 text-purple-300 font-bold text-lg flex items-center gap-2">
                <img src="/images/icons/icone_xp.png" alt="XP" className="w-6 h-6 object-contain" />
                +{result.xpEarned ?? (result.won ? 30 : 8)} XP
              </span>
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              <button onClick={backToLeague} className="game-btn text-lg font-bold px-6 py-3 rounded-xl">
                {t("pvp.backToArena", locale)}
              </button>
              {!result.won && (
                <button
                  onClick={rematch}
                  className="game-btn-purple text-lg font-bold px-6 py-3 rounded-xl animate-glow-pulse"
                  title={t("pvp.rematchOnlyLose", locale)}
                >
                  {t("pvp.rematch", locale)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    {showLeagues && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowLeagues(false)}>
          <div className="game-card p-6 w-full max-w-md max-h-[85vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black">🏆 {t("pvp.allLeagues", locale)}</h3>
              <button onClick={() => setShowLeagues(false)} className="game-btn text-xs font-bold px-3 py-1 rounded-lg">✕</button>
            </div>
            <div className="space-y-3">
              {PVP_LEAGUES.map((l) => {
                const isCurrent = l.id === league.id;
                return (
                  <div
                    key={l.id}
                    className={`game-card p-3 flex items-center gap-3 ${isCurrent ? "border-amber-500/70 bg-amber-500/5" : ""}`}
                  >
                    <img src={l.image} alt={l.id} className="w-14 h-14 object-contain" />
                    <div className="flex-1">
                      <div className="font-bold flex items-center gap-2">
                        {t(`league.${l.id}`, locale)}
                        {isCurrent && <span className="text-[9px] bg-amber-500 text-black font-black rounded px-1">ATUAL</span>}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <img src="/images/icons/icone_rating.png" alt="rating" className="w-3 h-3 object-contain" />
                        {l.minRating}+ {t("pvp.rating", locale)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}