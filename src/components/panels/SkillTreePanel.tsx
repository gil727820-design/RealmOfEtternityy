"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { CLASS_ICONS, type ClassName } from "@/game/constants";
import {
  SKILL_TREES,
  skillTreeForClass,
  skillTreeTotalRanks,
  skillTreePassiveBonuses,
  DEBUFF_LOG,
  type SkillDef,
} from "@/game/skillTree";
import { masteryBuff, masteryTitle, masteryBuffDesc, MASTERY_TOTAL_RANKS } from "@/game/mastery";

/** Nome localizado da habilidade (pt/en/es). */
function skillName(s: SkillDef, locale: string): string {
  if (locale?.toLowerCase().startsWith("en")) return s.name.en;
  if (locale?.toLowerCase().startsWith("es")) return s.name.es;
  return s.name.pt;
}
function skillDesc(s: SkillDef, locale: string): string {
  if (locale?.toLowerCase().startsWith("en")) return s.desc.en;
  if (locale?.toLowerCase().startsWith("es")) return s.desc.es;
  return s.desc.pt;
}

/** Nome do status para exibir os bônus passivos. */
const STAT_LABEL: Record<string, { icon: string; pt: string }> = {
  attack: { icon: "⚔️", pt: "Ataque" },
  defense: { icon: "🛡️", pt: "Defesa" },
  speed: { icon: "👟", pt: "Velocidade" },
  maxHp: { icon: "❤️", pt: "Vida Máx" },
  critical: { icon: "💥", pt: "Crítico" },
  precision: { icon: "🎯", pt: "Precisão" },
  dodge: { icon: "💨", pt: "Esquiva" },
};

/** Cor do tier (os 3 primeiros roxo, depois rosa, os finais dourado). */
const tierColor = (i: number) => (i >= 7 ? "#ffd700" : i >= 4 ? "#ec4899" : "#a855f7");

/** Layout da árvore (SVG viewBox 800x612) — tronco no topo, dois ramos, e o
 *  debuff exclusivo da classe no fim (nó maior). */
const NODE_POS: { x: number; y: number }[] = [
  { x: 400, y: 58 },   // 1  — início
  { x: 235, y: 148 },  // 2
  { x: 565, y: 148 },  // 3
  { x: 235, y: 248 },  // 4
  { x: 565, y: 248 },  // 5
  { x: 235, y: 348 },  // 6
  { x: 565, y: 348 },  // 7
  { x: 235, y: 448 },  // 8
  { x: 565, y: 448 },  // 9
  { x: 400, y: 540 },  // 10 — debuff da classe
];

/** Conexões: cada par desenha a linha entre dois nós (progressão visual). */
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 9],
];

function edgePath([a, b]: [number, number]): string {
  const p1 = NODE_POS[a];
  const p2 = NODE_POS[b];
  // Curva suave em L (vai descendo e depois entra no nó de baixo).
  return `M ${p1.x} ${p1.y} Q ${p1.x} ${p2.y}, ${p2.x} ${p2.y}`;
}

