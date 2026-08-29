"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS } from "@/game/constants";
import { itemSpriteUrl } from "@/game/itemSprites";
import type { SkinTemplate } from "@/game/skins";

interface MailTemplate {
  id: number;
  nameKey: string;
  rarity?: string;
  icon?: string;
  image?: string;
  sheet?: string;
  sellPrice?: number;
  type?: string;
}

interface MailEntry {
  mail: {
    id: string;
    characterId: string;
    kind?: "item" | "skin" | "resource";
    templateId?: number;
    quantity?: number;
    skinId?: string;
    resource?: string;
    amount?: number;
    from: string;
    note: string;
    createdAt: string;
    claimed: boolean;
    claimedAt: string | null;
  };
  template: MailTemplate | null;
  skin?: SkinTemplate | null;
}

/** Metadados dos recursos que podem chegar pelo correio (presente do ADM). */
const RESOURCE_META: Record<string, { icon: string; label: string }> = {
  gold: { icon: "💰", label: "Ouro" },
  diamonds: { icon: "💎", label: "Diamantes" },
  crystals: { icon: "🔮", label: "Cristais" },
  pvpCoins: { icon: "⚔️", label: "Moedas PvP" },
  guildCoins: { icon: "🏰", label: "Moedas de Guilda" },
  towerCoins: { icon: "🗼", label: "Moedas da Torre" },
  energy: { icon: "⚡", label: "Energia" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

export default function MailboxPanel() {
  const characterId = useGameStore((s) => s.characterId);
  const locale = useGameStore((s) => s.locale);
  const notify = useGameStore((s) => s.notify);
  const setMailboxCount = useGameStore((s) => s.setMailboxCount);
  const setInventory = useGameStore((s) => s.setInventory);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [mails, setMails] = useState<MailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const reload = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/social?action=mailbox-send&characterId=${encodeURIComponent(characterId)}`);
      const data = await res.json();
      const list = Array.isArray(data.mails) ? data.mails : [];
      setMails(list);
      setMailboxCount(Number(data.pending) || 0);
    } catch {
      setMails([]);
    } finally {
      setLoading(false);
    }
  }, [characterId, setMailboxCount]);

  useEffect(() => { void reload(); }, [reload]);

  // Após resgatar, atualiza inventário, personagem (recursos/skins) e skins no store.
  const refreshCharacter = useCallback(async () => {
    if (!characterId) return;
    const res = await fetch(`/api/character?id=${characterId}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.inventory)) setInventory(data.inventory);
      if (data.character) setCharacter(data.character);
    }
  }, [characterId, setInventory, setCharacter]);

  const claimOne = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/social?action=mailbox-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", id }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        notify(d.error || t("general.error", locale), "error");
        return;
      }
      const pending = Math.max(0, mails.filter((m) => m.mail.id !== id && !m.mail.claimed).length);
      setMailboxCount(pending);
      notify(t("mailbox.received", locale), "success");
      await reload();
      await refreshCharacter();
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusy(null);
    }
  };

  const claimAll = async () => {
    setBusyAll(true);
    try {
      const res = await fetch("/api/social?action=mailbox-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_all", characterId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        notify(d.error ?? "Erro ao resgatar", "error");
        return;
      }
      setMailboxCount(0);
      notify(t("mailbox.allReceived", locale), "success");
      await reload();
      await refreshCharacter();
    } catch {
      notify(t("general.error", locale), "error");
    } finally {
      setBusyAll(false);
    }
  };

  const pendingCount = mails.filter((m) => !m.mail.claimed).length;

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header */}
      <div className="game-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/images/sidebar/menu_correio.png" alt="" className="h-11 w-11 object-contain shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-white">{t("mailbox.title", locale)}</h2>
            <p className="text-sm text-gray-400 mt-1">{t("mailbox.subtitle", locale)}</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <button onClick={claimAll} disabled={busyAll} className="game-btn shrink-0">
            {busyAll ? "…" : `📦 ${t("mailbox.claimAll", locale)} (${pendingCount})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="spinner mb-3" />
          {t("general.loading", locale)}
        </div>
      ) : mails.length === 0 ? (
        <div className="game-card rounded-2xl p-12 text-center text-gray-500">
          <img src="/images/sidebar/menu_correio.png" alt="" className="h-20 w-20 object-contain mx-auto mb-4 animate-float opacity-70" />
          <p className="text-lg font-bold text-gray-300">{t("mailbox.empty", locale)}</p>
          <p className="text-sm mt-2">{t("mailbox.emptyHint", locale)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mails.map((entry) => {
              const { mail } = entry;
              const kind = mail.kind || "item";

              let iconEl: ReactNode = "🎁";
              let titleStr = `#${mail.templateId ?? "-"}`;
              let subtitleStr = "";
              let rarity = "common";

              const tmpl = entry.template;
              if (kind === "skin" && entry.skin) {
                rarity = entry.skin.rarity || "epic";
                iconEl = <img src={entry.skin.image} alt="" className="w-10 h-10 object-contain" />;
                titleStr = t(entry.skin.nameKey, locale);
                subtitleStr = `${t(`rarity.${rarity}`, locale)} • 🎨 Skin`;
              } else if (kind === "resource") {
                rarity = "legendary";
                const rm = RESOURCE_META[String(mail.resource || "")] || { icon: "🎁", label: "Recurso" };
                iconEl = <span className="text-2xl">{rm.icon}</span>;
                titleStr = `${rm.icon} ${rm.label}`;
                subtitleStr = `${t("mailbox.qty", locale)} ×${Number(mail.amount) || 1}`;
              } else if (tmpl) {
                rarity = tmpl.rarity || "common";
                const sprite = tmpl.image || (tmpl ? itemSpriteUrl(tmpl) : undefined);
                iconEl = sprite ? <img src={sprite} alt="" loading="lazy" decoding="async" className="w-10 h-10 object-contain" /> : tmpl.icon || "🎁";
                titleStr = t(tmpl.nameKey, locale);
                subtitleStr = `${t(`rarity.${rarity}`, locale)} • ${t("mailbox.qty", locale)} ×${mail.quantity ?? 1}`;
              }
              const color = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || "#9ca3af";
              return (
                <div
                  key={mail.id}
                  className={`game-card rounded-2xl p-4 border transition-all ${mail.claimed ? "opacity-55" : "hover:scale-[1.02]"}`}
                  style={{ borderColor: mail.claimed ? undefined : color + "44" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-bg-surface border"
                      style={{ borderColor: color + "55" }}
                    >
                      {iconEl}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">{titleStr}</div>
                      <div className="text-xs text-gray-400 truncate">{subtitleStr}</div>
                      <div className="text-[10px] text-gray-500">{fmtDate(mail.createdAt)}</div>
                    </div>
                  </div>

                  {mail.note && (
                    <p className="text-xs text-gray-400 mb-3 bg-white/5 rounded-lg px-3 py-2">
                      💬 {mail.note}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500">✉️ {mail.from}</span>
                    {mail.claimed ? (
                      <span className="text-[11px] font-bold text-gray-500">✓ {t("mailbox.done", locale)}</span>
                    ) : (
                      <button
                        onClick={() => claimOne(mail.id)}
                        disabled={busy === mail.id}
                        className="rounded-lg bg-gradient-to-r from-[#e94560] to-[#ff7b81] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_14px_rgba(233,69,96,0.3)] transition-transform hover:scale-105 disabled:opacity-50"
                      >
                        {busy === mail.id ? "…" : `📥 ${t("mailbox.claim", locale)}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}