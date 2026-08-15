"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { towerMonsterImage, type TowerBossKind } from "@/game/constants";
import { fmtBig } from "@/game/worldBoss";

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

interface SquadMember {
  characterId: string;
  name: string;
  level: number;
  classType: string;
  damageDealt: number;
}

interface SquadInfo {
  id: string;
  leaderId: string;
  inviteCount?: number;
  members: SquadMember[];
}

interface WorldBossData {
  enabled: boolean;
  open: boolean;
  startsAt: string | null;
  endsAt: string | null;
  nextOpening: string | null;
  closingInMs: number | null;
  schedule: string[];
  durationMinutes: number;
  boss: { kind: string; maxHp: number; maxHpLabel: string; attack: number; defense: number; speed: number; critical: number };
  rewards: { gold: number; xp: number; towerCoins: number };
  maxSquadSize: number;
  attackCooldownSec: number;
  regenSec: number;
  event: {
    status: string;
    bossHp: number;
    bossMaxHp: number;
    bossHpPct: number;
    totalDamage: number;
    participantsCount: number;
    squads: SquadInfo[];
    log: string[];
  } | null;
  me: { characterId: string; name: string; damageDealt: number; hits: number; hp: number; maxHp: number } | null;
  mySquad: SquadInfo | null;
  myInvites: Array<{ squadId: string; leaderName: string; leaderLevel: number }>;
}

const POLL_MS = 3_000; // atualização ao vivo do boss/squad

