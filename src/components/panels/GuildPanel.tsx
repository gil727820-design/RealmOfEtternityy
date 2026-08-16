"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, CLASS_ICONS, type ClassName } from "@/game/constants";
import BossBattle from "@/components/ui/BossBattle";

type Member = { id: string; name: string; classType: string; sex: string; level: number; power?: number; rank: string; joinedAt?: string };
type Invite = { id: string; guildId: string; guildName?: string; targetCharacterId?: string; targetName?: string; createdAt?: string };
type ChatMsg = { id: string; characterId: string; name: string; classType: string; sex: string; level: number; text: string; createdAt: string };

const MAX_LOGO_RAW_BYTES = 4 * 1024 * 1024; // 4MB — compatível com o limite do servidor

/** Lê a imagem no navegador e devolve um Data URL redimensionado (~400px JPEG). */
function fileToDataUrl(file: File, maxSide = 400, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const raw = String(reader.result || "");
      if (!raw.startsWith("data:image/")) { reject(new Error("not-image")); return; }
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || 1) * scale));
          const h = Math.max(1, Math.round((img.height || 1) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(raw); return; }
          // Fundo escuro para imagens com transparência (PNG/GIF).
          ctx.fillStyle = "#0a0a12";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", quality);
          resolve(out && out.startsWith("data:image/") && out.length < 7_000_000 ? out : raw);
        } catch {
          reject(new Error("draw-failed"));
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export default function GuildPanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [guildsList, setGuildsList] = useState<Array<Record<string, unknown>>>([]);
  const [myGuild, setMyGuild] = useState<Record<string, unknown> | null>(null);
  const [guildStatus, setGuildStatus] = useState<Record<string, unknown> | null>(null);
  const [myInvites, setMyInvites] = useState<Invite[]>([]);
  const [guildRequests, setGuildRequests] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [guildName, setGuildName] = useState("");
  const [guildDesc, setGuildDesc] = useState("");
  const [guildIcon, setGuildIcon] = useState("🏰");
  const [guildLogoFile, setGuildLogoFile] = useState<File | null>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  // Guerra de guildas
  const [warData, setWarData] = useState<Record<string, unknown> | null>(null);
  const [warTarget, setWarTarget] = useState("");

  // Boss de Guilda
  const [guildBoss, setGuildBoss] = useState<Record<string, unknown> | null>(null);
  // Batalha igual à torre (imagem do boss + barras de HP)
  const [guildBossBattle, setGuildBossBattle] = useState(false);
  const [guildBossExtra, setGuildBossExtra] = useState(false);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guild?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      setGuildsList(d.guilds ?? []);
      setMyGuild(d.guild ?? null);
      setGuildStatus(d.guildStatus ?? null);
      setMyInvites(d.myInvites ?? []);
      setGuildRequests(d.guildRequests ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [characterId]);

  const loadChat = useCallback(async () => {
    if (!myGuild?.id) return;
    try {
      const res = await fetch(`/api/guild/chat?guildId=${encodeURIComponent(String(myGuild.id))}`);
      const d = await res.json();
      const ms = Array.isArray(d.messages) ? (d.messages as ChatMsg[]) : [];
      setMessages((prev) => {
        if (prev.length && ms.length && ms[ms.length - 1].id === prev[prev.length - 1].id) return prev;
        return ms;
      });
    } catch { /* ignore */ }
  }, [myGuild?.id]);

  const loadWar = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/guild-war?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setWarData(d);
    } catch { /* ignore */ }
  }, [characterId]);

  const loadGuildBoss = useCallback(async () => {
    if (!characterId) return;
    try {
      const res = await fetch(`/api/guild-boss?characterId=${encodeURIComponent(characterId)}`);
      const d = await res.json();
      if (!d.error) setGuildBoss(d);
    } catch { /* ignore */ }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  // Carrega a guerra junto com a guilda e a cada 15s enquanto houver guerra ativa
  useEffect(() => {
    if (!myGuild?.id) return;
    loadWar();
    loadGuildBoss();
    const id = setInterval(loadWar, 15000);
    return () => clearInterval(id);
  }, [myGuild?.id, loadWar, loadGuildBoss]);

  // Polling do chat a cada 4 segundos enquanto estiver na guilda
  useEffect(() => {
    if (!myGuild?.id) return;
    loadChat();
    const id = setInterval(loadChat, 4000);
    return () => clearInterval(id);
  }, [myGuild?.id, loadChat]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);
  const call = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/guild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return { error: t("general.error", locale) };
    }
  };

  const refreshChar = useCallback(async () => {
    if (!characterId) return;
    const res = await fetch(`/api/character/${characterId}`);
    const d = await res.json();
    if (d.character) setCharacter(d.character);
  }, [characterId, setCharacter]);

  const createGuild = async () => {
    if (!characterId) return;
    if (!guildName.trim()) return;
    if ((character?.level as number) < 5) { notify(t("guild.levelReq", locale), "error"); return; }
    if ((character?.gold as number) < 1000) { notify(t("guild.goldReq", locale), "error"); return; }
    setCreating(true);
    let logo = "";
    if (guildLogoFile) {
      if (guildLogoFile.size > MAX_LOGO_RAW_BYTES) {
        notify("Imagem muito grande (máx. 4MB)", "error");
        setCreating(false);
        return;
      }
      try {
        const logoData = await fileToDataUrl(guildLogoFile);
        const up = await call({ action: "upload_logo", logoData });
        if (!up.success) {
          notify(up.error || "Falha ao enviar a foto da guilda", "error");
          setCreating(false);
          return;
        }
        logo = String(up.logo || up.url || "");
      } catch {
        notify("Não foi possível ler essa imagem. Tente JPG ou PNG.", "error");
        setCreating(false);
        return;
      }
    }
    const d = await call({ action: "create", characterId, name: guildName.trim(), icon: guildIcon, description: guildDesc.trim(), logo });
    setCreating(false);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(t("guild.created", locale), "success");
    setGuildName(""); setGuildDesc(""); setGuildLogoFile(null);
    await load();
    await refreshChar();
  };

  const requestJoin = async (guildId: string) => {
    if (!characterId) return;
    setBusy(`ask_${guildId}`);
    const d = await call({ action: "invite", characterId, guildId });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify("📨 Pedido enviado ao líder!", "success");
    await load();
  };

  const resolveInvite = async (invite: Invite, accept: boolean) => {
    if (!characterId) return;
    setBusy(`inv_${invite.id}`);
    const d = await call({ action: accept ? "my_accept" : "my_decline", characterId, inviteId: invite.id });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(accept ? t("guild.joined", locale) : "Convite recusado.", accept ? "success" : "info");
    await load();
    await refreshChar();
  };

  const leaderResolve = async (invite: Invite, accept: boolean) => {
    if (!characterId) return;
    setBusy(`lead_${invite.id}`);
    const d = await call({ action: accept ? "accept" : "decline", characterId, inviteId: invite.id });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(accept ? `✅ ${invite.targetName || "Jogador"} entrou na guilda!` : `❌ Pedido de ${invite.targetName || "jogador"} recusado.`, accept ? "success" : "info");
    await load();
  };

  const kickMember = async (targetId: string, targetName: string) => {
    if (!characterId || !myGuild) return;
    if (!window.confirm(`Expulsar ${targetName} da guilda?`)) return;
    setBusy(`kick_${targetId}`);
    const d = await call({ action: "kick", characterId, guildId: String(myGuild.id), targetId });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(`👢 ${targetName} foi expulso.`, "info");
    await load();
  };

  const transferLeader = async (targetId: string, targetName: string) => {
    if (!characterId || !myGuild) return;
    if (!window.confirm(`Transferir a liderança para ${targetName}?`)) return;
    setBusy(`tr_${targetId}`);
    const d = await call({ action: "transfer", characterId, guildId: String(myGuild.id), targetId });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(`👑 Liderança transferida para ${targetName}`, "success");
    await load();
  };

  const donate = async (amount: number) => {
    if (!characterId || !myGuild) return;
    if (!amount || amount < 100) { notify(t("guild.donateMin", locale), "error"); return; }
    if (!window.confirm(`${t("guild.donate", locale)} ${amount.toLocaleString()} 🪙?`)) return;
    setBusy("donate");
    const d = await call({ action: "donate", characterId, guildId: String(myGuild.id), amount });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(`✅ ${amount.toLocaleString()} 🪙 ${t("guild.donateOk", locale)}`, "success");
    await load();
    await refreshChar();
  };

  const upgradeGuild = async (upgradeId: string, nameKey: string) => {
    if (!characterId || !myGuild) return;
    setBusy(`up_${upgradeId}`);
    const d = await call({ action: "upgrade", characterId, guildId: String(myGuild.id), upgradeId });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    const status = d.status as Record<string, unknown> | undefined;
    const upgrades = (status?.upgrades ?? {}) as Record<string, unknown>;
    notify(`⬆️ ${t(nameKey, locale)} → ${t("guild.up.level", locale)} ${String(upgrades[upgradeId] ?? 0)}`, "success");
    await load();
    await refreshChar();
  };

  const leaveGuild = async () => {
    if (!characterId || !myGuild) return;
    if (!window.confirm("Sair da guilda?")) return;
    setBusy("leave");
    const d = await call({ action: "leave", characterId, guildId: String(myGuild.id) });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(t("guild.leave", locale), "info");
    await load();
    await refreshChar();
  };

  const warCall = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/guild-war", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return { error: t("general.error", locale) };
    }
  };

  const declareWar = async () => {
    if (!characterId || !warTarget) return;
    setBusy("declare");
    const d = await warCall({ action: "declare", characterId, enemyId: warTarget });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify("⚔️ Guerra declarada!", "success");
    await loadWar();
  };

  const guildBossAttack = async (extra = false) => {
    if (!characterId) return;
    setBusy(extra ? "gb_extra" : "gb_free");
    try {
      const res = await fetch("/api/guild-boss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, extra }),
      });
      const d = await res.json();
      if (!d.success) { notify(d.error, "error"); return; }
      notify(`🐲 ${t("gb.hit", locale)} +${d.dmg}!`, "success");
      if (d.defeatedRewards) notify(`🏆 ${t("gb.defeated", locale)}`, "success");
      await loadGuildBoss();
      await refreshChar();
    } catch {
      notify(t("general.error", locale), "error");
    }
  };

  const warAction = async (kind: "attack" | "defend") => {
    if (!characterId) return;
    setBusy(kind);
    const d = await warCall({ action: kind, characterId });
    setBusy(null);
    if (!d.success) { notify(d.error, "error"); return; }
    notify(kind === "attack" ? `💥 +${d.dmg} de dano!` : `🛡️ Fortaleza reparada (+${d.heal})`, "success");
    await loadWar();
  };

  const sendChat = async () => {
    if (!characterId || !myGuild || !chatText.trim()) return;
    setBusy("chat");
    const res = await fetch("/api/guild/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, guildId: String(myGuild.id), text: chatText.trim() }),
    });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) { notify(d.error, "error"); return; }
    setChatText("");
    loadChat();
  };

  /** Sobe (ou troca) a foto da guilda — só o líder. */
  const uploadGuildPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !myGuild) return;
    if (f.size > MAX_LOGO_RAW_BYTES) { notify("Imagem muito grande (máx. 4MB)", "error"); return; }
    setBusy("logo");
    try {
      const logoData = await fileToDataUrl(f);
      const d = await call({ action: "upload_logo", characterId, guildId: String(myGuild.id), logoData });
      if (!d.success) { notify(d.error || "Falha ao enviar a foto", "error"); return; }
      notify("✅ Foto da guilda atualizada!", "success");
      await load();
    } catch {
      notify("Não foi possível ler essa imagem. Tente JPG ou PNG.", "error");
    } finally {
      setBusy(null);
      e.target.value = "";
    }
  };

  const members = (Array.isArray(myGuild?.members) ? (myGuild?.members as Member[]) : []) as Member[];
  const isLeader = members.some((m) => m.id === characterId && m.rank === "leader");
  const isLeaderOrOfficer = members.some((m) => m.id === characterId && (m.rank === "leader" || m.rank === "officer"));
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="animate-fadeInDown">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <img src="/images/sidebar/menu_guilda.png" alt={t("guild.title", locale)} className="w-10 h-10 object-contain" />
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t("guild.title", locale)}</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">{t("general.loading", locale)}</p>
        </div>
      ) : myGuild ? (
        <div className="space-y-4">
          {/* Cartão da guilda */}
          <div className="game-card game-card-glow p-6">
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <div className="w-28 h-28 rounded-2xl border-2 border-[#ffd700]/40 overflow-hidden mx-auto bg-[#0a0a12] flex items-center justify-center shadow-[0_0_25px_rgba(255,215,0,0.2)]">
                  {myGuild.logo ? (
                    <img src={String(myGuild.logo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl animate-float">{String(myGuild.icon)}</span>
                  )}
                </div>
                {isLeader && (
                  <>
                    <input type="file" id="guildPhotoEdit" accept="image/*" className="hidden" onChange={uploadGuildPhoto} />
                    <label htmlFor="guildPhotoEdit"
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 cursor-pointer text-[10px] font-bold bg-black/80 border border-white/20 rounded-full px-3 py-1 text-white hover:bg-white/10 whitespace-nowrap">
                      {busy === "logo" ? "⏳ ..." : myGuild.logo ? "📷 Trocar foto" : "📷 Adicionar foto"}
                    </label>
                  </>
                )}
              </div>
              <h3 className="text-2xl font-black text-[#ffd700] mt-2">{String(myGuild.name)}</h3>
              {myGuild.description ? <p className="text-sm text-gray-400 mt-1">{String(myGuild.description)}</p> : null}
              <div className="text-xs text-gray-500 mt-1">{t("guild.level", locale)}: {String(myGuild.level)} • {members.length}/{String(myGuild.maxMembers)} {t("guild.members", locale)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#0a0a12] rounded-xl p-4 text-center border border-white/10">
                <div className="text-gray-400 text-sm">{t("guild.members", locale)}</div>
                <div className="text-2xl font-black text-white">{members.length}/{String(myGuild.maxMembers)}</div>
              </div>
              <div className="bg-[#0a0a12] rounded-xl p-4 text-center border border-white/10">
                <div className="text-gray-400 text-sm">{t("guild.bank", locale)}</div>
                <div className="text-2xl font-black text-[#ffd700]">💰 {Number(myGuild.gold || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Nível da guilda + XP */}
            {guildStatus && (
              <div className="bg-[#0a0a12] rounded-xl p-4 border border-white/10 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white">🏰 {t("guild.level", locale)} {String(guildStatus.level)} <span className="text-gray-500 font-normal text-xs">/ {String(guildStatus.maxLevel)}</span></span>
                  <span className="text-[10px] text-gray-400">{String(guildStatus.xp)}/{String(guildStatus.xpToNext)} XP</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#ffd700] to-orange-500 transition-all"
                    style={{ width: `${Number(guildStatus.xpToNext) > 0 ? Math.min(100, (Number(guildStatus.xp) / Number(guildStatus.xpToNext)) * 100) : 100}%` }} />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{t("guild.xpHint", locale)}</div>
              </div>
            )}

            {/* Doação */}
            <div className="bg-[#0a0a12] rounded-xl p-4 border border-white/10 mb-4">
              <h4 className="text-sm font-bold text-gray-300 mb-2">💛 {t("guild.donate", locale)}</h4>
              <div className="flex gap-2 flex-wrap">
                {[500, 2000, 5000, 10000].map((amt) => (
                  <button key={amt} onClick={() => donate(amt)} disabled={busy === "donate"}
                    className="text-xs bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] rounded-lg px-3 py-1.5 font-bold hover:bg-[#ffd700]/20 disabled:opacity-40">
                    🪙 {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Melhorias da guilda */}
            {guildStatus && Array.isArray(guildStatus.upgradeDefs) && guildStatus.upgradeDefs.length > 0 && (
              <div className="bg-[#0a0a12] rounded-xl p-4 border border-white/10 mb-4">
                <h4 className="text-sm font-bold text-gray-300 mb-2">⬆️ {t("guild.up.title", locale)}</h4>
                <div className="space-y-2">
                  {(guildStatus.upgradeDefs as Array<Record<string, unknown>>).map((def) => {
                    const lv = Number(def.level) || 0;
                    const maxLv = Number(def.maxLevel) || 0;
                    const atMax = lv >= maxLv;
                    return (
                      <div key={String(def.id)} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm text-white font-semibold">{String(def.icon)} {t(String(def.nameKey), locale)} <span className="text-[10px] text-gray-400">Lv.{lv}/{maxLv}</span></div>
                          <div className="text-[10px] text-gray-500 truncate">{t(String(def.descKey), locale)}</div>
                        </div>
                        {isLeaderOrOfficer && !atMax && (
                          <button onClick={() => upgradeGuild(String(def.id), String(def.nameKey))} disabled={busy === `up_${String(def.id)}`}
                            className="text-[10px] bg-[#00ff88]/10 border border-[#00ff88]/40 text-[#00ff88] rounded-lg px-2.5 py-1.5 font-bold hover:bg-[#00ff88]/20 disabled:opacity-40 whitespace-nowrap ml-2">
                            {busy === `up_${String(def.id)}` ? "..." : `⬆️ ${Number(def.cost).toLocaleString()} 🪙`}
                          </button>
                        )}
                        {atMax && <span className="text-[10px] text-[#ffd700] font-bold ml-2 whitespace-nowrap">MAX</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guerra de guildas */}
            <div className="bg-[#0a0a12] rounded-xl p-4 border border-red-500/20 mb-4">
              <h4 className="text-sm font-bold text-gray-300 mb-1">⚔️ {t("war.title", locale)}</h4>
              {(() => {
                const war = (warData?.war as Record<string, unknown>) || null;
                const active = !!war?.active && !!war?.war;
                const warObj = active ? (war?.war as Record<string, unknown>) : null;
                const enemy = (warData?.enemy as Record<string, unknown>) || null;
                const myRank = String(warData?.myRank || "member");
                const canDeclare = !!warData?.canDeclare;
                const declareCost = Number(warData?.declareCost || 0);
                const minLevel = Number(warData?.minLevel || 3);
                const guildLevel = Number(warData?.guildLevel || 1);
                const candidates = Array.isArray(warData?.candidates) ? (warData.candidates as Array<Record<string, unknown>>) : [];
                const lastResult = (warData?.lastWarResult as Record<string, unknown>) || null;
                const cooldownUntil = warData?.cooldownUntil ? String(warData.cooldownUntil) : null;

                if (active && warObj) {
                  const hp = Number(warObj.fortressHp || 0);
                  const maxHp = Number(warObj.fortressMaxHp || 1);
                  const pct = maxHp > 0 ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;
                  const timeLeft = Number(warObj.timeLeftMs || 0);
                  const hh = Math.floor(timeLeft / 3600000);
                  const mm = Math.floor((timeLeft % 3600000) / 60000);
                  const participants = Array.isArray(warObj.participants) ? (warObj.participants as Array<Record<string, unknown>>) : [];
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-red-400">💥 {String(warObj.enemyName || "?")}</div>
                        <div className="text-[10px] text-gray-400">⏳ {hh}h {mm}m</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>🛡️ {t("war.fortress", locale)}</span>
                          <span>{hp.toLocaleString()} / {maxHp.toLocaleString()}</span>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-[10px] text-gray-500">{t("war.dealt", locale)}</div>
                          <div className="text-sm font-black text-red-400">💥 {Number(warObj.dmgDealt || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-[10px] text-gray-500">{t("war.taken", locale)}</div>
                          <div className="text-sm font-black text-orange-400">💢 {Number(warObj.dmgTaken || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      {participants.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1">🏆 {t("war.participants", locale)}</div>
                          <div className="space-y-0.5 max-h-24 overflow-y-auto">
                            {participants.slice(0, 6).map((p) => (
                              <div key={String(p.characterId)} className="flex justify-between text-[11px] text-gray-300">
                                <span>{String(p.name)}</span>
                                <span className="text-red-400">+{Number(p.dmg).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => warAction("attack")} disabled={busy === "attack" || !warObj.canAct}
                          className="flex-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-40">
                          {busy === "attack" ? "..." : `⚔️ ${t("war.attack", locale)}`}
                        </button>
                        <button onClick={() => warAction("defend")} disabled={busy === "defend" || !warObj.canAct}
                          className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-40">
                          {busy === "defend" ? "..." : `🛡️ ${t("war.defend", locale)}`}
                        </button>
                      </div>
                      {!warObj.canAct && <div className="text-[10px] text-gray-500 text-center">⏳ {t("war.cooldown", locale)}</div>}
                    </div>
                  );
                }

                // Sem guerra ativa
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">🏆 {t("war.points", locale)}: <b className="text-[#ffd700]">{Number(warData?.warPoints || 0)}</b></span>
                      {lastResult && (
                        <span className={`text-[10px] font-bold ${lastResult.draw ? "text-gray-400" : "text-[#00ff88]"}`}>
                          {lastResult.draw ? t("war.draw", locale) : `🏆 ${t("war.victory", locale)} vs ${String(lastResult.winnerName || "")}`}
                        </span>
                      )}
                    </div>
                    {canDeclare && guildLevel >= minLevel ? (
                      <>
                        {cooldownUntil && new Date(cooldownUntil).getTime() > Date.now() ? (
                          <div className="text-[10px] text-gray-500">⏳ {t("war.cooldownGuild", locale)}</div>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <select value={warTarget} onChange={(e) => setWarTarget(e.target.value)}
                                className="game-input flex-1 text-sm">
                                <option value="">{t("war.selectTarget", locale)}</option>
                                {candidates.map((c) => (
                                  <option key={String(c.id)} value={String(c.id)}>
                                    {String(c.icon || "🏰")} {String(c.name)} (Lv.{String(c.level)} • {String(c.memberCount)} membros)
                                  </option>
                                ))}
                              </select>
                              <button onClick={declareWar} disabled={busy === "declare" || !warTarget}
                                className="text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-40 whitespace-nowrap">
                                {busy === "declare" ? "..." : `⚔️ ${t("war.declare", locale)}`}
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-500">💰 {t("war.cost", locale)}: <b className="text-[#ffd700]">{declareCost.toLocaleString()} 🪙</b> • {t("war.duration", locale)}: 24h</div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-[10px] text-gray-500">
                        {guildLevel < minLevel
                          ? `🔒 ${t("war.levelReq", locale)} ${minLevel}+`
                          : `🔒 ${t("war.leaderOnly", locale)}`}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Boss de Guilda (raid semanal) */}
            {(() => {
              const b = (guildBoss?.boss as Record<string, unknown>) || null;
              if (!b) return null;
              const hp = Number(b.bossHp || 0);
              const maxHp = Number(b.bossMaxHp || 1);
              const pct = maxHp > 0 ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;
              const defeated = !!b.defeated;
              const freeLeft = Number(b.freeAttacksLeft || 0);
              const extraCost = Number(b.extraCost || 25000);
              const ranking = Array.isArray(b.ranking) ? (b.ranking as Array<Record<string, unknown>>) : [];
              // Monstro da batalha pessoal (imagem da TORRE, stats do raid escalados p/ exibição).
              const gbMonster = {
                nameKey: "gb.title",
                image: "/images/tower/monsters/realm_of_eternity_void_wyrm_clean.png",
                icon: "🐲",
                stats: {
                  maxHp: maxHp,
                  attack: Math.max(10, Math.round(maxHp / 4000)),
                  defense: Math.max(5, Math.round(maxHp / 20000)),
                  speed: 5,
                  critical: 10,
                  dodge: 5,
                },
              };
              return (
                <div className="bg-[#0a0a12] rounded-xl p-4 border border-purple-500/20 mb-4">
                  <h4 className="text-sm font-bold text-gray-300 mb-1">🐲 {t("gb.title", locale)}</h4>
                  <div className="text-[10px] text-gray-500 mb-2">🔄 {t("gb.weekly", locale)}</div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>❤️ {t("worldBoss.hp", locale)}</span>
                    <span>{hp.toLocaleString()} / {maxHp.toLocaleString()}</span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div className={`h-full transition-all ${defeated ? "bg-gradient-to-r from-green-600 to-green-400" : "bg-gradient-to-r from-purple-600 to-fuchsia-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  {defeated ? (
                    <div className="text-center text-[#00ff88] font-bold text-sm py-2">🏆 {t("gb.defeated", locale)}!</div>
                  ) : guildBossBattle ? (
                    <BossBattle
                      apiUrl="/api/guild-boss"
                      monster={gbMonster}
                      title={`🐲 ${t("gb.title", locale)}`}
                      fightLabel={`⚔️ ${t("gb.attack", locale)}`}
                      accent="#a855f7"
                      extraBody={guildBossExtra ? { extra: true } : undefined}
                      onFinished={async (r) => {
                        await loadGuildBoss();
                        await refreshChar();
                        if (r.defeatedRewards) notify(`🏆 ${t("gb.defeated", locale)}`, "success");
                      }}
                      onExit={() => setGuildBossBattle(false)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button onClick={() => { setGuildBossExtra(false); setGuildBossBattle(true); }} disabled={freeLeft <= 0}
                          className="flex-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-40">
                          ⚔️ {t("gb.attack", locale)} ({freeLeft > 0 ? "1x grátis" : "sem grátis"})
                        </button>
                        <button onClick={() => { setGuildBossExtra(true); setGuildBossBattle(true); }}
                          className="text-sm bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700] rounded-lg px-3 py-2 font-bold hover:bg-[#ffd700]/25 disabled:opacity-40 whitespace-nowrap">
                          💰 {t("gb.extra", locale)} ({extraCost.toLocaleString()})
                        </button>
                      </div>
                      {freeLeft <= 0 && <div className="text-[10px] text-gray-500 text-center">⏳ {t("gb.freeUsed", locale)}</div>}
                    </div>
                  )}
                  {ranking.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] text-gray-500 mb-1">🏆 {t("gb.ranking", locale)}</div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {ranking.slice(0, 8).map((r, i) => (
                          <div key={String(r.characterId)} className={`flex justify-between text-[11px] ${r.me ? "text-[#ffd700] font-bold" : "text-gray-300"}`}>
                            <span>{i + 1}º {String(r.me ? t("gb.you", locale) : `#${String(r.characterId).slice(0, 4)}`)}</span>
                            <span>💥 {Number(r.dmg).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Membros */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 mb-3">👥 {t("guild.members", locale)}</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-[#0a0a12] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <img src={classImage((m.classType as ClassName) || "warrior", m.sex || "male")} alt={m.name} className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                      <div>
                        <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                          {m.rank === "leader" ? <span title="Líder">👑</span> : null} {m.name}
                          {m.id === characterId && <span className="text-[9px] bg-blue-500/20 text-blue-300 rounded-full px-1.5 py-0.5">você</span>}
                        </div>
                        <div className="text-[10px] text-gray-500">{CLASS_ICONS[(m.classType as ClassName) || "warrior"]} Lv.{m.level}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                        {m.rank === "leader" ? "LÍDER" : m.rank === "officer" ? "OFICIAL" : t("guild.members", locale)}
                      </span>
                      {isLeader && m.id !== characterId && (
                        <>
                          <button onClick={() => kickMember(m.id, m.name)} disabled={busy === `kick_${m.id}`}
                            className="text-[10px] bg-red-600/80 hover:bg-red-600 text-white rounded-lg px-2 py-1 font-bold disabled:opacity-40">
                            {busy === `kick_${m.id}` ? "..." : "Expulsar"}
                          </button>
                          <button onClick={() => transferLeader(m.id, m.name)} disabled={busy === `tr_${m.id}`}
                            className="text-[10px] bg-[#ffd700]/20 border border-[#ffd700]/40 text-[#ffd700] rounded-lg px-2 py-1 font-bold hover:bg-[#ffd700]/30 disabled:opacity-40">
                            {busy === `tr_${m.id}` ? "..." : "👑 Líder"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Pedidos ao líder */}
          {isLeader && guildRequests.length > 0 && (
            <div className="game-card p-5">
              <h3 className="font-bold text-sm text-gray-300 mb-3">📥 Solicitações de entrada</h3>
              <div className="space-y-2">
                {guildRequests.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between bg-[#0a0a12] rounded-xl px-4 py-3 border border-white/5">
                    <div className="text-sm text-white">⚔️ {inv.targetName || "Jogador"} <span className="text-gray-500 text-xs">quer entrar na guilda</span></div>
                    <div className="flex gap-2">
                      <button onClick={() => leaderResolve(inv, true)} disabled={busy === `lead_${inv.id}`}
                        className="text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">✓ Aceitar</button>
                      <button onClick={() => leaderResolve(inv, false)} disabled={busy === `lead_${inv.id}`}
                        className="text-xs bg-red-600/80 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">✕ Recusar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="game-card p-5">
            <h3 className="font-bold text-sm text-gray-300 mb-3">💬 {t("guild.title", locale)} Chat</h3>
            <div ref={chatRef} className="bg-[#0a0a12] rounded-xl p-3 h-56 overflow-y-auto space-y-2 mb-3 border border-white/5">
              {messages.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-10">Sem mensagens ainda. Diga olá! 👋</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <img src={classImage((m.classType as ClassName) || "warrior", m.sex || "male")} alt="" className="w-6 h-6 rounded-full border border-white/10 object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-500">
                        <span className={`font-bold ${m.characterId === "system" ? "text-yellow-500" : ""}`}>{m.name}</span>
                        {m.characterId === "system" ? null : <span> • Lv.{m.level}</span>}
                      </div>
                      <div className="text-sm text-white break-words">{m.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                maxLength={300}
                placeholder="Digite uma mensagem..."
                className="flex-1 game-input"
              />
              <button onClick={sendChat} disabled={busy === "chat" || !chatText.trim()}
                className="game-btn whitespace-nowrap disabled:opacity-40">
                {busy === "chat" ? "..." : "➤"}
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            {isLeader && (
              <span className="text-xs text-gray-500 bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-2">
                👑 Você é o líder. Para sair, transfira a liderança antes.
              </span>
            )}
            <button onClick={leaveGuild} disabled={busy === "leave"}
              className={`text-sm px-4 py-2 rounded-xl font-bold text-white bg-red-700/80 hover:bg-red-600 disabled:opacity-40`}>
              {busy === "leave" ? "..." : `🚪 ${t("guild.leave", locale)}`}
            </button>
          </div>

          {/* Outras guildas (mesmo estando em uma, dá para ver a lista) */}
          <div>
            <h3 className="font-bold text-lg mb-1">📋 {t("guild.list", locale)}</h3>
            <p className="text-[11px] text-gray-500 mb-4">🔒 {t("guild.inGuildListHint", locale)}</p>
            {guildsList.filter((g) => String(g.id) !== String(myGuild.id)).length === 0 ? (
              <div className="game-card p-8 text-center text-gray-500 text-sm">{t("guild.noGuilds", locale)}</div>
            ) : (
              <div className="grid gap-3">
                {guildsList.filter((g) => String(g.id) !== String(myGuild.id)).map((g) => (
                  <div key={String(g.id)} className="game-card p-4 flex items-center justify-between opacity-90">
                    <div className="flex items-center gap-4">
                      {g.logo ? (
                        <img src={String(g.logo)} alt="" className="w-11 h-11 rounded-xl border border-white/10 object-cover" />
                      ) : (
                        <span className="text-3xl">{String(g.icon)}</span>
                      )}
                      <div>
                        <div className="font-bold text-white">{String(g.name)}</div>
                        <div className="text-xs text-gray-400">
                          Lv.{String(g.level)} • {String(g.memberCount)}/{String(g.maxMembers)} {t("guild.members", locale)}
                          {g.description ? <span className="text-gray-600"> • {String(g.description)}</span> : null}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 whitespace-nowrap">
                      🔒 {t("guild.inGuild", locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- SEM guilda --- */
        <div className="space-y-6">
          {/* Convites que recebi */}
            {myInvites.length > 0 && (
              <div className="game-card p-5 border-[#3b82f6]/30">
                <h3 className="font-bold text-sm text-blue-300 mb-3">📨 Convites recebidos</h3>
                <div className="space-y-2">
                  {myInvites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-[#0a0a12] rounded-xl px-4 py-3 border border-white/5">
                      <div className="text-sm text-white">🏰 {inv.guildName || "Guilda"} <span className="text-gray-500 text-xs">te convidou para entrar!</span></div>
                      <div className="flex gap-2">
                        <button onClick={() => resolveInvite(inv, true)} disabled={busy === `inv_${inv.id}`}
                          className="text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">✓ Aceitar</button>
                        <button onClick={() => resolveInvite(inv, false)} disabled={busy === `inv_${inv.id}`}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">✕ Recusar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Criar guilda */}
            <div className="game-card p-6">
              <h3 className="font-bold text-lg mb-4">🏰 {t("guild.create", locale)}</h3>
              <div className="bg-gradient-to-r from-[#ffd700]/10 to-transparent rounded-xl p-4 mb-4 border border-[#ffd700]/20">
                <h4 className="text-sm font-bold text-[#ffd700] mb-2">📋 {t("guild.requirements", locale)}:</h4>
                <div className="space-y-1 text-sm">
                  <div className={`flex items-center gap-2 ${(character?.level as number) >= 5 ? "text-[#00ff88]" : "text-red-400"}`}>
                    {((character?.level as number) >= 5) ? "✅" : "❌"} {t("guild.levelReq", locale)}
                  </div>
                  <div className={`flex items-center gap-2 ${(character?.gold as number) >= 1000 ? "text-[#00ff88]" : "text-red-400"}`}>
                    {((character?.gold as number) >= 1000) ? "✅" : "❌"} {t("guild.goldReq", locale)} — será descontado ao criar
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-stretch">
                {/* Pré-visualização do ícone / foto */}
                <div className="w-16 h-16 rounded-xl border border-white/15 bg-[#0a0a12] flex items-center justify-center overflow-hidden shrink-0">
                  {guildLogoFile ? (
                    <img src={URL.createObjectURL(guildLogoFile)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{guildIcon || "🏰"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-[220px] space-y-2">
                  <div className="flex gap-2">
                    <input value={guildIcon} onChange={(e) => setGuildIcon(e.target.value)} maxLength={4}
                      placeholder="🏰" title="Ícone (emoji)" className="game-input w-24 text-center" />
                    <label htmlFor="guildLogoInput"
                      className="flex-1 game-btn text-center cursor-pointer text-sm whitespace-nowrap">
                      📷 Foto da guilda
                    </label>
                  </div>
                  <input type="file" id="guildLogoInput" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0] || null; setGuildLogoFile(f); }} />
                  {guildLogoFile && (
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
                      <span className="text-xs text-gray-300 truncate">🖼️ {guildLogoFile.name}</span>
                      <button onClick={() => setGuildLogoFile(null)} className="text-xs text-red-400 font-bold">✕</button>
                    </div>
                  )}
                </div>
              </div>
              <input value={guildName} onChange={(e) => setGuildName(e.target.value)} maxLength={20}
                placeholder={t("guild.name", locale)} className="game-input w-full mt-3" />
              <input value={guildDesc} onChange={(e) => setGuildDesc(e.target.value)} maxLength={120}
                placeholder="Descrição (opcional)" className="game-input w-full mt-3" />
              <button onClick={createGuild} disabled={creating || !guildName.trim()}
                className="game-btn whitespace-nowrap mt-3 w-full">
                {creating ? "..." : `🏰 ${t("guild.create", locale)} (💰 1.000)`}
              </button>
            </div>

            {/* Lista de guildas */}
            <div>
              <h3 className="font-bold text-lg mb-4">📋 {t("guild.list", locale)}</h3>
              {guildsList.length === 0 ? (
                <div className="game-card p-10 text-center">
                  <div className="text-4xl mb-3">🏰</div>
                  <div className="text-gray-400">{t("guild.noGuilds", locale)}</div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {guildsList.map((g) => {
                    const gid = String(g.id);
                    const full = (g.memberCount as number) >= (g.maxMembers as number);
                    const pending = !!g.pendingRequest;
                    return (
                      <div key={gid} className="game-card p-4 flex items-center justify-between hover:scale-[1.01] transition">
                        <div className="flex items-center gap-4">
                          {g.logo ? (
                            <img src={String(g.logo)} alt="" className="w-11 h-11 rounded-xl border border-white/10 object-cover" />
                          ) : (
                            <span className="text-3xl">{String(g.icon)}</span>
                          )}
                          <div>
                            <div className="font-bold text-white">{String(g.name)}</div>
                            <div className="text-xs text-gray-400">
                              Lv.{String(g.level)} • {String(g.memberCount)}/{String(g.maxMembers)} {t("guild.members", locale)}
                              {g.description ? <span className="text-gray-600"> • {String(g.description)}</span> : null}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => requestJoin(gid)}
                          disabled={full || pending || busy === `ask_${gid}`}
                          className="game-btn text-sm disabled:opacity-40">
                          {pending ? "⏳ Pedido enviado" : full ? "🔒 " + t("guild.full", locale) : "📨 " + t("guild.join", locale)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
}