"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import { computeClockSkew, fmtLocalDateTime, fmtServerTimeLocal } from "@/game/eventTime";

/** Formata um intervalo em HH:MM:SS para contagens regressivas. */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

interface GhostShopData {
  enabled: boolean;
  open: boolean;
  startsAt: string | null;
  endsAt: string | null;
  nextOpening: string | null;
  closingInMs: number | null;
  schedule: string[];
  durationMinutes: number;
  serverTime?: string | null;
  serverOffsetMinutes?: number;
  items: Array<{ template: Record<string, unknown> | null; price: number; quantity: number }>;
}

const POLL_MS = 30_000; // atualiza o estado da loja a cada 30s
const TICK_MS = 1000;   // contagem regressiva ao vivo

export default function GhostShopPanel() {
  const { character, locale, notify, setCharacter, setTab } = useGameStore();
  const [shop, setShop] = useState<GhostShopData | null>(null);
  const [now, setNow] = useState(Date.now());
  // Desvio (ms) entre o relógio do jogador e o do servidor: usado para a
  // contagem regressiva não depender do relógio do aparelho.
  const [skew, setSkew] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shop?action=ghost-shop");
      if (!res.ok) return;
      const d = await res.json();
      setShop(d);
      setSkew(computeClockSkew(d.serverTime));
      // Refresh PONTUAL na transição (fecha/abre): a loja não fica mostrando
      // itens depois da hora nem atrasa a abertura — recarrega exatamente
      // quando a janela termina/começa (com 1s de folga).
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
      const ts = d.open ? d.endsAt : d.nextOpening;
      if (ts) {
        const target = new Date(ts).getTime();
        const t = target - (Date.now() - computeClockSkew(d.serverTime));
        if (t > 0) {
          transitionTimeout.current = setTimeout(() => load(), Math.min(t + 1000, 3600_000));
        }
      }
    } catch {
      /* mantém o estado anterior */
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    };
  }, [load]);

  if (!character) return null;

  const towerCoins = Number(character.towerCoins) || 0;
  const open = !!shop?.open;

  // "Agora" corrigido pelo desvio de relógio (não depende do aparelho do jogador).
  const serverNow = now - skew;

  // Fecha em (se aberta) / abre em (se fechada)
  let countdown: number | null = null;
  let countdownLabel = "";
  if (open && shop?.endsAt) {
    countdown = new Date(shop.endsAt).getTime() - serverNow;
    countdownLabel = t("ghostShop.closesIn", locale);
  } else if (!open && shop?.nextOpening) {
    countdown = new Date(shop.nextOpening).getTime() - serverNow;
    countdownLabel = t("ghostShop.opensIn", locale);
  }

  // Data/hora LOCAL da próxima abertura (ou do fechamento) — legível no fuso do jogador.
  const nextAtLabel = open
    ? { label: t("ghostShop.closesAt", locale), iso: shop?.endsAt }
    : { label: t("ghostShop.nextOpenAt", locale), iso: shop?.nextOpening };
  const scheduleOffset = shop?.serverOffsetMinutes ?? 0;

  const buy = async (templateId: number, price: number, itemName: string) => {
    if (buying) return;
    if (towerCoins < price) {
      notify(t("ghostShop.insufficient", locale), "error");
      return;
    }
    setBuying(String(templateId));
    try {
      const res = await fetch("/api/shop?action=ghost-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || t("general.error", locale), "error");
        return;
      }
      if (data.character) setCharacter(data.character);
      notify(`${itemName} ${t("ghostShop.bought", locale)}`, "success");
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBuying(null);
      load();
    }
  };

  // Ativada = o admin ligou a loja (com horários). Abre de verdade apenas com
  // itens e dentro do horário; sem itens, mostra a contagem regressiva mesmo.
  const shopEnabled = !!shop?.enabled;

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Voltar para a Torre (a loja é acessada de dentro dela) */}
      <button
        onClick={() => setTab("tower")}
        className="flex items-center gap-2 text-sm font-bold text-purple-300 hover:text-white bg-[#7c5cfc]/10 border border-[#7c5cfc]/40 rounded-xl px-4 py-2 transition-colors cursor-pointer hover:bg-[#7c5cfc]/20"
      >
        ← 🏰 {t("ghostShop.backToTower", locale)}
      </button>
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <span className="text-4xl animate-float inline-block">👻</span>
          {t("ghostShop.title", locale)}
        </h2>
        <div className="text-sm bg-purple-900/50 px-3 py-1 rounded-full border border-purple-500 flex items-center gap-2">
          <span>🪙</span>
          <span>{t("ghostShop.balance", locale)}:</span>
          <b className="text-purple-200">{towerCoins.toLocaleString()}</b>
        </div>
      </div>

      {!shopEnabled ? (
        /* Loja desativada pelo admin → "ainda não está aberta" */
        <div className="game-card p-10 text-center relative overflow-hidden border-purple-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-6xl opacity-60">👻</span>
            <h3 className="text-xl font-black text-purple-300">{t("ghostShop.title", locale)}</h3>
            <p className="text-sm text-gray-400 max-w-md">{t("ghostShop.notConfigured", locale)}</p>
          </div>
        </div>
      ) : open ? (
        <>
          {/* Barra de status: aberta + contagem regressiva + data/hora de fechamento */}
          <div className="flex flex-wrap items-center justify-between gap-3 game-card p-4 rounded-2xl border-purple-500/50">
            <span className="px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/50 text-green-300 font-bold text-sm animate-pulse-soft">
              🟢 {t("ghostShop.open", locale)}
            </span>
            <span className="text-sm text-purple-200 font-bold tabular-nums">
              {countdownLabel}: {countdown !== null ? fmtCountdown(countdown) : "—"}
            </span>
            <span className="text-xs text-purple-300/80">
              {nextAtLabel.label}: {fmtLocalDateTime(nextAtLabel.iso, locale)}
            </span>
          </div>

          {/* Itens à venda */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shop.items.map((entry) => {
              const template = entry.template;
              if (!template) return null;
              const rarity = String(template.rarity || "common");
              const color = (RARITY_COLORS as Record<string, string>)[rarity] || "#9ca3af";
              const id = Number(template.id);
              const name = t(String(template.nameKey || "general.item"), locale);
              const disabled = buying === String(id);
              return (
                <div
                  key={id}
                  className="game-card p-6 flex flex-col items-center text-center gap-3 hover-lift border"
                  style={{ borderColor: `${color}55`, boxShadow: `0 0 18px ${color}22` }}
                >
                  {template.image ? (
                    <img
                      src={String(template.image)}
                      alt={name}
                      className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-6xl">{String(template.icon || "🗡️")}</span>
                  )}
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-black"
                    style={{ background: color }}
                  >
                    {rarity}
                  </span>
                  <h3 className="text-lg font-bold leading-tight">{name}</h3>
                  <p className="text-xs text-gray-400">
                    {String(template.slot || "weapon")} · Lv {String(template.minLevel ?? 1)}
                    {Number(template.attack) > 0 && ` · ⚔ +${template.attack}`}
                    {entry.quantity > 1 && ` · ${t("ghostShop.qty", locale)} ${entry.quantity}`}
                  </p>
                  <button
                    onClick={() => buy(id, entry.price, name)}
                    disabled={disabled || towerCoins < entry.price}
                    className={`game-btn w-full text-sm ${towerCoins < entry.price ? "game-btn !bg-gray-700/60 opacity-60 cursor-not-allowed" : "game-btn-purple"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    🪙 {entry.price.toLocaleString()} · {t("ghostShop.buy", locale)}
                  </button>
                </div>
              );
            })}
          </div>
          {shop.items.filter((e) => !!e.template).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">{t("ghostShop.noItems", locale)}</p>
          )}
        </>
      ) : (
        /* Fechada → contagem regressiva para a próxima abertura + horários */
        <div className="game-card p-10 text-center relative overflow-hidden border-purple-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.08),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-6xl opacity-40 animate-pulse-soft">👻</span>
            <h3 className="text-2xl font-black text-purple-300">{t("ghostShop.closed", locale)}</h3>
            <p className="text-sm text-gray-400 max-w-md">{t("ghostShop.subtitle", locale)}</p>
            {countdown !== null && (
              <div className="mt-2 text-3xl font-black tabular-nums text-purple-200 animate-glow-pulse">
                {countdownLabel} {fmtCountdown(countdown)}
              </div>
            )}
            {nextAtLabel.iso && (
              <div className="text-sm text-purple-300 font-bold">
                📅 {nextAtLabel.label}: {fmtLocalDateTime(nextAtLabel.iso, locale)}
              </div>
            )}
            {Array.isArray(shop.schedule) && shop.schedule.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">
                  {t("ghostShop.schedule", locale)}{" "}
                  <span className="text-gray-600">({t("ghostShop.localTime", locale)})</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {shop.schedule.map((hhmm) => (
                    <span key={hhmm} className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/40 text-purple-200 font-mono text-sm">
                      🕐 {t("ghostShop.opensAt", locale)} {fmtServerTimeLocal(hhmm, scheduleOffset, locale)}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 mt-3">
                  {t("ghostShop.duration", locale)}: {shop.durationMinutes} {t("ghostShop.minutes", locale)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