export default function SkillTreePanel() {
  const { character, locale, notify, setCharacter, characterId } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [justLearned, setJustLearned] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justAwakened, setJustAwakened] = useState<string | null>(null);

  if (!character) return null;

  const c = character as any;
  const cls = (c.classType as ClassName) || "warrior";
  const tree = skillTreeForClass(cls);
  const invested = (c.skills as Record<string, number> | undefined) ?? {};
  const points = Number(c.skillPoints) || 0;
  const totalRanks = skillTreeTotalRanks(c);
  const passives = skillTreePassiveBonuses(c);
  const mastery = masteryBuff(c);

  const learn = async (s: SkillDef) => {
    if (busy || !characterId) return;
    setBusy(s.id);
    try {
      const res = await fetch("/api/character/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, skillId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
        return;
      }
      if (data.character) setCharacter(data.character);
      // 🎉 MAESTRIA despertou agora: animação especial + título temático.
      if (data.mastery?.active) {
        const title = data.mastery.title || masteryTitle(c, locale);
        setJustAwakened(title);
        notify(`👑 MAESTRIA DESPERTADA: ${title}!`, "success");
        setTimeout(() => setJustAwakened(null), 4200);
      } else {
        notify(data.message || "Habilidade aprendida!", "success");
      }
      setJustLearned(s.id);
      setTimeout(() => setJustLearned(null), 1400);
    } catch {
      notify("Erro ao aprender habilidade", "error");
    } finally {
      setBusy(null);
    }
  };

  const resetTree = async () => {
    if (busy || !characterId || totalRanks === 0) return;
    const ok = window.confirm(
      "🔄 Resetar a árvore de habilidades?\n\nTodos os pontos serão devolvidos.\nCusto: 25.000 de ouro."
    );
    if (!ok) return;
    setBusy("reset");
    try {
      const res = await fetch("/api/character/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, reset: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro", "error");
        return;
      }
      if (data.character) setCharacter(data.character);
      notify(data.message || "Árvore resetada!", "success");
    } catch {
      notify("Erro ao resetar árvore", "error");
    } finally {
      setBusy(null);
    }
  };

  const passiveList = Object.entries(passives).filter(([, v]) => Number(v) > 0);

  // Nó "padrão" selecionado: o último aprendido; senão o primeiro disponível.
  const defaultSel =
    tree.find((s) => (invested[s.id] || 0) > 0) ??
    tree.find((s) => !(totalRanks < s.requiresRanks) && (invested[s.id] || 0) < s.maxRank && points > 0) ??
    tree[0];
  const selected = tree.find((s) => s.id === selectedId) ?? defaultSel;
  const selIdx = tree.findIndex((s) => s.id === selected?.id);

  const short = (name: string) => (name.length > 13 ? name.slice(0, 12) + "…" : name);

  // Estado de cada nó da árvore.
  const nodeState = (s: SkillDef, i: number) => {
    const rank = Number(invested[s.id]) || 0;
    const maxed = rank >= s.maxRank;
    const locked = totalRanks < s.requiresRanks;
    const affordable = points >= s.costPerRank && !maxed && !locked;
    const color = tierColor(i);
    const r = i === 9 ? 34 : 27;
    return { rank, maxed, locked, affordable, color, r, learned: rank > 0 };
  };

  const shortName = (s: SkillDef) => short(skillName(s, locale));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fadeInDown">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#7c5cfc] border border-[#a855f7]/50 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.35)]">
            <img src="/images/sidebar/menu_habilidades.png" alt={t("skill.title", locale)} className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h2 className="text-3xl font-black">
              <span className="bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#ffd700] bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
                {t("skill.title", locale)}
              </span>
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {CLASS_ICONS[cls]} {t(`class.${cls}`, locale)} — {t("skill.subtitle", locale)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#a855f7]/15 border border-[#a855f7]/40 flex items-center gap-2">
            <span className="text-xl animate-float">✨</span>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#a855f7]/80 font-bold">{t("skill.points", locale)}</div>
              <div className="text-xl font-black text-[#a855f7]">{points}</div>
            </div>
          </div>
          <button
            onClick={resetTree}
            disabled={busy !== null || totalRanks === 0 || Number(c.gold) < 25000}
            title="Devolve todos os pontos (25.000 de ouro)"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            🔄 {t("skill.reset", locale)}
          </button>
        </div>
      </div>

      {/* Bônus passivos ativos */}
      {passiveList.length > 0 && (
        <div className="game-card p-4 animate-fadeInUp">
          <h3 className="text-sm font-bold text-[#00ff88] mb-2 flex items-center gap-2">
            <span className="animate-pulse-soft">⚡</span> {t("skill.activePassives", locale)}
          </h3>
          <div className="flex flex-wrap gap-2">
            {passiveList.map(([stat, v]) => {
              const meta = STAT_LABEL[stat] ?? { icon: "✨", pt: stat };
              return (
                <span
                  key={stat}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold"
                >
                  {meta.icon} +{v} {meta.pt}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 👑 MAESTRIA — árvore completa: banner permanente com o buff temático */}
      {mastery && (
        <div
          className="relative overflow-hidden rounded-2xl border p-4 animate-fadeInUp mastery-card"
          style={{
            background: "linear-gradient(120deg, rgba(255,215,0,0.14), rgba(168,85,247,0.14), rgba(255,215,0,0.14))",
            borderColor: "rgba(255,215,0,0.5)",
            boxShadow: "0 0 30px rgba(255,215,0,0.18)",
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ffd700] to-[#a855f7] flex items-center justify-center text-2xl animate-float shadow-[0_0_25px_rgba(255,215,0,0.5)]">
              👑
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7] animate-gradient bg-[length:200%_200%]">
                  👑 {masteryTitle(c, locale)}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/50 text-[#ffd700]">
                  Maestria
                </span>
              </div>
              <p className="text-xs text-[#ffd700]/90 mt-0.5 font-bold">{masteryBuffDesc(c, locale)}</p>
            </div>
            <div className="text-[10px] text-[#ffd700]/60">
              Buff permanente enquanto a árvore estiver completa
            </div>
          </div>
        </div>
      )}

      {/* Progresso até a Maestria */}
      {!mastery && (
        <div className="game-card p-3 animate-fadeInUp">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-gray-400 font-bold">👑 Maestria da classe</span>
            <span className="text-[#ffd700]/80 font-black">
              {Math.min(totalRanks, MASTERY_TOTAL_RANKS)}/{MASTERY_TOTAL_RANKS}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#ffd700] transition-all duration-700"
              style={{ width: `${Math.min(100, (totalRanks / MASTERY_TOTAL_RANKS) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            Maximize as 10 habilidades para despertar um buff permanente da sua classe.
          </p>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 animate-fadeInUp">
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-white/10 border border-white/20 inline-block" /> Bloqueada</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#a855f7]/60 border border-[#a855f7] inline-block" /> Disponível</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#00ff88]/60 border border-[#00ff88] inline-block" /> Aprendida</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-[#ffd700]/60 border border-[#ffd700] inline-block" /> Máximo ✓</span>
        <span className="ml-auto text-gray-500">💡 Clique no nó para aprender</span>
      </div>

      {/* Árvore interligada */}
      <div className="relative game-card overflow-hidden p-2 animate-fadeInUp">
        {/* Brilho de fundo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.10),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,215,0,0.05),transparent_60%)]" />
        {/* Orbes de mana subindo (decorativo) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="mana-orb" style={{ left: `${10 + i * 20}%`, bottom: -8, animationDelay: `${i * 0.8}s` }} />
          ))}
        </div>

        <svg viewBox="0 0 800 612" className="w-full h-auto relative">
          <defs>
            <linearGradient id="litLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00ff88" />
              <stop offset="100%" stopColor="#4ecdc4" />
            </linearGradient>
            <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Linhas de conexão */}
          {EDGES.map(([a, b], k) => {
            const lit = (invested[tree[a].id] || 0) > 0 && (invested[tree[b].id] || 0) > 0;
            return (
              <path
                key={k}
                d={edgePath([a, b])}
                fill="none"
                stroke={lit ? "url(#litLine)" : "rgba(255,255,255,0.08)"}
                strokeWidth={lit ? 5 : 3}
                strokeLinecap="round"
                filter={lit ? "url(#lineGlow)" : undefined}
                style={{ transition: "stroke 0.4s" }}
              />
            );
          })}

          {/* Nós */}
          {tree.map((s, i) => {
            const st = nodeState(s, i);
            const pos = NODE_POS[i];
            const isSelected = selected?.id === s.id;
            const just = justLearned === s.id;
            return (
              <g
                key={s.id}
                transform={`translate(${pos.x} ${pos.y})`}
                onClick={() => {
                  setSelectedId(s.id);
                  if (st.affordable && !busy) learn(s);
                }}
                className="cursor-pointer"
                style={{ transition: "opacity 0.3s" }}
              >
                {/* Halo de seleção */}
                {isSelected && (
                  <circle r={st.r + 8} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 5" className="animate-pulse-soft" />
                )}
                {/* Brilho de recém-aprendida */}
                {just && <circle r={st.r + 10} fill="none" stroke="#00ff88" strokeWidth={2.5} className="animate-pulse-soft" />}

                {/* Corpo do nó */}
                <circle
                  r={st.r}
                  fill={
                    st.locked
                      ? "#14142a"
                      : st.maxed
                        ? "#3a2f00"
                        : st.learned
                          ? "#0d3324"
                          : "#241a4d"
                  }
                  stroke={
                    st.locked
                      ? "rgba(255,255,255,0.15)"
                      : st.maxed
                        ? "#ffd700"
                        : st.learned
                          ? "#00ff88"
                          : st.color
                  }
                  strokeWidth={3}
                  filter={st.learned || st.maxed ? "url(#nodeGlow)" : undefined}
                  opacity={st.locked ? 0.5 : 1}
                  style={!st.locked ? { boxShadow: `0 0 20px ${st.color}55` } : undefined}
                />
                {/* Ícone */}
                <text
                  y={st.r === 34 ? 2 : 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={st.r === 34 ? 32 : 26}
                  opacity={st.locked ? 0.35 : 1}
                >
                  {st.locked ? "🔒" : s.icon}
                </text>

                {/* Pips de rank */}
                {[-1, 0, 1].map((dx) => (
                  <circle
                    key={dx}
                    cx={dx * 8}
                    cy={st.r + 14}
                    r={3.4}
                    fill={st.rank > dx + 1 ? "#00ff88" : "rgba(255,255,255,0.15)"}
                    style={{ transition: "fill 0.3s" }}
                  />
                ))}

                {/* Nome curto */}
                <text y={st.r + 32} textAnchor="middle" fontSize={10.5} fill={st.locked ? "#666" : "#d1d5db"} fontWeight={st.learned ? 700 : 500}>
                  {shortName(s)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Painel de detalhes do nó selecionado */}
      {selected && (
        <div
          className={`game-card p-5 animate-fadeInUp border ${
            justLearned === selected.id ? "border-[#00ff88]/40" : "border-white/10"
          }`}
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={`skill-orb w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl shrink-0 ${
                nodeState(selected, selIdx).locked
                  ? "border-white/10 bg-white/5 grayscale opacity-40"
                  : nodeState(selected, selIdx).maxed
                    ? "border-[#ffd700]/60 bg-[#ffd700]/10 animate-pulse-glow"
                    : nodeState(selected, selIdx).learned
                      ? "border-[#00ff88]/60 bg-[#00ff88]/10"
                      : "border-white/20 bg-white/10 animate-float"
              }`}
              style={{ boxShadow: `0 0 22px ${tierColor(selIdx)}44` }}
            >
              {nodeState(selected, selIdx).locked ? "🔒" : selected.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-white">{skillName(selected, locale)}</h3>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border" style={{ color: tierColor(selIdx), borderColor: `${tierColor(selIdx)}55`, background: `${tierColor(selIdx)}15` }}>
                  {t("skill.tier", locale)} {selIdx + 1}
                </span>
                {nodeState(selected, selIdx).maxed && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700]">
                    {t("skill.maxed", locale)} ✓
                  </span>
                )}
              </div>

              {/* Pips de rank no detalhe */}
              <div className="flex items-center gap-1.5 mt-1.5">
                {Array.from({ length: selected.maxRank }).map((_, r) => (
                  <span
                    key={r}
                    className={`w-3 h-3 rounded-full transition-all ${
                      r < nodeState(selected, selIdx).rank
                        ? "bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.6)]"
                        : "bg-white/15"
                    }`}
                  />
                ))}
                <span className="text-[11px] text-gray-500 ml-1">
                  {nodeState(selected, selIdx).rank}/{selected.maxRank}
                </span>
              </div>

              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{skillDesc(selected, locale)}</p>

              <div className="mt-3 space-y-1.5">
                {selected.passive && (
                  <div className="flex items-center gap-2 text-[11px] text-[#00ff88] font-bold">
                    <span>⚡</span>
                    <span>
                      +{selected.passive.valuePerRank} {STAT_LABEL[selected.passive.stat]?.pt ?? selected.passive.stat}/{t("skill.rank", locale)}
                    </span>
                  </div>
                )}
                {selected.debuff && (
                  <div className="flex items-center gap-2 text-[11px] text-[#ff6b6b] font-bold">
                    <span className="animate-pulse-soft">☠️</span>
                    <span>
                      {DEBUFF_LOG[selected.debuff.type]} +{selected.debuff.valuePerRank}/{t("skill.rank", locale)}
                    </span>
                  </div>
                )}
                {selected.requiresRanks > 0 && (
                  <div className="text-[11px] text-gray-500">
                    🔗 {t("skill.requires", locale)} {selected.requiresRanks} {t("skill.ranks", locale)}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full sm:w-auto sm:self-center">
              <button
                onClick={() => learn(selected)}
                disabled={busy !== null || !nodeState(selected, selIdx).affordable}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  nodeState(selected, selIdx).maxed
                    ? "bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700] cursor-default"
                    : nodeState(selected, selIdx).locked
                      ? "bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                      : "text-white hover:scale-[1.02] active:scale-95 shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                }`}
                style={
                  !nodeState(selected, selIdx).maxed && !nodeState(selected, selIdx).locked
                    ? { background: `linear-gradient(135deg, ${tierColor(selIdx)}cc, ${tierColor(selIdx)}66)`, border: `1px solid ${tierColor(selIdx)}88` }
                    : undefined
                }
              >
                {busy === selected.id
                  ? t("general.loading", locale)
                  : nodeState(selected, selIdx).maxed
                    ? `${t("skill.maxed", locale)} ✓`
                    : nodeState(selected, selIdx).locked
                      ? `${t("skill.locked", locale)} 🔒`
                      : `${t("skill.learn", locale)} — 1 ✨`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎉 Animação de despertar da Maestria (overlay em tela cheia) */}
      {justAwakened && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none" style={{ animation: "awakenOverlay 4.2s ease-out forwards" }}>
          <div className="text-center px-6" style={{ animation: "awakenPop 2.6s ease-out forwards" }}>
            <div className="text-7xl mb-3" style={{ animation: "awakenFloat 2s ease-in-out infinite" }}>👑</div>
            <div
              className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7] mb-2"
              style={{
                backgroundSize: "200% 200%",
                animation: "awakenShine 2s linear infinite",
                textShadow: "0 0 40px rgba(255,215,0,0.8)",
              }}
            >
              MAESTRIA
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#ffd700] mb-1" style={{ textShadow: "0 0 30px rgba(255,215,0,0.9)" }}>
              {justAwakened}
            </div>
            <div className="text-xs sm:text-sm text-gray-300 font-bold mt-1">
              {masteryBuffDesc(c, locale)} — buff permanente ativo!
            </div>
          </div>
        </div>
      )}

      {/* Rodapé: como funciona */}
      <div className="game-card p-4 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
        <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ {t("skill.howTo", locale)}</h3>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
          <li>{t("skill.how1", locale)}</li>
          <li>{t("skill.how2", locale)}</li>
          <li>{t("skill.how3", locale)}</li>
        </ul>
      </div>
    </div>
  );
}
