"use client";
import { useState, useEffect, useRef } from "react";
import { RARITY_COLORS, CLASS_ICONS, REGIONS } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { SKIN_CATALOG } from "@/game/skins";
import type { SkinTemplate } from "@/game/skins";
import { t } from "@/i18n";

// A chave NÃO fica mais hardcoded aqui (vazava a senha para qualquer visitante
// no bundle JS). O login valida no servidor (/api/admin/login) e a chave só
// existe em memória (ou no localStorage se o admin marcar "lembrar de mim").
const ADMIN_KEY_STORAGE = "realm_admin_key";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "ancestral", "supreme"];
const SLOTS = ["weapon", "shield", "helmet", "armor", "gloves", "boots", "ring", "amulet", "relic", "artifact"];

/** ISO → valor do input datetime-local (horário local, formato YYYY-MM-DDTHH:mm). */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Tab = "dash" | "users" | "characters" | "guilds" | "skins" | "send" | "excluded" | "music" | "server" | "codes" | "reports" | "donate" | "pix" | "test";
type SkinChar = { id: string; name: string; level: number; classType: string; skins: string[] };

/** Recursos que o ADM pode presentear pelo correio. */
const RESOURCE_META: Record<string, { icon: string; label: string }> = {
  gold: { icon: "💰", label: "Ouro" },
  diamonds: { icon: "💎", label: "Diamantes" },
  crystals: { icon: "🔮", label: "Cristais" },
  pvpCoins: { icon: "⚔️", label: "Moedas PvP" },
  guildCoins: { icon: "🏰", label: "Moedas de Guilda" },
  towerCoins: { icon: "🗼", label: "Moedas da Torre" },
  energy: { icon: "⚡", label: "Energia" },
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(ADMIN_KEY_STORAGE);
    } catch {
      return false;
    }
  });
  // A chave digitada — guardada em memória (e no localStorage se "lembrar").
  // Lazy initializer: restaura a chave salva sem setState no effect.
  const [adminKey, setAdminKey] = useState<string>(() => {
    try {
      return localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
    } catch {
      return "";
    }
  });
  const keyRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Edit form state (personagens)
  const [editCharId, setEditCharId] = useState("");
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  // Skins
  const [skinCharId, setSkinCharId] = useState("");
  const [skinMsg, setSkinMsg] = useState("");
  // Enviar (presentes → correio)
  const [sendCharId, setSendCharId] = useState("");
  const [sendKind, setSendKind] = useState<"resource" | "item" | "skin">("resource");
  const [sendResource, setSendResource] = useState("gold");
  const [sendItemId, setSendItemId] = useState("");
  const [sendSkinId, setSendSkinId] = useState("");
  const [sendQty, setSendQty] = useState("1");
  const [sendMsg, setSendMsg] = useState("");
  const [itemCatalog, setItemCatalog] = useState<Record<string, unknown>[]>([]);
  const [itemFilter, setItemFilter] = useState("");
  const [itemFilterRarity, setItemFilterRarity] = useState("");
  const [itemFilterSlot, setItemFilterSlot] = useState("");
  // Mensagem global / manutenção
  const [serverAnnouncement, setServerAnnouncement] = useState("");
  const [serverStyle, setServerStyle] = useState<"banner" | "popup">("banner");
  const [serverMaintenance, setServerMaintenance] = useState(false);
  const [serverMaintenanceMsg, setServerMaintenanceMsg] = useState("");
  const [serverMaintenanceUntil, setServerMaintenanceUntil] = useState("");
  const [infiniteEnergy, setInfiniteEnergy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [serverLoaded, setServerLoaded] = useState(false);
  // Modo teste — ignora a manutenção para o admin testar o jogo
  const [testMode, setTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("adminTestMode") === "1";
    } catch {
      return false;
    }
  });
  // Donate (PIX + QR Code)
  const [donatePixKey, setDonatePixKey] = useState("");
  const [donateQrCode, setDonateQrCode] = useState("");
  const [donateLoaded, setDonateLoaded] = useState(false);
  // Compras PIX de diamantes — conversão por real + lista para aprovar/rejeitar
  const [diamondsPerReal, setDiamondsPerReal] = useState("1000");
  const [purchases, setPurchases] = useState<Record<string, unknown>[]>([]);
  const [pixLoaded, setPixLoaded] = useState(false);
  // Códigos de resgate
  const [codeValue, setCodeValue] = useState("");
  const [codeXpHours, setCodeXpHours] = useState("12");
  const [codeEnergyHours, setCodeEnergyHours] = useState("12");
  const [codeLabel, setCodeLabel] = useState("Boost 2x XP + 2x Energia");
  const [codeMaxUses, setCodeMaxUses] = useState("0");
  const [codeExpiresDays, setCodeExpiresDays] = useState("0");
  const [codesList, setCodesList] = useState<Record<string, unknown>[]>([]);

  const headers = { "Content-Type": "application/json", "x-admin-key": adminKey };
  const audioHeaders = { "x-admin-key": adminKey };

  const login = async () => {
    const typed = (keyRef.current?.value ?? "").trim();
    if (!typed) return setMessage("Digite a chave de acesso.");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: typed }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error || "Chave inválida!");
        return;
      }
      setAdminKey(typed);
      setAuthenticated(true);
      setMessage("");
      // Lembrar de mim: salva a chave com segurança básica no localStorage.
      try {
        if (rememberMe) localStorage.setItem(ADMIN_KEY_STORAGE, typed);
        else localStorage.removeItem(ADMIN_KEY_STORAGE);
      } catch { /* ignora */ }
    } catch {
      setMessage("Erro de conexão — tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=dashboard`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=users&search=${encodeURIComponent(search)}`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadExcluded = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=excluded`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=characters&search=${encodeURIComponent(search)}`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=guilds`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadSkins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=skins&search=${encodeURIComponent(search)}`, { headers });
      const d = await res.json();
      setData((prev) => ({ ...prev, characters: Array.isArray(d.characters) ? d.characters : [] }));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadMusic = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=audio`, { headers });
      setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadItems = async () => {
    try {
      const res = await fetch(`/api/admin?action=items`, { headers });
      const d = await res.json();
      setItemCatalog(Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []);
    } catch { /* ignore */ }
  };

  // ---- Códigos de resgate ----
  const loadCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=codes`, { headers });
      const d = await res.json();
      setCodesList(Array.isArray(d.codes) ? (d.codes as Record<string, unknown>[]) : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=reports`, { headers });
      const d = await res.json();
      setData({ ...d });
    } catch { /* ignore */ }
    setLoading(false);
  };

  const createCode = async () => {
    setBusy("create_code");
    const d = await callAdmin({
      action: "create_code",
      code: codeValue,
      xpHours: codeXpHours,
      energyHours: codeEnergyHours,
      label: codeLabel,
      maxUses: codeMaxUses,
      expiresDays: codeExpiresDays,
    });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Erro"}`);
    if (d.success) {
      setCodeValue("");
      await loadCodes();
    }
    setBusy(null);
  };

  const deleteCode = async (id: string) => {
    if (!window.confirm("Excluir este código? Jogadores não poderão mais resgatá-lo.")) return;
    setBusy(`delcode_${id}`);
    const d = await callAdmin({ action: "delete_code", id });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Erro"}`);
    await loadCodes();
    setBusy(null);
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm("Excluir este reporte?")) return;
    setBusy(`delrep_${id}`);
    const d = await callAdmin({ action: "delete_report", id });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Erro"}`);
    await loadReports();
    setBusy(null);
  };

  useEffect(() => {
    if (!authenticated) return;
    const run = ({
      dash: loadDashboard,
      users: loadUsers,
      characters: loadCharacters,
      guilds: loadGuilds,
      skins: loadSkins,
      send: async () => { await loadCharacters(); await loadItems(); },
      excluded: loadExcluded,
      music: loadMusic,
      server: undefined,
      codes: loadCodes,
      reports: loadReports,
      donate: loadDonateSettings,
      pix: loadPurchases,
    } as Record<Tab, (() => Promise<void>) | undefined>)[tab];
    if (run) {
      const id = setTimeout(() => { void run(); }, 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authenticated]);
  const editCharacter = async () => {
    const updates: Record<string, number> = {};
    for (const [k, v] of Object.entries(editFields)) {
      if (v && v !== "") updates[k] = Number(v);
    }
    const res = await fetch("/api/admin", {
      method: "POST", headers,
      body: JSON.stringify({ action: "edit_character", characterId: editCharId, updates }),
    });
    const d = await res.json();
    setMessage(d.success ? "✅ Personagem atualizado!" : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
  };

  const resetAttributes = async (c: Record<string, unknown>) => {
    if (busy) return;
    const name = String(c.name);
    if (!window.confirm(`🔥 Resetar TODOS os atributos de "${name}"?\n\nOs status voltam ao padrão da classe e os pontos de atributo são ZERADOS (não são devolvidos).`)) return;
    setBusy(`stats_reset_${String(c.id)}`);
    const d = await callAdmin({ action: "reset_attributes", characterId: c.id });
    setMessage(d.success ? `✅ Atributos de "${name}" resetados para o padrão!` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  const grantStatPoints = async (c: Record<string, unknown>) => {
    if (busy) return;
    const level = Math.max(1, Number(c.level) || 1);
    const pts = level * 3;
    const name = String(c.name);
    if (!window.confirm(`🎁 Dar ${pts} pontos de status (3 × Lv.${level}) para "${name}"?`)) return;
    setBusy(`stats_grant_${String(c.id)}`);
    const d = await callAdmin({ action: "grant_stat_points", characterId: c.id });
    setMessage(d.success ? `✅ ${pts} pontos de status concedidos a "${name}"!` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  const resetAttributesGeneral = async () => {
    if (busy) return;
    if (!window.confirm(
      `🔥 ZERAR ATRIBUTOS + DAR PONTOS (GERAL)?\n\nTODOS os personagens terão os status zerados para o padrão da classe e receberão 3 pontos por nível (3 × Lv) de uma vez só.\nOs bônus de itens equipados são mantidos.\n\nEsta ação afeta TODOS os personagens!`
    )) return;
    setBusy("stats_reset_general");
    const d = await callAdmin({ action: "reset_attributes_general" });
    setMessage(d.success ? `✅ ${d.message || "Atributos resetados em geral!"}` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  const resetTowerGeneral = async () => {
    if (busy) return;
    if (!window.confirm(
      `🗼 RESETAR A TORRE (GERAL)?\n\nTODOS os personagens voltarão para o 1º andar da torre.\nAs moedas da torre (towerCoins) são mantidas.\n\nEsta ação afeta TODOS os personagens!`
    )) return;
    setBusy("tower_reset_general");
    const d = await callAdmin({ action: "reset_tower" });
    setMessage(d.success ? `✅ ${d.message || "Torre resetada!"}` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  /** ♻️ Reset total do jogo — apaga todos os jogadores (começar do zero). */
  const resetGame = async () => {
    if (resetConfirm !== "RESETAR") return setMessage("❌ Digite RESETAR para confirmar.");
    if (!window.confirm(
      `⚠️ TEM CERTEZA ABSOLUTA?\n\nIsso apaga TODOS os jogadores, personagens, guildas, inventário, correio, códigos usados e reportes.\nO catálogo de itens e missões é mantido.\n\nNÃO há como desfazer!`
    )) return;
    setBusy("reset_game");
    const d = await callAdmin({ action: "reset_game" });
    setMessage(d.success ? `✅ ${d.message || "Jogo resetado!"}` : `❌ ${d.error || "Falha"}`);
    setResetConfirm("");
    setBusy(null);
    await loadDashboard();
  };

  const callAdmin = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin", { method: "POST", headers, body: JSON.stringify(body) });
      return await res.json();
    } catch {
      return { error: "Erro de conexão" };
    }
  };

  const banUser = async (userId: string, ban: boolean) => {
    if (busy) return;
    setBusy(`ban_${userId}`);
    const d = await callAdmin({ action: "edit_user", userId, updates: { banned: ban } });
    setMessage(d.success ? `✅ ${ban ? "Usuário banido!" : "Usuário desbanido!"}` : `❌ ${d.error || "Falha"}`);
    await loadUsers();
    setBusy(null);
  };

  const deleteUser = async (userId: string, username: string) => {
    if (busy) return;
    const reason = window.prompt(`Motivo da exclusão de "${username}" (ex.: solicitação do jogador, duplicata, fraude):`, "Solicitação do jogador");
    if (reason === null) return; // cancelado
    if (!window.confirm(`Excluir a conta "${username}"? Ela ficará salva em "Excluídos" e poderá ser restaurada.`)) return;
    setBusy(`del_${userId}`);
    const d = await callAdmin({ action: "delete_user", userId, reason });
    setMessage(d.success ? `✅ ${d.message || "Conta excluída!"}` : `❌ ${d.error || "Falha"}`);
    await loadUsers();
    setBusy(null);
  };

  const restoreUser = async (userId: string, username: string) => {
    if (busy) return;
    if (!window.confirm(`Restaurar a conta "${username}"? O jogador poderá fazer login novamente.`)) return;
    setBusy(`res_${userId}`);
    const d = await callAdmin({ action: "restore_user", userId });
    setMessage(d.success ? `✅ ${d.message || "Conta restaurada!"}` : `❌ ${d.error || "Falha"}`);
    await loadExcluded();
    setBusy(null);
  };

  const hardDeleteUser = async (userId: string, username: string) => {
    if (busy) return;
    if (!window.confirm(`⚠️ PERMANENTE! Apagar "${username}" e o personagem definitivamente? Essa ação não pode ser desfeita.`)) return;
    if (!window.confirm(`Última confirmação: excluir ${username} para SEMPRE?`)) return;
    setBusy(`hard_${userId}`);
    const d = await callAdmin({ action: "delete_user_hard", userId });
    setMessage(d.success ? `✅ ${d.message || "Conta removida"} (${d.deletedCharacters ?? 0} personagem(ns))` : `❌ ${d.error || "Falha"}`);
    await loadExcluded();
    setBusy(null);
  };

  const resetPassword = async (userId: string, username: string) => {
    if (busy) return;
    const pw = window.prompt(`Nova senha para "${username}" (mín. 4 caracteres):`, "nova123");
    if (!pw || pw.length < 4) return setMessage("❌ Senha muito curta (mín. 4).");
    setBusy(`pw_${userId}`);
    const d = await callAdmin({ action: "reset_password", userId, password: pw });
    setMessage(d.success ? `✅ Senha de "${username}" trocada para "${pw}"` : `❌ ${d.error || "Falha"}`);
    await loadUsers();
    setBusy(null);
  };
  const grantSkin = async (characterId: string, skinId: string) => {
    const d = await callAdmin({ action: "give_skin", characterId, skinId });
    setMessage(d.success ? "✅ Skin concedida!" : `❌ ${d.error || "Erro"}`);
    await loadSkins();
  };

  const removeSkin = async (characterId: string, skinId: string) => {
    const d = await callAdmin({ action: "remove_skin", characterId, skinId });
    setMessage(d.success ? "✅ Skin removida." : `❌ ${d.error || "Erro"}`);
    await loadSkins();
  };

  const grantAllSkins = async (characterId: string) => {
    const d = await callAdmin({ action: "give_all_skins", characterId });
    setMessage(d.success ? `✅ ${d.count} skins entregues!` : `❌ ${d.error || "Erro"}`);
    await loadSkins();
  };

  /** Envia uma skin para o correio do personagem com a mensagem digitada. */
  const sendSkinToMail = async (characterId: string, skinId: string) => {
    const d = await callAdmin({ action: "send_skin_mail", characterId, skinId, note: skinMsg });
    setMessage(d.success ? `✅ Skin enviada ao correio! (com mensagem)` : `❌ ${d.error || "Erro"}`);
    await loadSkins();
  };

  const sendAllSkinsToMail = async (characterId: string) => {
    const d = await callAdmin({ action: "send_all_skins_mail", characterId, note: skinMsg });
    setMessage(d.success ? `✅ ${d.count} skins enviadas ao correio!` : `❌ ${d.error || "Erro"}`);
    await loadSkins();
  };

  /** Envia um presente (recurso/item/skin) para o correio — 1 por 1 ou com quantidade. */
  const sendGift = async () => {
    if (!sendCharId) return setMessage("❌ Selecione um personagem destinatário.");
    const body: Record<string, unknown> = { action: "send_package", characterId: sendCharId, kind: sendKind, note: sendMsg };
    body.quantity = Math.max(1, Number(sendQty) || 1);
    if (sendKind === "resource") {
      body.resource = sendResource;
    } else if (sendKind === "item") {
      if (!sendItemId) return setMessage("❌ Selecione um item.");
      body.templateId = Number(sendItemId);
    } else {
      if (!sendSkinId) return setMessage("❌ Selecione uma skin.");
      body.skinId = sendSkinId;
    }
    const d = await callAdmin(body);
    const targetName = ((data.characters as SkinChar[]) ?? []).find((c) => c.id === sendCharId)?.name || "";
    setMessage(d.success ? `📨 Presente enviado para ${targetName} — aparece no CORREIO do jogador!` : `❌ ${d.error || "Erro"}`);
  };

  const uploadMusic = async (regionId: string, file: File) => {
    if (!file) return;
    setBusy(`music_${regionId}`);
    try {
      const fd = new FormData();
      fd.append("action", "upload_region_music");
      fd.append("regionId", regionId);
      fd.append("file", file);
      const res = await fetch("/api/admin", { method: "POST", headers: audioHeaders, body: fd });
      const d = await res.json();
      setMessage(d.success ? `✅ Música enviada para a ilha!` : `❌ ${d.error || "Falha no upload"}`);
    } catch {
      setMessage("❌ Erro no upload da música");
    }
    await loadMusic();
    setBusy(null);
  };

  const removeMusic = async (regionId: string) => {
    if (!window.confirm(`Remover a música da ilha ${regionId}?`)) return;
    setBusy(`rmmusic_${regionId}`);
    const d = await callAdmin({ action: "remove_region_music", regionId });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Falha"}`);
    await loadMusic();
    setBusy(null);
  };

  // ---- Mensagem global / manutenção ----
  const loadServerSettings = async () => {
    try {
      const res = await fetch(`/api/admin?action=settings`, { headers });
      const d = await res.json();
      const s = (d.settings || {}) as Record<string, unknown>;
      setServerAnnouncement(typeof s.announcement === "string" ? s.announcement : "");
      setServerStyle(s.announcementStyle === "popup" ? "popup" : "banner");
      setServerMaintenance(!!s.maintenance);
      setServerMaintenanceMsg(typeof s.maintenanceMessage === "string" ? s.maintenanceMessage : "");
      setServerMaintenanceUntil(typeof s.maintenanceUntil === "string" ? isoToLocalInput(s.maintenanceUntil) : "");
      setInfiniteEnergy(!!s.infiniteEnergy);
      setDonatePixKey(typeof s.donatePixKey === "string" ? s.donatePixKey : "");
      setDonateQrCode(typeof s.donateQrCode === "string" ? s.donateQrCode : "");
      setServerLoaded(true);
      setDonateLoaded(true);
    } catch {
      setServerLoaded(true);
      setDonateLoaded(true);
    }
  };

  /** Carrega só as configurações de donate (chave PIX + QR Code). */
  const loadDonateSettings = async () => {
    try {
      const res = await fetch(`/api/admin?action=settings`, { headers });
      const d = await res.json();
      const s = (d.settings || {}) as Record<string, unknown>;
      setDonatePixKey(typeof s.donatePixKey === "string" ? s.donatePixKey : "");
      setDonateQrCode(typeof s.donateQrCode === "string" ? s.donateQrCode : "");
    } catch { /* ignora */ }
    setDonateLoaded(true);
  };

  /** Carrega a lista de compras PIX (comprovantes) + a conversão de diamantes. */
  const loadPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=purchases`, { headers });
      const d = await res.json();
      setPurchases(Array.isArray(d.purchases) ? (d.purchases as Record<string, unknown>[]) : []);
      const sres = await fetch(`/api/admin?action=settings`, { headers });
      const sd = await sres.json();
      const s = (sd.settings || {}) as Record<string, unknown>;
      setDiamondsPerReal(String(Number(s.diamondsPerReal) > 0 ? Number(s.diamondsPerReal) : 1000));
    } catch { /* ignora */ }
    setPixLoaded(true);
    setLoading(false);
  };

  /** Aprova (credita diamantes) ou rejeita um comprovante de compra PIX. */
  const decidePurchase = async (purchase: Record<string, unknown>, approve: boolean) => {
    const p = purchase as Record<string, unknown>;
    const name = String(p.characterName || "?");
    const confirmMsg = approve
      ? `Aprovar a compra de "${name}"? 💎 ${Number(p.diamonds || 0).toLocaleString()} diamantes (R$ ${String(p.valueBRL)}) serão creditados.`
      : `Rejeitar a compra de "${name}"? Nenhum diamante será creditado.`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(`pix_${String(p.id)}`);
    const d = await callAdmin({ action: approve ? "approve_purchase" : "reject_purchase", purchaseId: p.id });
    setMessage(d.success ? `✅ ${d.message || "Compra atualizada!"}` : `❌ ${d.error || "Falha"}`);
    await loadPurchases();
    setBusy(null);
  };

  /** Salva quantos diamantes valem R$ 1 na loja PIX. */
  const saveDiamondsPerReal = async () => {
    const v = Math.max(1, Math.floor(Number(diamondsPerReal) || 1000));
    setBusy("pix_rate");
    const d = await callAdmin({ action: "update_server_settings", diamondsPerReal: v });
    setMessage(d.success ? `✅ Conversão salva: ${v.toLocaleString()} 💎 = R$ 1` : `❌ ${d.error || "Erro"}`);
    if (d.success) setDiamondsPerReal(String(v));
    setBusy(null);
  };

  /** Liga/desliga o modo teste (jogar mesmo em manutenção). */
  const toggleTestMode = () => {
    const next = !testMode;
    setTestMode(next);
    try {
      if (next) localStorage.setItem("adminTestMode", "1");
      else localStorage.removeItem("adminTestMode");
    } catch { /* ignora */ }
    setMessage(
      next
        ? "🧪 Modo teste ATIVADO — abra o jogo para jogar mesmo em manutenção."
        : "Modo teste desativado — jogadores voltam a ver a manutenção."
    );
  };

  /** Envia/atualiza a mensagem global (banner ou popup). */
  const saveServerSettings = async () => {
    setBusy("server");
    const d = await callAdmin({
      action: "update_server_settings",
      announcement: serverAnnouncement.trim(),
      announcementStyle: serverStyle,
    });
    setMessage(
      d.success
        ? "✅ Mensagem enviada! Os jogadores já podem ver (popup aparece uma única vez)."
        : `❌ ${d.error || "Erro"}`
    );
    setBusy(null);
  };

  /** Liga/desliga a ENERGIA INFINITA para todos os jogadores. */
  const toggleInfiniteEnergy = async () => {
    setBusy("infinite_energy");
    const d = await callAdmin({
      action: "update_server_settings",
      infiniteEnergy: !infiniteEnergy,
    });
    setMessage(
      d.success
        ? !infiniteEnergy
          ? "⚡ ENERGIA INFINITA ATIVADA — nenhum jogador gasta energia em missões/masmorras."
          : "✅ Energia infinita desligada — os jogadores voltam a gastar energia normalmente."
        : `❌ ${d.error || "Erro"}`
    );
    if (d.success) setInfiniteEnergy(!infiniteEnergy);
    setBusy(null);
  };

  /** Liga/desliga a manutenção sem mexer na mensagem. */
  const saveMaintenance = async () => {
    setBusy("server");
    const d = await callAdmin({
      action: "update_server_settings",
      maintenance: serverMaintenance,
      maintenanceMessage: serverMaintenanceMsg.trim(),
      // Horário programado de retorno → vira o cooldown visível para os jogadores.
      maintenanceUntil: serverMaintenance && serverMaintenanceUntil ? new Date(serverMaintenanceUntil).toISOString() : "",
    });
    setMessage(
      d.success
        ? serverMaintenance
          ? "🛠️ Manutenção ATIVADA — o jogo está bloqueado para todos."
          : "✅ Manutenção desligada — o jogo voltou ao normal."
        : `❌ ${d.error || "Erro"}`
    );
    setBusy(null);
  };

  /** Salva a chave PIX (e URL manual do QR) exibida nos jogadores. */
  const saveDonate = async () => {
    setBusy("donate");
    const d = await callAdmin({
      action: "update_server_settings",
      donatePixKey: donatePixKey.trim(),
      donateQrCode: donateQrCode.trim(),
    });
    setMessage(d.success ? "✅ Informações de donate salvas! Já aparecem na aba Doar para os jogadores." : `❌ ${d.error || "Erro"}`);
    setBusy(null);
  };

  /** Envia uma imagem (QR Code) e salva a URL nas configurações de donate. */
  const uploadDonateQr = async (file: File) => {
    if (!file) return;
    setBusy("donate_qr");
    try {
      const fd = new FormData();
      fd.append("action", "upload_donate_qr");
      fd.append("file", file);
      const res = await fetch("/api/admin", { method: "POST", headers: audioHeaders, body: fd });
      const d = await res.json();
      setMessage(d.success ? `✅ ${d.message || "QR Code atualizado!"}` : `❌ ${d.error || "Falha no upload"}`);
      if (d.donateQrCode) setDonateQrCode(String(d.donateQrCode));
    } catch {
      setMessage("❌ Erro no upload do QR Code");
    }
    setBusy(null);
  };

  useEffect(() => {
    if (tab === "server" && !serverLoaded) loadServerSettings();
    if (tab === "donate" && !donateLoaded) loadDonateSettings();
    if (tab === "pix" && !pixLoaded) loadPurchases();
  }, [tab, serverLoaded, donateLoaded, pixLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const skinChars = (Array.isArray(data.characters) ? data.characters : []).map((c) => ({ ...c, skins: Array.isArray(c.skins) ? c.skins : [] })) as SkinChar[];
  const selectedSkinChar = skinChars.find((c) => c.id === skinCharId) || null;

  const classGroups: { className: ClassName; skins: SkinTemplate[] }[] = [];
  for (const s of SKIN_CATALOG) {
    const g = classGroups.find((x) => x.className === s.className);
    if (g) g.skins.push(s);
    else classGroups.push({ className: s.className, skins: [s] });
  }

  const audioList = (Array.isArray(data.audio) ? data.audio : []) as Array<Record<string, unknown>>;
  const audioByRegion = Object.fromEntries(audioList.map((a) => [String(a.regionId), a]));
  const regionIcons = (data.regionIcons as Record<string, string>) || {};
  if (!authenticated) {
    return (
      <div style={{ background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)", minHeight: "100vh" }} className="relative flex items-center justify-center p-4 overflow-hidden">
        {/* Brilhos de fundo */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#ff6b6b]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-[#7c5cfc]/20 rounded-full blur-3xl" />

        {/* Vinheta + brasas douradas */}
        <div className="absolute inset-0 vignette pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div key={'ember' + i} className="ember"
              style={{ left: 6 + i * 12 + '%', bottom: -10, animationDelay: (i * 0.7) + 's', animationDuration: (8 + (i % 4) * 2) + 's' }} />
          ))}
        </div>

        <div className="game-card card-royal p-8 w-full max-w-md animate-fadeInUp relative z-10 overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 bg-[#ff6b6b]/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 bg-[#7c5cfc]/10 rounded-full blur-3xl" />
          <div className="relative text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff6b6b] to-[#7c5cfc] shadow-[0_0_35px_rgba(255,107,107,0.4)] mb-3 animate-float">
              <span className="text-5xl">🛡️</span>
            </div>
            <h1 className="text-3xl font-black mb-2 gradient-text tracking-wide">Painel Admin</h1>
            <p className="text-gray-400 text-sm italic">Realm of Eternity ⚜️ — acesso restrito</p>
          </div>

          {message && <div className="animate-shake bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-sm text-red-300 mb-4 text-center">{message}</div>}

          <form
            onSubmit={(e) => { e.preventDefault(); login(); }}
            className="space-y-4 relative"
          >
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="admin-key" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Chave de administrador
              </label>
              <div className="relative">
                <input
                  id="admin-key"
                  ref={keyRef}
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Digite a chave de acesso"
                  defaultValue={adminKey}
                  className="game-input game-input-accent pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                  title={showKey ? "Ocultar chave" : "Mostrar chave"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-base text-gray-400 hover:text-white hover:bg-white/10 transition"
                >
                  {showKey ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-[#e94560]"
              />
              🔒 Lembrar de mim (não pedir a chave nas próximas visitas)
            </label>
            <button type="submit" disabled={loginLoading} className="game-btn w-full py-3 disabled:opacity-50">
              {loginLoading ? "Verificando..." : "🔐 Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabDefs: { id: Tab; label: string; icon: string }[] = [
    { id: "dash", label: "Painel", icon: "📊" },
    { id: "users", label: "Usuários", icon: "👤" },
    { id: "characters", label: "Personagens", icon: "🗡️" },
    { id: "guilds", label: "Guildas", icon: "🏰" },
    { id: "skins", label: "Skins", icon: "🎨" },
    { id: "send", label: "Enviar", icon: "📦" },
    { id: "excluded", label: "Excluídos", icon: "🚫" },
    { id: "music", label: "Músicas das Ilhas", icon: "🎵" },
    { id: "server", label: "Mensagem Global", icon: "📢" },
    { id: "codes", label: "Códigos", icon: "🎟️" },
    { id: "reports", label: "Reportes", icon: "📝" },
    { id: "donate", label: "Donate (PIX)", icon: "💖" },
    { id: "pix", label: "Compras PIX", icon: "💎" },
    { id: "test", label: "Modo Teste", icon: "🧪" },
  ];

  const dash = data as Record<string, number>;

  return (
    <div style={{ background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)", minHeight: "100vh" }} className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header profissional */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#1a1a3a] via-[#15152a] to-[#1a1a3a] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <div className="absolute -top-24 -right-16 w-72 h-72 bg-[#ff6b6b]/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-[#7c5cfc]/15 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff6b6b] to-[#7c5cfc] flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(255,107,107,0.4)] animate-pulse-glow">
                ⚙️
              </div>
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <span className="bg-gradient-to-r from-white via-[#ffd700] to-[#ff6b6b] bg-clip-text text-transparent">Painel Admin</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700]">
                    Controle total
                  </span>
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">Realm of Eternity — gerenciamento do servidor</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAuthenticated(false);
                setAdminKey("");
                setMessage("");
                try { localStorage.removeItem(ADMIN_KEY_STORAGE); } catch { /* ignora */ }
              }}
              className="text-xs px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-[#ff6b6b] hover:border-[#ff6b6b]/40 bg-white/5 transition"
            >
              ⏻ Sair
            </button>
          </div>
        </div>

        {/* Mensagens */}
        {message && (
          <div className="bg-[#1f2937] border border-white/10 rounded-xl px-4 py-3 text-sm text-white flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-gray-500 hover:text-white ml-4">✕</button>
          </div>
        )}

        {/* Tab bar */}
        <div className="sticky top-2 z-20 flex gap-2 flex-wrap bg-[#15152a]/95 backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-lg">
          {tabDefs.map((td) => (
            <button
              key={td.id}
              onClick={() => setTab(td.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${tab === td.id ? "bg-gradient-to-r from-[#ff6b6b] to-[#c73050] text-white shadow-lg shadow-[#ff6b6b]/25 scale-[1.02]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
            >
              <span>{td.icon}</span> {td.label}
            </button>
          ))}
        </div>            {tab === "dash" && (
              <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Usuários", value: dash.users ?? 0, icon: "👤", color: "#4ecdc4" },
                  { label: "Personagens", value: dash.characters ?? 0, icon: "🗡️", color: "#ffd700" },
                  { label: "Guildas", value: dash.guilds ?? 0, icon: "🏰", color: "#3b82f6" },
                  { label: "Excluídos", value: dash.excluded ?? 0, icon: "🚫", color: "#ef4444" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="relative overflow-hidden rounded-2xl p-5 border border-white/10 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30"
                    style={{ background: `linear-gradient(135deg, ${s.color}22, #1a1a2e 70%)`, borderColor: `${s.color}44` }}
                  >
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl" style={{ backgroundColor: `${s.color}33` }} />
                    <div className="relative">
                      <div className="text-3xl mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">{s.icon}</div>
                      <div className="text-3xl font-black text-white" style={{ textShadow: `0 0 20px ${s.color}66` }}>{s.value}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ♻️ Reset do jogo */}
              <div className="mt-6 bg-[#1a1a2e] rounded-2xl p-5 border border-red-500/30">
                <h3 className="text-sm font-bold text-red-400 mb-1">♻️ Resetar o Jogo (começar do zero)</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Apaga <b className="text-red-300">TODOS os jogadores</b> (contas, personagens, guildas, inventário, correio, códigos usados e reportes). O catálogo de itens e missões é mantido.
                </p>
                <div className="flex gap-3 flex-wrap items-center">
                  <input
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder='Digite "RESETAR" para habilitar'
                    className="w-64 bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-[#ff6b6b] focus:outline-none"
                  />
                  <button
                    onClick={resetGame}
                    disabled={resetConfirm !== "RESETAR" || busy === "reset_game"}
                    className={`px-5 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-40 ${resetConfirm === "RESETAR" ? "bg-red-600 hover:bg-red-500" : "bg-gray-800"}`}
                  >
                    {busy === "reset_game" ? "Resetando..." : "♻️ Resetar tudo"}
                  </button>
                </div>
              </div>
              </div>
            )}

            {tab === "users" && (
              <div>
                <div className="flex gap-3 mb-4">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário..."
                    className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-[#ff6b6b] focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && loadUsers()} />
                  <button onClick={loadUsers} className="bg-[#ff6b6b] text-white rounded-xl px-4 py-2 font-bold">🔍</button>
                </div>

                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="space-y-2">
                    {Array.isArray((data as { users?: unknown[] }).users) && ((data as { users: Record<string, unknown>[] }).users).map((u) => {
                      const chars = (Array.isArray(u.characters) ? u.characters : []) as Record<string, unknown>[];
                      const main = chars[0] || null;
                      const isBanned = !!u.banned;
                      const isDeleted = !!u.deleted;
                      const pw = typeof u.passwordPlain === "string" && u.passwordPlain ? String(u.passwordPlain) : null;
                      const lastLogin = u.lastLogin ? new Date(u.lastLogin as string).toLocaleString() : "—";
                      const lastActivity = main?.lastActivity ? new Date(main.lastActivity as string).toLocaleString() : "—";
                      return (
                        <div key={String(u.id)} className={`bg-[#1a1a2e] rounded-xl p-4 border ${isDeleted ? "border-red-500/50" : isBanned ? "border-red-500/30" : "border-white/10"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="w-10 h-10 rounded-full bg-[#0a0a12] border border-white/10 flex items-center justify-center text-lg font-black text-[#ffd700]">
                                {String(u.username).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                  {String(u.username)}
                                  {isDeleted && <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded-full text-white">EXCLUÍDA</span>}
                                  {isBanned && !isDeleted && <span className="text-[10px] bg-red-500/30 border border-red-500/40 px-2 py-0.5 rounded-full text-red-300">BANIDA</span>}
                                  {String(u.role) === "admin" && <span className="text-[10px] bg-[#ffd700]/20 border border-[#ffd700]/40 px-2 py-0.5 rounded-full text-[#ffd700]">ADMIN</span>}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {String(u.role)} • criada em {new Date(u.createdAt as string).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                              {main ? (
                                <div className="text-xs text-gray-400 bg-[#0a0a12] rounded-lg px-3 py-1.5 border border-white/10">
                                  🗡️ <span className="text-[#ffd700] font-bold">{String(main.name)}</span> Lv.{String(main.level)} • {String(main.classType)}
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-600">sem personagem</span>
                              )}
                              {pw ? (
                                <span className="text-[10px] bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1 text-green-300" title="Senha provisória exibida porque a conta foi criada nesta versão">
                                  🔑 senha: <b className="font-mono">{pw}</b>
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-800 rounded-lg px-2 py-1 text-gray-500" title="Conta antiga com hash bcrypt — use 'Redefinir senha' para definir uma nova.">
                                  🔒 hash (definir nova)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                            <div className="flex gap-4 text-[11px] text-gray-500 flex-wrap">
                              <span>Login: <b className="text-gray-300">{lastLogin}</b></span>
                              <span>Atividade: <b className="text-gray-300">{lastActivity}</b></span>
                              {isBanned && u.banReason ? <span>Motivo: <b className="text-red-400">{String(u.banReason)}</b></span> : null}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {!isDeleted && (
                                <>
                                  <button onClick={() => banUser(String(u.id), !isBanned)} disabled={busy === `ban_${u.id}`}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold text-white disabled:opacity-40 ${isBanned ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}`}>
                                    {busy === `ban_${u.id}` ? "..." : isBanned ? "Desbanir" : "Banir"}
                                  </button>
                                  <button onClick={() => resetPassword(String(u.id), String(u.username))} disabled={busy === `pw_${u.id}`}
                                    className="text-xs px-3 py-1.5 rounded-lg font-bold bg-[#ffd700] text-black disabled:opacity-40 hover:opacity-90">
                                    {busy === `pw_${u.id}` ? "..." : "🔑 Senha"}
                                  </button>
                                  <button onClick={() => deleteUser(String(u.id), String(u.username))} disabled={busy === `del_${u.id}`}
                                    className="text-xs px-3 py-1.5 rounded-lg font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40">
                                    {busy === `del_${u.id}` ? "..." : "🗑️ Excluir"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {Array.isArray((data as { users?: unknown[] }).users) && (data as { users: unknown[] }).users.length === 0 && (
                      <div className="text-center py-10 text-gray-500">Nenhum usuário encontrado.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === "characters" && (
              <div>
                <div className="flex gap-3 mb-4">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar personagem..."
                    className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-[#ff6b6b] focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && loadCharacters()} />
                  <button onClick={loadCharacters} className="bg-[#ff6b6b] text-white rounded-xl px-4 py-2 font-bold">🔍</button>
                  <button
                    onClick={resetAttributesGeneral}
                    disabled={busy === "stats_reset_general"}
                    className="bg-gradient-to-r from-[#ff6b6b] to-[#ff9900] text-white rounded-xl px-4 py-2 font-bold text-sm hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === "stats_reset_general" ? "Resetando..." : "🔥 Zerar + Dar Pontos (Todos)"}
                  </button>
                  <button
                    onClick={resetTowerGeneral}
                    disabled={busy === "tower_reset_general"}
                    className="bg-gradient-to-r from-[#7c5cfc] to-[#4ecdc4] text-white rounded-xl px-4 py-2 font-bold text-sm hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === "tower_reset_general" ? "Resetando..." : "🗼 Resetar Torre (Todos)"}
                  </button>
                </div>

                {/* Edit Form */}
                <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#ffd700]/30 mb-4">
                  <h3 className="text-sm font-bold text-[#ffd700] mb-3">⚡ Editar Personagem (use o ID da lista abaixo)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <input value={editCharId} onChange={(e) => setEditCharId(e.target.value)} placeholder="ID do personagem" className="bg-[#0a0a12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff6b6b] focus:outline-none" />
                    {["gold", "diamonds", "energy", "maxEnergy", "level", "attack", "defense", "power", "vipLevel"].map((f) => (
                      <input key={f} value={editFields[f] || ""} onChange={(e) => setEditFields({ ...editFields, [f]: e.target.value })} placeholder={f}
                        type="number" className="bg-[#0a0a12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff6b6b] focus:outline-none" />
                    ))}
                  </div>
                  <button onClick={editCharacter} className="bg-[#ffd700] text-black rounded-xl px-4 py-2 font-bold text-sm">💾 Salvar Alterações</button>
                </div>

                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="space-y-2">
                    {Array.isArray((data as { characters?: unknown[] }).characters) && ((data as { characters: Record<string, unknown>[] }).characters).map((c) => (
                      <div key={String(c.id)} className="bg-[#1a1a2e] rounded-xl p-3 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xl">{CLASS_ICONS[(c.classType as ClassName) || "warrior"]}</span>
                          <div>
                            <div className="font-bold text-white">{String(c.name)}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{String(c.id)}</div>
                          </div>
                          <div className="text-xs text-[#ffd700] font-bold">Lv.{String(c.level)}</div>
                          <div className="text-xs text-gray-400">💰 {Number(c.gold || 0).toLocaleString()} • 💎 {Number(c.diamonds || 0)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resetAttributes(c)}
                            disabled={busy === `stats_reset_${String(c.id)}`}
                            className="text-xs bg-[#ff6b6b] text-white rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                            {busy === `stats_reset_${String(c.id)}` ? "..." : "🔄 Resetar Atributos"}
                          </button>
                          <button
                            onClick={() => grantStatPoints(c)}
                            disabled={busy === `stats_grant_${String(c.id)}`}
                            className="text-xs bg-[#4ecdc4] text-black rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                            {busy === `stats_grant_${String(c.id)}` ? "..." : `➕ ${Math.max(1, Number(c.level) || 1) * 3} pts (3×Lv)`}
                          </button>
                          <button
                            onClick={() => {
                              setEditCharId(String(c.id));
                              setEditFields({});
                              setMessage(`Personagem ${String(c.name)} selecionado para edição.`);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="text-xs bg-[#ffd700] text-black rounded-lg px-3 py-1.5 font-bold hover:opacity-90">
                            ✏️ Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "skins" && (
              <div>
                <div className="flex gap-3 mb-4">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar personagem..."
                    className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-[#ff6b6b] focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && loadSkins()} />
                  <button onClick={loadSkins} className="bg-[#ff6b6b] text-white rounded-xl px-4 py-2 font-bold">🔍</button>
                </div>

                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Seletor de personagem */}
                    <div className="md:col-span-1 space-y-2">
                      <h3 className="text-sm font-bold text-white mb-2">👤 Personagens</h3>
                      {skinChars.map((c) => (
                        <button key={c.id} onClick={() => setSkinCharId(c.id)}
                          className={`w-full text-left p-3 rounded-xl border transition ${skinCharId === c.id ? "border-[#ffd700] bg-[#ffd700]/10" : "border-white/10 bg-[#1a1a2e] hover:border-white/30"}`}>
                          <div className="font-bold text-white text-sm">{c.name}</div>
                          <div className="text-xs text-gray-400">{CLASS_ICONS[(c.classType as ClassName) || "warrior"]} Lv.{c.level}</div>
                          <div className="text-[11px] text-[#ffd700]">{c.skins.length}/{SKIN_CATALOG.length} skins</div>
                        </button>
                      ))}
                      {skinChars.length === 0 && <div className="text-gray-500 text-sm py-6 text-center">Nenhum personagem encontrado.</div>}
                    </div>

                    {/* Catálogo */}
                    <div className="md:col-span-2">
                      {!selectedSkinChar ? (
                        <div className="bg-[#1a1a2e] border border-dashed border-gray-700 rounded-2xl p-10 text-center text-gray-500">
                          Selecione um personagem ao lado para conceder/remover skins. 👈
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <p className="text-xs text-gray-400">
                              Concedendo para <span className="text-white font-bold">{selectedSkinChar.name}</span> (Lv.{selectedSkinChar.level}) —{" "}
                              <span className="text-[#ffd700] font-bold">{selectedSkinChar.skins.length}/{SKIN_CATALOG.length}</span> skins.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-4 bg-[#0a0a12] rounded-xl border border-white/10 p-3">
                            <input
                              value={skinMsg}
                              onChange={(e) => setSkinMsg(e.target.value)}
                              placeholder="📝 Mensagem do ADM (vai junto no correio)"
                              className="flex-1 min-w-[200px] bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                            />
                            <button onClick={() => sendAllSkinsToMail(selectedSkinChar.id)} className="text-xs bg-[#4ecdc4] text-black rounded-lg px-3 py-2 font-bold hover:opacity-90">
                              📬 Enviar TODAS no correio
                            </button>
                            <button onClick={() => grantAllSkins(selectedSkinChar.id)} className="text-xs bg-[#ffd700] text-black rounded-lg px-3 py-2 font-bold hover:opacity-90">
                              🎁 Conceder TODAS
                            </button>
                          </div>
                          <div className="space-y-6">
                            {classGroups.map((g) => (
                              <div key={g.className}>
                                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                  <span className="text-lg">{CLASS_ICONS[g.className]}</span>
                                  {t(`class.${g.className}`)}
                                  <span className="text-gray-500 text-xs font-normal">({g.skins.length})</span>
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {g.skins.map((s) => {
                                    const owned = selectedSkinChar.skins.includes(s.id);
                                    return (
                                      <div key={s.id} className={`bg-[#0a0a12] rounded-lg overflow-hidden border ${owned ? "border-green-500/50" : "border-white/10"}`}>
                                        <div className="relative">
                                          <img src={s.image} alt={t(s.nameKey)} loading="lazy" className="w-full h-36 object-cover" />
                                          <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full text-black"
                                            style={{ background: RARITY_COLORS[s.rarity] }}>
                                            {s.rarity.toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="p-2">
                                          <div className="font-bold text-white text-xs truncate">{t(s.nameKey)}</div>
                                          <div className="text-[10px] text-gray-500 mb-1">
                                            {CLASS_ICONS[s.className]} {t(`class.${s.className}`)}
                                          </div>
                                          {owned ? (
                                            <div className="flex gap-1">
                                              <span className="flex-1 text-center text-[10px] font-bold bg-green-500/20 border border-green-500/40 text-green-300 rounded-lg py-2">✓ Possui</span>
                                              <button onClick={() => removeSkin(selectedSkinChar.id, s.id)}
                                                className="text-[10px] bg-red-600/80 hover:bg-red-600 text-white rounded-lg px-2 py-2 font-bold" title="Remover skin">✕</button>
                                            </div>
                                          ) : (
                                            <div className="flex gap-1">
                                              <button onClick={() => grantSkin(selectedSkinChar.id, s.id)}
                                                className="flex-1 text-[10px] font-bold bg-[#ffd700] text-black rounded-lg py-2 hover:opacity-90" title="Conceder direto">
                                                📦 Dar
                                              </button>
                                              <button onClick={() => sendSkinToMail(selectedSkinChar.id, s.id)}
                                                className="flex-1 text-[10px] font-bold bg-[#4ecdc4] text-black rounded-lg py-2 hover:opacity-90" title="Enviar para o correio">
                                                📬 Correio
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === "send" && (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Destinatário */}
                <div className="md:col-span-1 bg-[#1a1a2e] rounded-2xl border border-white/10 p-4">
                  <h3 className="text-sm font-bold text-white mb-3">👤 Destinatário</h3>
                  <select value={sendCharId} onChange={(e) => setSendCharId(e.target.value)}
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none mb-3">
                    <option value="">— selecionar personagem —</option>
                    {((data.characters as SkinChar[]) ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name} (Lv.{c.level} · {CLASS_ICONS[(c.classType as ClassName) || "warrior"]})</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mb-3">
                    O presente vai direto para o <b className="text-[#4ecdc4]">CORREIO</b> do jogador — ele resgata quando quiser.
                  </p>
                  <input value={sendMsg} onChange={(e) => setSendMsg(e.target.value)} maxLength={200}
                    placeholder="📝 Mensagem do ADM (ex.: Presente enviado pelo ADM 🎁)"
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none" />
                </div>

                {/* Tipo + envio */}
                <div className="md:col-span-2 bg-[#1a1a2e] rounded-2xl border border-white/10 p-4 space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { id: "resource", label: "💎 Recursos" },
                      { id: "item", label: "🧪 Itens" },
                      { id: "skin", label: "🎨 Skins" },
                    ] as { id: "resource" | "item" | "skin"; label: string }[]).map((k) => (
                      <button key={k.id} onClick={() => setSendKind(k.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${sendKind === k.id ? "bg-[#ff6b6b] border-[#ff6b6b] text-white" : "bg-transparent border-white/15 text-gray-300 hover:bg-white/5"}`}>
                        {k.label}
                      </button>
                    ))}
                  </div>

                  {sendKind === "resource" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <select value={sendResource} onChange={(e) => setSendResource(e.target.value)}
                        className="bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none">
                        {Object.entries(RESOURCE_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                      <input type="number" min={1} value={sendQty} onChange={(e) => setSendQty(e.target.value)}
                        placeholder="Quantidade" className="bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none" />
                    </div>
                  )}

                  {sendKind === "item" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-400">
                          🧪 {itemCatalog.length} itens disponíveis — clique para selecionar.
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Qtd:</span>
                          <input type="number" min={1} value={sendQty} onChange={(e) => setSendQty(e.target.value)}
                            className="w-24 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#ff6b6b] focus:outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <input value={itemFilter}
                          onChange={(e) => setItemFilter(e.target.value)}
                          placeholder="🔍 Buscar item..."
                          className="flex-1 min-w-[180px] bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:border-[#ff6b6b] focus:outline-none" />
                        <select value={itemFilterRarity} onChange={(e) => setItemFilterRarity(e.target.value)}
                          className="bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:border-[#ff6b6b] focus:outline-none">
                          <option value="">Todas raridades</option>
                          {RARITY_ORDER.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                        </select>
                        <select value={itemFilterSlot} onChange={(e) => setItemFilterSlot(e.target.value)}
                          className="bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:border-[#ff6b6b] focus:outline-none">
                          <option value="">Todos slots</option>
                          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto pr-1">
                        {itemCatalog.filter((it) => {
                          if (itemFilterRarity && String(it.rarity || "common") !== itemFilterRarity) return false;
                          if (itemFilterSlot && String(it.slot || "weapon") !== itemFilterSlot) return false;
                          if (itemFilter.trim()) {
                            const q = itemFilter.trim().toLowerCase();
                            const name = t(String(it.nameKey)).toLowerCase();
                            if (!name.includes(q)) return false;
                          }
                          return true;
                        }).map((it) => {
                          const id = Number(it.id);
                          const isSel = String(it.id) === sendItemId;
                          const rarity = String(it.rarity || "common");
                          const color = RARITY_COLORS[rarity] ?? "#9ca3af";
                          return (
                            <button
                              key={id}
                              onClick={() => setSendItemId(isSel ? "" : String(it.id))}
                              className={`relative flex flex-col items-center gap-1 rounded-xl border bg-[#0a0a12] p-3 text-center transition-all ${
                                isSel ? "ring-2 ring-[#ff6b6b] border-[#ff6b6b]" : "border-white/10 hover:border-white/30"
                              }`}
                              style={!isSel ? { borderColor: color + "44" } : undefined}
                            >
                              {isSel && <span className="absolute top-1.5 right-1.5 text-[10px] font-black text-[#ff6b6b]">✓</span>}
                              {it.image ? (
                                <img src={String(it.image)} alt="" loading="lazy" decoding="async" className="h-12 w-12 object-contain" />
                              ) : (
                                <span className="text-2xl">{String(it.icon || "🗡️")}</span>
                              )}
                              <span className="w-full truncate text-[11px] font-bold text-white">{t(String(it.nameKey))}</span>
                              <span className="text-[9px] font-bold uppercase" style={{ color }}>{rarity}</span>
                              <span className="text-[9px] text-gray-500">
                                {String(it.slot || "weapon")} • ⚔ {String(it.attack || 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {itemCatalog.filter((it) => {
                        if (itemFilterRarity && String(it.rarity || "common") !== itemFilterRarity) return false;
                        if (itemFilterSlot && String(it.slot || "weapon") !== itemFilterSlot) return false;
                        if (itemFilter.trim()) {
                          const q = itemFilter.trim().toLowerCase();
                          const name = t(String(it.nameKey)).toLowerCase();
                          if (!name.includes(q)) return false;
                        }
                        return true;
                      }).length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">Nenhum item encontrado.</div>
                      )}
                    </div>
                  )}

                  {sendKind === "skin" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-3">
                        <select value={sendSkinId} onChange={(e) => setSendSkinId(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none">
                          <option value="">— selecionar skin —</option>
                          {SKIN_CATALOG.map((s) => (
                            <option key={s.id} value={s.id}>{CLASS_ICONS[s.className]} {t(s.nameKey)}</option>
                          ))}
                        </select>
                        <div className="bg-[#0a0a12] border border-white/10 rounded-xl px-4 py-3 text-xs text-gray-400 flex items-center">
                          ⚠️ A skin vai ao correio como presente e aparecerá para o jogador resgatar.
                        </div>
                      </div>
                      {(() => {
                        const previewSkin = SKIN_CATALOG.find((s) => s.id === sendSkinId) || null;
                        return previewSkin ? (
                          <div className="bg-[#0a0a12] border border-white/10 rounded-xl overflow-hidden">
                            <div className="relative">
                              <img src={previewSkin.image} alt={t(previewSkin.nameKey)} className="w-full h-40 object-cover" />
                              <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full text-black"
                                style={{ background: RARITY_COLORS[previewSkin.rarity] }}>
                                {previewSkin.rarity.toUpperCase()}
                              </span>
                            </div>
                            <div className="p-3">
                              <div className="font-bold text-white text-sm">{CLASS_ICONS[previewSkin.className]} {t(previewSkin.nameKey)}</div>
                              <div className="text-[11px] text-gray-400">Classe: {t(`class.${previewSkin.className}`)}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-40 bg-[#0a0a12] border border-dashed border-white/15 rounded-xl flex items-center justify-center text-gray-600 text-sm px-4 text-center">
                            👀 Selecione uma skin para ver a pré-visualização
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <button onClick={sendGift}
                    className="w-full bg-[#ff6b6b] hover:bg-[#e94560] text-white rounded-xl py-3 font-black transition">
                    📨 Enviar para o correio
                  </button>
                </div>
              </div>
            )}
            {tab === "guilds" && (
              <div>
                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="space-y-2">
                    {Array.isArray((data as { guilds?: unknown[] }).guilds) && ((data as { guilds: Record<string, unknown>[] }).guilds).map((g) => (
                      <div key={String(g.id)} className="bg-[#1a1a2e] rounded-xl p-3 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {g.logo ? (
                            <img src={String(g.logo)} alt="" className="w-10 h-10 rounded-xl border border-white/10 object-cover" />
                          ) : (
                            <span className="text-2xl">{String(g.icon || "🏰")}</span>
                          )}
                          <div>
                            <div className="font-bold text-white">{String(g.name)}</div>
                            <div className="text-xs text-gray-400">
                              Líder: {String(g.leaderId || "—")} • Membros: {Array.isArray(g.members) ? g.members.length : 0}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono">{String(g.id)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {Array.isArray((data as { guilds?: unknown[] }).guilds) && (data as { guilds: unknown[] }).guilds.length === 0 && (
                      <div className="text-center py-10 text-gray-500">Nenhuma guilda criada.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "excluded" && (
              <div>
                <p className="text-xs text-gray-400 mb-4 bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3">
                  🗂️ Contas <b className="text-red-400">excluídas (soft delete)</b> ficam aqui — o jogador perde o acesso imediatamente, mas o progresso é preservado. Use <b className="text-green-400">Restaurar</b> para devolver o acesso ou <b className="text-red-400">Apagar de vez</b> para remover tudo permanentemente.
                </p>
                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="space-y-3">
                    {Array.isArray((data as { excluded?: unknown[] }).excluded) && ((data as { excluded: Record<string, unknown>[] }).excluded).map((e) => (
                      <div key={String(e.userId)} className="bg-[#1a1a2e] rounded-xl p-4 border border-red-500/30">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              🚫 {String(e.username)}
                              {e.stillExists === false && <span className="text-[10px] bg-gray-800 rounded-full px-2 py-0.5 text-gray-500">conta já apagada do banco</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Excluída em <b className="text-gray-300">{new Date(e.excludedAt as string).toLocaleString()}</b>
                            </div>
                            <div className="text-xs text-gray-400">Motivo: <b className="text-[#ffd700]">{String(e.reason)}</b></div>
                            {Array.isArray(e.characterNames) && (e.characterNames as string[]).length > 0 && (
                              <div className="text-[11px] text-gray-500 mt-1">
                                Personagens: {(e.characterNames as string[]).map((n) => <span key={n} className="bg-[#0a0a12] border border-white/10 rounded px-1.5 py-0.5 mr-1">{n}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => restoreUser(String(e.userId), String(e.username))} disabled={busy === `res_${e.userId}`}
                              className="text-xs px-3 py-1.5 rounded-lg font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-40">
                              {busy === `res_${e.userId}` ? "..." : "↩️ Restaurar"}
                            </button>
                            <button onClick={() => hardDeleteUser(String(e.userId), String(e.username))} disabled={busy === `hard_${e.userId}`}
                              className="text-xs px-3 py-1.5 rounded-lg font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40">
                              {busy === `hard_${e.userId}` ? "..." : "💥 Apagar de vez"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {Array.isArray((data as { excluded?: unknown[] }).excluded) && (data as { excluded: unknown[] }).excluded.length === 0 && (
                      <div className="text-center py-12 text-gray-500 bg-[#1a1a2e] border border-dashed border-gray-700 rounded-2xl">
                        🎉 Nenhuma conta excluída no momento.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === "music" && (
              <div>
                <p className="text-xs text-gray-400 mb-4 bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3">
                  🎵 Envie uma música (mp3, ogg, wav, m4a, webm — até 25MB) para cada ilha. Ela tocará em loop enquanto o jogador estiver na ilha. Os arquivos ficam em <b className="text-gray-300">public/uploads/music</b>.
                </p>
                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {REGIONS.map((r) => {
                      const rec = audioByRegion[r.id];
                      return (
                        <div key={r.id} className="bg-[#1a1a2e] rounded-2xl p-4 border border-white/10">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{regionIcons[r.id] || "🏝️"}</span>
                            <div>
                              <div className="font-bold text-white">{t(`region.${r.id}`)}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{r.id}</div>
                            </div>
                          </div>
                          {rec ? (
                            <div className="bg-[#0a0a12] rounded-xl p-3 border border-green-500/30 mb-3">
                              <div className="text-xs text-green-300 mb-2">✅ {String(rec.fileName || "arquivo")}</div>
                              <div className="flex gap-2">
                                <a href={String(rec.url)} target="_blank" rel="noreferrer"
                                  className="text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1.5 font-bold">▶️ Ouvir</a>
                                <button onClick={() => removeMusic(r.id)} disabled={busy === `rmmusic_${r.id}`}
                                  className="text-xs bg-red-600/80 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">
                                  {busy === `rmmusic_${r.id}` ? "..." : "🗑️ Remover"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-600 mb-3 bg-[#0a0a12] rounded-xl p-3 border border-dashed border-gray-700 text-center">
                              Sem música — o jogo fica em silêncio nesta ilha.
                            </div>
                          )}
                          <label className={`block text-center cursor-pointer rounded-xl border border-dashed border-[#ffd700]/40 hover:border-[#ffd700] transition p-3 text-xs text-[#ffd700] font-bold ${busy === `music_${r.id}` ? "opacity-40" : ""}`}>
                            {busy === `music_${r.id}` ? "Enviando..." : "📤 Enviar música"}
                            <input
                              type="file"
                              accept=".mp3,.ogg,.wav,.m4a,.webm,audio/*"
                              className="hidden"
                              disabled={busy === `music_${r.id}`}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadMusic(r.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {tab === "server" && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Mensagem global */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-[#ffd700] mb-1">📢 Mensagem Global</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Envie uma mensagem para <b className="text-gray-300">todos os jogadores</b>. Escolha o visual abaixo, escreva e clique em enviar. Deixe vazio e salve para remover o aviso.
                  </p>

                  <label className="block text-xs text-gray-500 mb-2">Como exibir</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setServerStyle("banner")}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${serverStyle === "banner" ? "border-[#ffd700] bg-[#ffd700]/10" : "border-gray-700 bg-[#0a0a12] hover:border-white/30"}`}
                    >
                      <div className="text-sm font-bold text-white">Faixa no topo</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">fixa no topo até você remover</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServerStyle("popup")}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${serverStyle === "popup" ? "border-[#ffd700] bg-[#ffd700]/10" : "border-gray-700 bg-[#0a0a12] hover:border-white/30"}`}
                    >
                      <div className="text-sm font-bold text-white">Notificação popup</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">central, aparece 1 vez e some</div>
                    </button>
                  </div>

                  <textarea
                    value={serverAnnouncement}
                    onChange={(e) => setServerAnnouncement(e.target.value)}
                    placeholder={serverStyle === "popup" ? "Escreva o aviso que vai aparecer uma única vez..." : "Escreva a mensagem que fica no topo..."}
                    rows={4}
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none resize-none mb-3"
                  />
                  <button onClick={saveServerSettings} disabled={busy === "server"}
                    className="w-full bg-[#ffd700] text-black rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40 hover:opacity-90">
                    {busy === "server" ? "Enviando..." : serverStyle === "popup" ? "📨 Enviar notificação (1x)" : "💾 Enviar / Atualizar mensagem"}
                  </button>
                </div>

                {/* Manutenção */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-[#ff6b6b]">🛠️ Manutenção do Servidor</h3>
                    <button
                      onClick={() => setServerMaintenance(!serverMaintenance)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${serverMaintenance ? "bg-red-600" : "bg-gray-700"}`}
                      aria-pressed={serverMaintenance}
                    >
                      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${serverMaintenance ? "translate-x-7" : ""}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Ligue para <b className="text-gray-300">bloquear o jogo para todos</b> (tela de manutenção) enquanto você ajusta o servidor.
                  </p>
                  <label className="block text-xs text-gray-500 mb-1">Mensagem da manutenção</label>
                  <textarea
                    value={serverMaintenanceMsg}
                    onChange={(e) => setServerMaintenanceMsg(e.target.value)}
                    placeholder="Estamos realizando melhorias. Volte em breve!"
                    rows={3}
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[#ff6b6b] focus:outline-none resize-none mb-3"
                  />
                  <label className="block text-xs text-gray-500 mb-1">⏳ Volta às (horário de término)</label>
                  <input
                    type="datetime-local"
                    value={serverMaintenanceUntil}
                    onChange={(e) => setServerMaintenanceUntil(e.target.value)}
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-[#ff6b6b] focus:outline-none mb-1"
                  />
                  <p className="text-[10px] text-gray-500 mb-3">
                    Os jogadores veem um <b className="text-gray-300">cooldown ao vivo</b> na tela de manutenção até essa hora. Deixe vazio para mensagem genérica.
                  </p>
                  <button onClick={saveMaintenance} disabled={busy === "server"}
                    className="w-full bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40">
                    {busy === "server" ? "Salvando..." : "💾 Salvar manutenção"}
                  </button>
                </div>

                {/* Energia infinita */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10 md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h3 className="text-sm font-bold text-[#ffd700]">⚡ Energia Infinita (Todos)</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Quando ativado, <b className="text-[#ffd700]">nenhum jogador gasta energia</b> ao iniciar missões ou masmorras — a energia fica sempre no máximo. Desative para voltar ao normal.
                      </p>
                    </div>
                    <button
                      onClick={toggleInfiniteEnergy}
                      disabled={busy === "infinite_energy"}
                      className={`relative w-16 h-9 rounded-full transition-colors shrink-0 ${infiniteEnergy ? "bg-[#ffd700]" : "bg-gray-700"} ${busy === "infinite_energy" ? "opacity-50" : ""}`}
                      aria-pressed={infiniteEnergy}
                    >
                      <span className={`absolute top-1 left-1 w-7 h-7 rounded-full bg-white shadow transition-transform ${infiniteEnergy ? "translate-x-7" : ""}`} />
                    </button>
                  </div>
                  <div className={`mt-3 text-center rounded-xl py-2 text-sm font-black ${infiniteEnergy ? "bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700]" : "bg-[#0a0a12] border border-gray-700 text-gray-500"}`}>
                    {infiniteEnergy ? "⚡ ATIVA — energia infinita para todos" : "❄️ Desativada — custo de energia normal"}
                  </div>
                </div>
              </div>
            )}
{tab === "codes" && (
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-[#a855f7] mb-1">🎟️ Gerar Código de Resgate</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    O jogador resgata no jogo (aba <b className="text-gray-300">Usar Código</b>) e recebe o boost:
                    <b className="text-[#ffd700]"> 2x XP</b> + <b className="text-[#4ecdc4]">2x Energia</b> (recarga por 2x).
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Boost XP (horas)</label>
                      <input value={codeXpHours} onChange={(e) => setCodeXpHours(e.target.value)} type="number" min="0"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#a855f7] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Boost Energia (horas)</label>
                      <input value={codeEnergyHours} onChange={(e) => setCodeEnergyHours(e.target.value)} type="number" min="0"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#a855f7] focus:outline-none" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">Código (vazio = gerar automaticamente)</label>
                    <input value={codeValue} onChange={(e) => setCodeValue(e.target.value.toUpperCase())} placeholder="EX: BEMVINDO2026"
                      className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white tracking-widest font-mono uppercase focus:border-[#a855f7] focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Limite de usos (0 = ∞)</label>
                      <input value={codeMaxUses} onChange={(e) => setCodeMaxUses(e.target.value)} type="number" min="0"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#a855f7] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Válido por (dias, 0 = sem validade)</label>
                      <input value={codeExpiresDays} onChange={(e) => setCodeExpiresDays(e.target.value)} type="number" min="0"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#a855f7] focus:outline-none" />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-1">Rótulo / mensagem</label>
                    <input value={codeLabel} onChange={(e) => setCodeLabel(e.target.value)}
                      className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#a855f7] focus:outline-none" />
                  </div>
                  <button onClick={createCode} disabled={busy === "create_code"}
                    className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40">
                    {busy === "create_code" ? "Gerando..." : "🎟️ Gerar Código"}
                  </button>
                </div>
<div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-4">📋 Códigos criados ({codesList.length})</h3>
                  {loading && codesList.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-10">Carregando...</div>
                  ) : codesList.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-10">Nenhum código criado ainda.</div>
                  ) : (
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                      {codesList.map((c) => {
                        const used = Array.isArray(c.redeemedBy) ? c.redeemedBy.length : 0;
                        const maxUses = Number(c.maxUses) || 0;
                        const expired = c.expiresAt ? new Date(String(c.expiresAt)).getTime() < Date.now() : false;
                        return (
                          <div key={c.id as string} className="rounded-xl border border-white/10 bg-[#0a0a12] p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono font-bold tracking-widest text-[#ffd700]">{String(c.code)}</span>
                              {expired && <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 rounded-full px-2 py-0.5">Expirado</span>}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {Number(c.xpHours) > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffd700]/10 border border-[#ffd700]/40 text-[#ffd700]">2x XP • {String(c.xpHours)}h</span>}
                              {Number(c.energyHours) > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4ecdc4]/10 border border-[#4ecdc4]/40 text-[#4ecdc4]">2x Energia • {String(c.energyHours)}h</span>}
                            </div>
                            <p className="text-[11px] text-gray-400 mb-1.5">💬 {String(c.label || "Boost 2x")}</p>
                            <p className="text-[11px] text-gray-500 mb-2">
                              🎯 {used}{maxUses > 0 ? ` / ${maxUses}` : ""} usos
                              {c.expiresAt ? ` • até ${new Date(String(c.expiresAt)).toLocaleDateString("pt-BR")}` : ""} • criado {new Date(c.createdAt as string).toLocaleDateString("pt-BR")}
                            </p>
                            <button onClick={() => deleteCode(String(c.id))} disabled={busy === `delcode_${c.id}`}
                              className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg px-2.5 py-1 disabled:opacity-40">
                              {busy === `delcode_${c.id}` ? "Excluindo..." : "🗑️ Excluir"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === "donate" && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Chave PIX */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-[#ff4d6d] mb-1">💖 Donate — Chave PIX</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Define a chave PIX que aparece para os jogadores na aba <b className="text-gray-300">Doar</b>. Deixe vazio para não exibir.
                  </p>
                  <label className="block text-xs text-gray-500 mb-1">Chave PIX</label>
                  <input
                    value={donatePixKey}
                    onChange={(e) => setDonatePixKey(e.target.value)}
                    placeholder="Ex.: email@exemplo.com  ou  (11) 99999-9999"
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#ff4d6d] focus:outline-none mb-4"
                  />
                  <button onClick={saveDonate} disabled={busy === "donate"}
                    className="w-full bg-[#ff4d6d] hover:bg-[#e94560] text-white rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40">
                    {busy === "donate" ? "Salvando..." : "💾 Salvar chave PIX"}
                  </button>
                </div>

                {/* QR Code */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-1">📱 QR Code para doação</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Envie uma imagem do seu QR Code PIX para mostrar aos jogadores (opcional).
                  </p>

                  {donateQrCode && (
                    <div className="mb-4 flex flex-col items-center gap-2">
                      <img src={donateQrCode} alt="QR Code" className="w-44 h-44 object-contain rounded-xl bg-white p-2" />
                      <p className="text-[10px] text-gray-500 font-mono break-all text-center">{donateQrCode}</p>
                    </div>
                  )}

                  <label className={`block text-center cursor-pointer rounded-xl border border-dashed border-[#ff4d6d]/40 hover:border-[#ff4d6d] transition p-4 text-xs text-[#ff4d6d] font-bold ${busy === "donate_qr" ? "opacity-40" : ""}`}>
                    {busy === "donate_qr" ? "Enviando..." : donateQrCode ? "🔄 Trocar QR Code" : "📤 Enviar QR Code"}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,image/*"
                      className="hidden"
                      disabled={busy === "donate_qr"}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadDonateQr(f);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {donateQrCode && (
                    <button
                      onClick={() => { setDonateQrCode(""); callAdmin({ action: "update_server_settings", donateQrCode: "" }); }}
                      disabled={busy === "donate_qr"}
                      className="mt-3 w-full text-red-400 hover:text-red-300 text-xs border border-red-500/30 hover:border-red-500 rounded-xl px-4 py-2 font-bold disabled:opacity-40"
                    >
                      🗑️ Remover QR Code
                    </button>
                  )}
                </div>
              </div>
            )}
            {tab === "test" && (
              <div className="space-y-4">
                {/* Ativar/desativar modo teste */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-[#4ecdc4] mb-1">🧪 Modo Teste — jogar durante a manutenção</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Ativa uma <b className="text-[#4ecdc4]">rota de teste</b> neste navegador: mesmo com o servidor em
                    <b className="text-red-400"> manutenção</b>, você consegue abrir e jogar normalmente para testar
                    funcionalidades. Só vale neste computador (localStorage) — jogadores continuam bloqueados.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={toggleTestMode}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${testMode ? "bg-[#4ecdc4] text-black shadow-lg" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                      {testMode ? "🟢 Modo teste ATIVO" : "⚪ Ativar modo teste"}
                    </button>
                    <a href="/" target="_blank" rel="noreferrer"
                      className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#ff6b6b] hover:bg-[#ff5252] text-white">
                      ▶️ Abrir o jogo
                    </a>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3">
                    {testMode
                      ? "✅ Ativo neste navegador. A tela de manutenção é ignorada e um selo 🧪 aparece no canto do jogo."
                      : "Ao ativar, abra o jogo em nova aba — a manutenção não vai bloquear sua sessão de teste."}
                  </p>
                </div>

                {/* Como funciona */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-2">ℹ️ Como funciona</h3>
                  <ul className="text-xs text-gray-400 space-y-1.5 list-disc pl-4">
                    <li>O bloqueio de manutenção é só visual (tela do ServerNotice) — as APIs do jogo continuam no ar.</li>
                    <li>Com o modo teste ativo, a tela de manutenção some e você joga normalmente, com um selo 🧪 no canto.</li>
                    <li>Desative depois de testar para os jogadores voltarem a ver a manutenção normalmente.</li>
                  </ul>
                </div>
              </div>
            )}
            {tab === "pix" && (
              <div className="space-y-4">
                {/* Conversão de diamantes por real */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-[#a855f7] mb-1">💎 Loja de Diamantes — Conversão</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Define quantos <b className="text-[#a855f7]">diamantes valem R$ 1</b> na loja PIX do jogo (aba Diamantes). Pacotes fixos: R$ 5, 10, 20, 50 e 100.
                  </p>
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="w-48">
                      <label className="block text-xs text-gray-500 mb-1">💎 Diamantes por R$ 1</label>
                      <input type="number" min={1} value={diamondsPerReal} onChange={(e) => setDiamondsPerReal(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-[#a855f7] focus:outline-none" />
                    </div>
                    <div className="text-xs text-gray-400 pb-2.5 flex flex-wrap gap-1.5">
                      {[5, 10, 20, 50, 100].map((v) => {
                        const rate = Math.max(1, Math.floor(Number(diamondsPerReal) || 1000));
                        return (
                          <span key={v} className="inline-block bg-[#0a0a12] border border-white/10 rounded-lg px-2 py-1">
                            R$ {v} = 💎 {(v * rate).toLocaleString()}
                          </span>
                        );
                      })}
                    </div>
                    <button onClick={saveDiamondsPerReal} disabled={busy === "pix_rate"}
                      className="bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40">
                      {busy === "pix_rate" ? "Salvando..." : "💾 Salvar conversão"}
                    </button>
                  </div>
                </div>

                {/* Compras aguardando aprovação */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-1">📥 Compras PIX ({purchases.length})</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    O jogador envia o comprovante pelo jogo (aba Diamantes). <b className="text-green-400">Aprovar</b> credita os diamantes no personagem; <b className="text-red-400">Rejeitar</b> recusa sem creditar.
                  </p>
                  {loading && purchases.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-10">Carregando...</div>
                  ) : purchases.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-10">Nenhuma compra registrada ainda.</div>
                  ) : (
                    <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                      {purchases.map((p) => {
                        const status = String(p.status || "pending");
                        const statusBadge = status === "approved"
                          ? <span className="text-[10px] bg-green-500/20 border border-green-500/40 text-green-300 rounded-full px-2 py-0.5">✅ Aprovada</span>
                          : status === "rejected"
                            ? <span className="text-[10px] bg-red-500/20 border border-red-500/40 text-red-300 rounded-full px-2 py-0.5">❌ Rejeitada</span>
                            : <span className="text-[10px] bg-[#ffd700]/20 border border-[#ffd700]/40 text-[#ffd700] rounded-full px-2 py-0.5">⏳ Pendente</span>;
                        return (
                          <div key={String(p.id)} className="rounded-xl border border-white/10 bg-[#0a0a12] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">👤 {String(p.characterName || "—")}</span>
                                <span className="text-xs text-[#a855f7] font-black">💎 {Number(p.diamonds || 0).toLocaleString()}</span>
                                <span className="text-xs text-gray-400">R$ {String(p.valueBRL)}</span>
                                {statusBadge}
                              </div>
                              <span className="text-[10px] text-gray-500">
                                {p.createdAt ? new Date(String(p.createdAt)).toLocaleString("pt-BR") : "—"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {p.screenshotUrl ? (
                                <a href={String(p.screenshotUrl)} target="_blank" rel="noreferrer"
                                  className="text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1 font-bold">
                                  🖼️ Ver comprovante
                                </a>
                              ) : (
                                <span className="text-[10px] text-gray-600">sem screenshot</span>
                              )}
                              {status === "pending" && (
                                <div className="flex gap-2 ml-auto">
                                  <button onClick={() => decidePurchase(p, true)} disabled={busy === `pix_${String(p.id)}`}
                                    className="text-[11px] bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">
                                    {busy === `pix_${String(p.id)}` ? "..." : "✅ Aprovar"}
                                  </button>
                                  <button onClick={() => decidePurchase(p, false)} disabled={busy === `pix_${String(p.id)}`}
                                    className="text-[11px] bg-red-600/80 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">
                                    ❌ Rejeitar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === "reports" && (
              <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                <h3 className="text-sm font-bold text-white mb-4">
                  📝 Reportes dos jogadores ({((data.reports as unknown[]) || []).length})
                </h3>
                {loading ? (
                  <div className="text-center text-gray-500 text-sm py-10">Carregando...</div>
                ) : !Array.isArray(data.reports) || data.reports.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-10">Nenhum reporte enviado ainda.</div>
                ) : (
                  <div className="space-y-3">
                    {(data.reports as Record<string, unknown>[]).map((r) => (
                      <div key={r.id as string} className={`rounded-xl border p-3 ${r.type === "bug" ? "border-red-500/40 bg-red-500/5" : "border-[#4ecdc4]/40 bg-[#4ecdc4]/5"}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-xs font-bold ${r.type === "bug" ? "text-red-300" : "text-[#4ecdc4]"}`}>
                            {r.type === "bug" ? "🐛 Bug" : "💡 Feedback"}
                          </span>
                          <span className="text-[10px] text-gray-500">{new Date(r.createdAt as string).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1.5 text-[11px] text-gray-400">
                          <span className="font-bold text-white">{String(r.characterName || "—")}</span>
                          <span>Lv.{String(r.level ?? "—")}</span>
                          <span>{String(r.classType || "")}</span>
                          {r.category ? <span className="px-1.5 py-0.5 rounded bg-white/10">{String(r.category)}</span> : null}
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2">{String(r.message || "")}</p>
                        <button onClick={() => deleteReport(String(r.id))} disabled={busy === `delrep_${r.id}`}
                          className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg px-2.5 py-1 disabled:opacity-40">
                          {busy === `delrep_${r.id}` ? "Excluindo..." : "🗑️ Excluir"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
      </div>
    </div>
  );
}