export default function WorldBossPanel() {
  const { character, locale, notify, setCharacter } = useGameStore();
  const [data, setData] = useState<WorldBossData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [inviteName, setInviteName] = useState("");
  const [cooldownMs, setCooldownMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!character) return;
    try {
      const res = await fetch(`/api/world-boss?characterId=${encodeURIComponent(String(character.id))}`);
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      /* mantém o estado anterior */
    }
  }, [character]);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  // Contagem regressiva do cooldown do ataque.
  useEffect(() => {
    if (cooldownMs <= 0) {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      return;
    }
    const started = Date.now();
    cooldownTimer.current = setInterval(() => {
      const left = cooldownMs - (Date.now() - started);
      setCooldownMs(Math.max(0, left));
      if (left <= 0 && cooldownTimer.current) clearInterval(cooldownTimer.current);
    }, 250);
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, [cooldownMs]);

  if (!character) return null;

  const bossKind = (data?.boss?.kind || "void_wyrm") as TowerBossKind;
  const open = !!data?.open;
  const event = data?.event ?? null;
  const bossAlive = event ? event.status === "open" && event.bossHp > 0 : true;

  let countdown: number | null = null;
  let countdownLabel = "";
  if (open && data?.endsAt) {
    countdown = new Date(data.endsAt).getTime() - now;
    countdownLabel = t("worldBoss.closesIn", locale);
  } else if (!open && data?.nextOpening) {
    countdown = new Date(data.nextOpening).getTime() - now;
    countdownLabel = t("worldBoss.opensIn", locale);
  }

  const doAction = async (path: string, body: Record<string, unknown>, successMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/world-boss/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, ...body }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify(d.error || t("general.error", locale), "error");
        return null;
      }
      if (successMsg) notify(successMsg, "success");
      await load();
      return d;
    } catch {
      notify(t("general.error", locale), "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const enter = () => doAction("enter", {}, t("worldBoss.entered", locale));
  const leave = () => doAction("leave", {}, t("worldBoss.left", locale));
  const invite = () => {
    if (!inviteName.trim()) {
      notify(t("worldBoss.inviteNameRequired", locale), "error");
      return;
    }
    doAction("invite", { targetName: inviteName.trim() }, t("worldBoss.inviteSent", locale)).then((d) => {
      if (d) setInviteName("");
    });
  };
  const respond = (squadId: string, accept: boolean) =>
    doAction("respond", { squadId, accept }, accept ? t("worldBoss.accepted", locale) : undefined);

  const attack = async () => {
    if (cooldownMs > 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/world-boss/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify(d.error || t("general.error", locale), "error");
        return;
      }
      setCooldownMs(d.cooldownMs || 0);
      await load();
      if (!d.bossAlive) {
        notify(t("worldBoss.defeated", locale), "success");
      }
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusy(false);
    }
  };

  const mySquad = data?.mySquad ?? null;
  const me = data?.me ?? null;
  const isLeader = mySquad ? mySquad.leaderId === character.id : false;

  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl inline-block animate-pulse-soft">🌍</span>
          {t("worldBoss.title", locale)}
        </h2>
        {open && (
          <span className="text-sm text-red-300 font-bold tabular-nums bg-red-900/40 px-3 py-1 rounded-full border border-red-500/50 animate-pulse-soft">
            ⚔️ {countdownLabel}: {countdown !== null ? fmtCountdown(countdown) : "—"}
          </span>
        )}
      </div>

      {!open ? (
        /* Fechado — contagem regressiva + horários */
        <div className="game-card p-10 text-center relative overflow-hidden border-red-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-6xl opacity-40 animate-pulse-soft">👹</span>
            <h3 className="text-2xl font-black text-red-300">{t("worldBoss.closed", locale)}</h3>
            <p className="text-sm text-gray-400 max-w-md">{t("worldBoss.subtitle", locale)}</p>
            {countdown !== null && (
              <div className="mt-2 text-3xl font-black tabular-nums text-red-200 animate-glow-pulse">
                {countdownLabel} {fmtCountdown(countdown)}
              </div>
            )}
            {Array.isArray(data?.schedule) && data.schedule.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">{t("worldBoss.schedule", locale)}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {data.schedule.map((hhmm) => (
                    <span key={hhmm} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/40 text-red-200 font-mono text-sm">
                      🕐 {t("worldBoss.opensAt", locale)} {hhmm}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Card do boss */}
          <div className="game-card relative overflow-hidden border-red-800 bg-gradient-to-b from-gray-900/80 to-black/70 p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12),transparent_70%)]" />
            <div className="relative flex flex-col sm:flex-row items-center gap-6">
              <img
                src={towerMonsterImage(bossKind)}
                alt={t(`monster.${bossKind}`, locale)}
                className="w-36 h-36 rounded-2xl border-2 border-red-500/60 object-cover shadow-[0_0_35px_rgba(239,68,68,0.4)] animate-floatSlow"
              />
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <div>
                    <div className="text-2xl font-black text-red-300">{t(`monster.${bossKind}`, locale)}</div>
                    <div className="text-[11px] text-gray-500 uppercase tracking-widest">🌍 {t("worldBoss.title", locale)}</div>
                  </div>
                  {!bossAlive && (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50 text-green-300 font-bold text-sm">
                      🏆 {t("worldBoss.defeated", locale)}
                    </span>
                  )}
                </div>
                {/* HP do boss */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>❤️ {t("worldBoss.hp", locale)}</span>
                    <span className="tabular-nums font-bold text-red-300">
                      {fmtBig(event?.bossHp ?? 0)} / {fmtBig(event?.bossMaxHp ?? data.boss.maxHp)}
                    </span>
                  </div>
                  <div className="h-5 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${bossAlive ? "bg-gradient-to-r from-red-600 to-red-400" : "bg-gradient-to-r from-green-600 to-green-400"}`}
                      style={{ width: `${event?.bossHpPct ?? 100}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">⚔️ {fmtBig(data.boss.attack)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">🛡️ {fmtBig(data.boss.defense)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">💨 {data.boss.speed}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">🎯 {data.boss.critical}%</span>
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-3xl font-black text-red-200 tabular-nums">{fmtBig(event?.totalDamage ?? 0)}</div>
                <div className="text-[11px] text-gray-500">{t("worldBoss.totalDamage", locale)}</div>
                <div className="mt-1 text-xs text-gray-400">👥 {t("worldBoss.participants", locale)}: <b className="text-white">{event?.participantsCount ?? 0}</b></div>
              </div>
            </div>
          </div>

          {!me ? (
            /* Entrar */
            <div className="game-card p-8 text-center">
              <p className="text-sm text-gray-400 mb-4">{t("worldBoss.joinHint", locale)}</p>
              <button onClick={enter} disabled={busy} className="game-btn game-btn-purple w-full max-w-sm mx-auto py-3">
                ⚔️ {t("worldBoss.enter", locale)}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Meu status + ataque */}
              <div className="game-card p-5 rounded-2xl border-red-800 space-y-4">
                <h3 className="text-sm font-bold text-white">🧙 {t("worldBoss.myStatus", locale)}</h3>
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>❤️ {t("worldBoss.hp", locale)}</span>
                    <span className="tabular-nums">{Math.ceil(me.hp)} / {Math.ceil(me.maxHp)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, (me.hp / me.maxHp) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <div className="text-lg font-black text-red-200 tabular-nums">{fmtBig(me.damageDealt)}</div>
                    <div className="text-[10px] text-gray-500">{t("worldBoss.myDamage", locale)}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <div className="text-lg font-black text-white tabular-nums">{me.hits}</div>
                    <div className="text-[10px] text-gray-500">{t("worldBoss.hits", locale)}</div>
                  </div>
                </div>
                <button
                  onClick={attack}
                  disabled={busy || cooldownMs > 0 || me.hp <= 0}
                  className={`game-btn w-full py-3 text-base ${cooldownMs > 0 ? "opacity-60 cursor-not-allowed" : "game-btn-red"}`}
                >
                  {cooldownMs > 0
                    ? `⏳ ${t("worldBoss.cooldown", locale)} ${fmtCountdown(cooldownMs)}`
                    : me.hp <= 0
                    ? `💀 ${t("worldBoss.defeatedYou", locale)}`
                    : `⚔️ ${t("worldBoss.attack", locale)}`}
                </button>
                <button onClick={leave} disabled={busy} className="w-full text-xs text-gray-500 hover:text-red-300 transition">
                  🚪 {t("worldBoss.leave", locale)}
                </button>
              </div>

              {/* Squad */}
              <div className="game-card p-5 rounded-2xl border-red-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  🤝 {t("worldBoss.squad", locale)}
                  {mySquad && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-300">
                      {mySquad.members.length}/{data.maxSquadSize}
                    </span>
                  )}
                </h3>

                {mySquad ? (
                  <>
                    <div className="space-y-2">
                      {mySquad.members.map((m) => (
                        <div key={m.characterId} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/10">
                          <div className="w-9 h-9 rounded-full bg-[#0a0a12] border border-white/15 flex items-center justify-center text-base">
                            {m.characterId === character.id ? "🧙" : "🗡️"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                              {m.name}
                              {m.characterId === character.id && <span className="text-[9px] text-green-400">({t("worldBoss.you", locale)})</span>}
                              {m.characterId === mySquad.leaderId && <span className="text-[9px] text-amber-300">👑</span>}
                            </div>
                            <div className="text-[10px] text-gray-500">Lv.{m.level} · ⚔ {fmtBig(m.damageDealt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {isLeader && mySquad.members.length < data.maxSquadSize && (
                      <div className="flex gap-2">
                        <input
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && invite()}
                          placeholder={t("worldBoss.invitePlaceholder", locale)}
                          className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ff6b6b] focus:outline-none"
                        />
                        <button onClick={invite} disabled={busy} className="bg-[#ff6b6b] hover:bg-[#e94560] text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40">
                          ➕
                        </button>
                      </div>
                    )}
                    {isLeader && (mySquad.inviteCount ?? 0) > 0 && (
                      <div className="text-[11px] text-gray-400">
                        📨 {t("worldBoss.invitesPending", locale)}: {mySquad.inviteCount}
                      </div>
                    )}
                    {!isLeader && (
                      <p className="text-[11px] text-gray-500">{t("worldBoss.leaderOnly", locale)}</p>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-400">
                    {t("worldBoss.noSquad", locale)}
                    <div className="mt-3 flex gap-2">
                      <input
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && invite()}
                        placeholder={t("worldBoss.invitePlaceholder", locale)}
                        className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ff6b6b] focus:outline-none"
                      />
                      <button onClick={invite} disabled={busy} className="bg-[#ff6b6b] hover:bg-[#e94560] text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40">
                        {t("worldBoss.createSquad", locale)}
                      </button>
                    </div>
                  </div>
                )}

                {/* Convites recebidos */}
                {data.myInvites.length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <div className="text-xs text-gray-400 mb-2">📩 {t("worldBoss.pendingInvites", locale)}</div>
                    {data.myInvites.map((inv) => (
                      <div key={inv.squadId} className="flex items-center justify-between gap-2 bg-white/5 rounded-xl p-2.5 border border-white/10 mb-2">
                        <span className="text-xs text-white">🗡️ {inv.leaderName} <span className="text-gray-500">Lv.{inv.leaderLevel}</span></span>
                        <div className="flex gap-2">
                          <button onClick={() => respond(inv.squadId, true)} disabled={busy} className="text-[11px] bg-green-600 hover:bg-green-500 text-white rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40">
                            {t("worldBoss.accept", locale)}
                          </button>
                          <button onClick={() => respond(inv.squadId, false)} disabled={busy} className="text-[11px] bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40">
                            {t("worldBoss.decline", locale)}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Log da batalha */}
          {event && event.log.length > 0 && (
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5">
              <div className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">📜 {t("worldBoss.log", locale)}</div>
              <div className="max-h-44 overflow-y-auto space-y-1 font-mono text-xs">
                {event.log.map((l, i) => (
                  <div key={i} className={`py-0.5 px-2 rounded ${l.includes("🏆") ? "text-gold font-bold" : l.includes("💥") ? "text-red-300 font-bold" : "text-gray-300"}`}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
