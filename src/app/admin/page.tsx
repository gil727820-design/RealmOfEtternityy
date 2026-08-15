"use client";
import { useState, useEffect, useRef } from "react";
import { RARITY_COLORS, CLASS_ICONS, REGIONS, TOWER_BOSS_KINDS, MAX_LEVEL } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { SKIN_CATALOG } from "@/game/skins";
import { VIP_TIERS, currentVipTier } from "@/game/vip";

/** Nomes bonitos dos tiers VIP exibidos no painel. */
const VIP_LABELS: Record<string, string> = {
  bronze: "Bronze", silver: "Prata", gold: "Ouro", platinum: "Platina",
  diamond: "Diamante", master: "Mestre", legend: "Lenda", emperor: "Imperador",
};
import { t } from "@/i18n";

// A chave NÃO fica mais no cliente: o /api/admin/login valida no servidor e
// grava um cookie httpOnly (`roe_admin`). O navegador nunca guarda a chave
// (nem em memória, nem em localStorage) — “lembrar de mim” só prolonga o
// cookie no servidor. O header x-admin-key foi mantido apenas por
// compatibilidade com sessões antigas.
const ADMIN_KEY_STORAGE_LEGACY = "realm_admin_key";

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

type Tab = "dash" | "users" | "characters" | "guilds" | "send" | "excluded" | "music" | "server" | "codes" | "logs" | "donate" | "pix" | "ghost" | "worldboss" | "test";
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

/** Status que o ADM pode dar/tirar do personagem (ajuste rápido). */
const STAT_ADJUST_OPTIONS = [
  { id: "attack", label: "⚔️ Ataque" },
  { id: "defense", label: "🛡️ Defesa" },
  { id: "speed", label: "👟 Velocidade" },
  { id: "critical", label: "💥 Crítico" },
  { id: "maxHp", label: "❤️ Vida máx" },
  { id: "mana", label: "🔮 Mana máx" },
  { id: "precision", label: "🎯 Precisão" },
  { id: "dodge", label: "💨 Esquiva" },
  { id: "resistance", label: "🛡️ Resistência" },
  { id: "energy", label: "⚡ Energia" },
  { id: "gold", label: "💰 Ouro" },
  { id: "diamonds", label: "💎 Diamantes" },
  { id: "crystals", label: "🔮 Cristais" },
  { id: "towerCoins", label: "🗼 Moedas da torre" },
  { id: "pvpCoins", label: "⚔️ Moedas PvP" },
  { id: "guildCoins", label: "🏰 Moedas de guilda" },
  { id: "xp", label: "✨ XP" },
  { id: "unspentStatPoints", label: "🎯 Pontos de status" },
];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  // "Lembrar de mim" agora só controla a validade do cookie httpOnly no
  // servidor (30 dias vs. sessão do navegador) — a chave não fica no localStorage.
  const [rememberMe, setRememberMe] = useState(false);
  // Chave digitada, usada apenas para o login (não é persistida).
  const [adminKey, setAdminKey] = useState<string>("");
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
  // Ajuste de status por personagem (dar/tirar)
  const [adjStat, setAdjStat] = useState<Record<string, string>>({});
  const [adjAmount, setAdjAmount] = useState<Record<string, string>>({});
  // VIP por personagem (tier selecionado em cada linha)
  const [vipSelects, setVipSelects] = useState<Record<string, string>>({});
  // Loja Fantasma (moedas da torre)
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ghostSchedule, setGhostSchedule] = useState<string[]>(["12:00", "18:00", "21:00"]);
  const [ghostTime, setGhostTime] = useState("12:00");
  const [ghostDuration, setGhostDuration] = useState("60");
  const [ghostItems, setGhostItems] = useState<Array<{ templateId: number; price: string; quantity: string }>>([]);
  const [ghostItemSearch, setGhostItemSearch] = useState("");
  const [ghostLoaded, setGhostLoaded] = useState(false);
  // Evento Global (Boss Mundial)
  const [wbEnabled, setWbEnabled] = useState(false);
  const [wbSchedule, setWbSchedule] = useState<string[]>(["12:00", "18:00", "21:00"]);
  const [wbTime, setWbTime] = useState("12:00");
  const [wbDuration, setWbDuration] = useState("60");
  const [wbBossKind, setWbBossKind] = useState("void_wyrm");
  const [wbMaxHp, setWbMaxHp] = useState("10000000");
  const [wbAttack, setWbAttack] = useState("260");
  const [wbDefense, setWbDefense] = useState("120");
  const [wbSpeed, setWbSpeed] = useState("8");
  const [wbCritical, setWbCritical] = useState("12");
  const [wbGold, setWbGold] = useState("500000");
  const [wbXp, setWbXp] = useState("60000");
  const [wbCoins, setWbCoins] = useState("1000");
  const [wbSquadSize, setWbSquadSize] = useState("4");
  const [wbCooldown, setWbCooldown] = useState("5");
  const [wbLoaded, setWbLoaded] = useState(false);
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
  // Limites/balanceamento: torre (andar máx.), nível máx. e XP da torre
  const [limitMaxTowerFloor, setLimitMaxTowerFloor] = useState("0");
  const [limitMaxLevel, setLimitMaxLevel] = useState("0");
  const [limitTowerXpMult, setLimitTowerXpMult] = useState("1");
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
  // Logs administrativos (hitkill etc.)
  const [logsList, setLogsList] = useState<Record<string, unknown>[]>([]);
  const [logsFilter, setLogsFilter] = useState("all"); // "all" | "hitkill" | "economy"

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
        body: JSON.stringify({ key: typed, rememberMe }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error || "Chave inválida!");
        return;
      }
      // A sessão vira cookie httpOnly no servidor — nada de chave no navegador.
      setAdminKey("");
      setAuthenticated(true);
      setMessage("");
      // Limpa a chave antiga que ficava no localStorage (migração).
      try { localStorage.removeItem(ADMIN_KEY_STORAGE_LEGACY); } catch { /* ignora */ }
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

  // ---- Logs administrativos (hitkill, economia etc.) ----
  const logKindParam = () => (logsFilter === "hitkill" || logsFilter === "economy" ? logsFilter : "");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const kind = logKindParam();
      const res = await fetch(`/api/admin?action=logs&kind=${encodeURIComponent(kind)}&limit=200`, { headers });
      const d = await res.json();
      setLogsList(Array.isArray(d.logs) ? (d.logs as Record<string, unknown>[]) : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const clearLogs = async (kind: string) => {
    const label = kind === "hitkill" ? "os logs de hitkill" : kind === "economy" ? "os logs de economia" : "TODOS os logs";
    if (!window.confirm(`Apagar ${label}? Essa ação não pode ser desfeita.`)) return;
    setBusy("clear_logs");
    const d = await callAdmin({ action: "clear_logs", kind: logKindParam() });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Erro"}`);
    await loadLogs();
    setBusy(null);
  };

  useEffect(() => {
    if (!authenticated) return;
    const run = ({
      dash: loadDashboard,
      users: loadUsers,
      characters: loadCharacters,
      guilds: loadGuilds,
      send: async () => { await loadCharacters(); await loadItems(); },
      ghost: loadGhostShop,
      worldboss: loadWorldBoss,
      excluded: loadExcluded,
      music: loadMusic,
      server: undefined,
      codes: loadCodes,
      logs: loadLogs,
      donate: loadDonateSettings,
      pix: loadPurchases,
    } as Record<Tab, (() => Promise<void>) | undefined>)[tab];
    if (run) {
      const id = setTimeout(() => { void run(); }, 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authenticated, logsFilter]);
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

  const setVip = async (c: Record<string, unknown>) => {
    if (busy) return;
    const tier = vipSelects[String(c.id)];
    if (!tier) {
      setMessage("❌ Selecione um tier VIP no menu ao lado antes de setar.");
      return;
    }
    const name = String(c.name);
    const tierLabel = VIP_LABELS[tier] || tier;
    if (!window.confirm(`👑 Ativar VIP ${tierLabel} para "${name}"? (30 dias)`)) return;
    setBusy(`vip_set_${String(c.id)}`);
    const d = await callAdmin({ action: "set_vip", characterId: c.id, tier });
    setMessage(d.success ? `✅ ${d.message || "VIP ativado!"}` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  const removeVip = async (c: Record<string, unknown>) => {
    if (busy) return;
    const name = String(c.name);
    if (!window.confirm(`👑 Remover o VIP de "${name}"?`)) return;
    setBusy(`vip_rm_${String(c.id)}`);
    const d = await callAdmin({ action: "remove_vip", characterId: c.id });
    setMessage(d.success ? `✅ ${d.message || "VIP removido!"}` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
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

  /** Dar ou TIRAR status do personagem (amount pode ser negativo). */
  const adjustStats = async (c: Record<string, unknown>) => {
    if (busy) return;
    const stat = adjStat[String(c.id)];
    const raw = adjAmount[String(c.id)];
    const amount = Math.floor(Number(raw));
    if (!stat || raw === "" || !Number.isFinite(amount) || amount === 0) {
      setMessage("❌ Selecione o status e informe um valor diferente de 0 (negativo tira).");
      return;
    }
    const name = String(c.name);
    if (!window.confirm(`⚖️ ${amount > 0 ? "DAR" : "TIRAR"} ${Math.abs(amount)} em "${stat}" de "${name}"?`)) return;
    setBusy(`adj_${String(c.id)}`);
    const d = await callAdmin({ action: "adjust_stats", characterId: c.id, stat, amount });
    setMessage(d.success ? `✅ ${d.message || "Ajustado!"}` : `❌ ${d.error || "Falha"}`);
    await loadCharacters();
    setBusy(null);
  };

  /** Recalcula os status a partir do que está equipado (raridade × runas × encanto). */
  const recalcEquipment = async (c?: Record<string, unknown>) => {
    if (busy) return;
    const scope = c ? `do personagem "${String(c.name)}"` : "de TODOS os personagens";
    if (!window.confirm(
      `⚙️ Recalcular equipamentos ${scope}?\n\nReaplica nos status o multiplicador por raridade (comum ×1 → supremo ×8.8) + runas + encanto, conforme o que está equipado agora.`
    )) return;
    setBusy(c ? `recalc_${String(c.id)}` : "recalc_all");
    const d = await callAdmin(c
      ? { action: "recalc_equipment", characterId: c.id }
      : { action: "recalc_equipment" });
    setMessage(d.success ? `✅ ${d.message || "Recalculado!"}` : `❌ ${d.error || "Falha"}`);
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
      `⚠️ TEM CERTEZA ABSOLUTA?\n\nIsso apaga TODOS os jogadores, personagens, guildas, inventário, correio e códigos usados.\nO catálogo de itens e missões é mantido.\n\nNÃO há como desfazer!`
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
    setMessage(d.success ? `✅ Senha de "${username}" redefinida com sucesso!` : `❌ ${d.error || "Falha"}`);
    await loadUsers();
    setBusy(null);
  };
  // ---- Loja Fantasma (moedas da torre) ----

  /** Carrega a configuração da Loja Fantasma + catálogo de itens para o seletor. */
  const loadGhostShop = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=settings`, { headers });
      const d = await res.json();
      const s = (d.settings || {}) as Record<string, unknown>;
      const gs = (s.ghostShop || {}) as Record<string, unknown>;
      setGhostEnabled(!!gs.enabled);
      setGhostSchedule(Array.isArray(gs.schedule) ? (gs.schedule as string[]) : []);
      setGhostDuration(String(Math.max(1, Math.floor(Number(gs.durationMinutes) || 60))));
      setGhostItems(
        Array.isArray(gs.items)
          ? (gs.items as Array<Record<string, unknown>>).map((it) => ({
              templateId: Number(it.templateId),
              price: String(Number(it.price) || 0),
              quantity: String(Math.max(1, Math.floor(Number(it.quantity) || 1))),
            }))
          : []
      );
    } catch { /* ignora */ }
    await loadItems();
    setGhostLoaded(true);
    setLoading(false);
  };

  /** Adiciona um horário de abertura (HH:MM) à lista. */
  const addGhostTime = () => {
    const tVal = ghostTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(tVal)) {
      setMessage("❌ Horário inválido — use o formato HH:MM.");
      return;
    }
    const [h, m] = tVal.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      setMessage("❌ Horário fora do intervalo válido (00:00–23:59).");
      return;
    }
    const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (ghostSchedule.includes(normalized)) {
      setMessage("⚠️ Esse horário já está na lista.");
      return;
    }
    setGhostSchedule((prev) => [...prev, normalized].sort());
    setMessage("");
  };

  /** Adiciona um item do catálogo à lista da loja (com preço em moedas da torre). */
  const addGhostItem = (templateId: number) => {
    if (ghostItems.some((it) => it.templateId === templateId)) {
      setMessage("⚠️ Esse item já está na loja.");
      return;
    }
    setGhostItems((prev) => [...prev, { templateId, price: "500", quantity: "1" }]);
    setMessage("");
  };

  /** Salva a configuração completa da Loja Fantasma no servidor. */
  const saveGhostShop = async () => {
    if (ghostSchedule.length === 0) {
      setMessage("❌ Adicione ao menos 1 horário de abertura.");
      return;
    }
    setBusy("ghost");
    const items = ghostItems.map((it) => ({
      templateId: it.templateId,
      price: Math.max(0, Math.floor(Number(it.price) || 0)),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
    }));
    const d = await callAdmin({
      action: "update_server_settings",
      ghostShop: {
        enabled: ghostEnabled,
        schedule: ghostSchedule,
        durationMinutes: Math.max(1, Math.floor(Number(ghostDuration) || 60)),
        items,
      },
    });
    setMessage(
      d.success
        ? ghostEnabled
          ? `✅ Loja Fantasma salva! Abre às ${ghostSchedule.join(", ")} por ${Math.max(1, Math.floor(Number(ghostDuration) || 60))} min (${items.length} item(ns)).`
          : "✅ Loja Fantasma salva (DESATIVADA — os jogadores veem a tela de fechada)."
        : `❌ ${d.error || "Erro"}`
    );
    setBusy(null);
  };

  // ---- Evento Global (Boss Mundial) ----

  /** Carrega a configuração do Boss Mundial salva no servidor. */
  const loadWorldBoss = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=settings`, { headers });
      const d = await res.json();
      const s = (d.settings || {}) as Record<string, unknown>;
      const wb = (s.worldBoss || {}) as Record<string, unknown>;
      const boss = (wb.boss || {}) as Record<string, unknown>;
      const rewards = (wb.rewards || {}) as Record<string, unknown>;
      setWbEnabled(!!wb.enabled);
      setWbSchedule(Array.isArray(wb.schedule) ? (wb.schedule as string[]) : []);
      setWbDuration(String(Math.max(1, Math.floor(Number(wb.durationMinutes) || 60))));
      setWbBossKind(String(boss.kind || "void_wyrm"));
      setWbMaxHp(String(Number(boss.maxHp) || 10000000));
      setWbAttack(String(Number(boss.attack) || 260));
      setWbDefense(String(Number(boss.defense) || 120));
      setWbSpeed(String(Number(boss.speed) || 8));
      setWbCritical(String(Number(boss.critical) || 12));
      setWbGold(String(Number(rewards.gold) || 500000));
      setWbXp(String(Number(rewards.xp) || 60000));
      setWbCoins(String(Number(rewards.towerCoins) || 1000));
      setWbSquadSize(String(Math.max(2, Math.floor(Number(wb.maxSquadSize) || 4))));
      setWbCooldown(String(Math.max(1, Math.floor(Number(wb.attackCooldownSec) || 5))));
    } catch { /* ignora */ }
    setWbLoaded(true);
    setLoading(false);
  };

  /** Adiciona um horário do evento à lista. */
  const addWbTime = () => {
    const tv = wbTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(tv)) {
      setMessage("❌ Horário inválido — use o formato HH:MM.");
      return;
    }
    const [h, m] = tv.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      setMessage("❌ Horário fora do intervalo válido (00:00–23:59).");
      return;
    }
    const norm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (wbSchedule.includes(norm)) {
      setMessage("⚠️ Esse horário já está na lista.");
      return;
    }
    setWbSchedule((prev) => [...prev, norm].sort());
    setMessage("");
  };

  /** Salva a configuração do Evento Global. */
  const saveWorldBoss = async () => {
    if (wbSchedule.length === 0) {
      setMessage("❌ Adicione ao menos 1 horário para o evento acontecer.");
      return;
    }
    setBusy("worldboss");
    const d = await callAdmin({
      action: "update_server_settings",
      worldBoss: {
        enabled: wbEnabled,
        schedule: wbSchedule,
        durationMinutes: Math.max(1, Math.floor(Number(wbDuration) || 60)),
        boss: {
          kind: wbBossKind,
          maxHp: Math.max(100000, Math.floor(Number(wbMaxHp) || 10000000)),
          attack: Math.max(1, Math.floor(Number(wbAttack) || 260)),
          defense: Math.max(0, Math.floor(Number(wbDefense) || 120)),
          speed: Math.max(0, Math.floor(Number(wbSpeed) || 8)),
          critical: Math.min(100, Math.max(0, Math.floor(Number(wbCritical) || 12))),
        },
        rewards: {
          gold: Math.max(0, Math.floor(Number(wbGold) || 0)),
          xp: Math.max(0, Math.floor(Number(wbXp) || 0)),
          towerCoins: Math.max(0, Math.floor(Number(wbCoins) || 0)),
        },
        maxSquadSize: Math.max(2, Math.floor(Number(wbSquadSize) || 4)),
        attackCooldownSec: Math.max(1, Math.floor(Number(wbCooldown) || 5)),
      },
    });
    setMessage(
      d.success
        ? wbEnabled
          ? `✅ Evento salvo! Boss ${wbBossKind} com ${Number(wbMaxHp).toLocaleString()} HP — abre às ${wbSchedule.join(", ")}.`
          : "✅ Evento salvo (DESATIVADO)."
        : `❌ ${d.error || "Erro"}`
    );
    setBusy(null);
  };

  /** Zera o evento em andamento (boss volta com HP cheio na próxima abertura). */
  const resetWorldBoss = async () => {
    if (!window.confirm("Zerar o evento ATUAL? O boss volta com HP cheio na próxima abertura.")) return;
    setBusy("wb_reset");
    const d = await callAdmin({ action: "reset_world_boss" });
    setMessage(d.success ? `✅ ${d.message}` : `❌ ${d.error || "Erro"}`);
    setBusy(null);
  };

  /** Liga/desliga a Loja Fantasma imediatamente (1 clique) — preserva horários, duração e itens. */
  const toggleGhostEnabled = async () => {
    if (busy) return;
    setBusy("ghost_toggle");
    const d = await callAdmin({ action: "toggle_ghost_shop", enabled: !ghostEnabled });
    if (d.success) {
      setGhostEnabled(d.enabled);
      setMessage(`✅ ${d.message || (d.enabled ? "👻 Loja Fantasma ATIVADA!" : "👻 Loja Fantasma DESATIVADA.")}`);
    } else {
      setMessage(`❌ ${d.error || "Erro ao alternar"}`);
    }
    setBusy(null);
  };

  /** Liga/desliga o Evento Global imediatamente (1 clique) — preserva horários, boss e recompensas. */
  const toggleWbEnabled = async () => {
    if (busy) return;
    setBusy("worldboss_toggle");
    const d = await callAdmin({ action: "toggle_world_boss", enabled: !wbEnabled });
    if (d.success) {
      setWbEnabled(d.enabled);
      setMessage(`✅ ${d.message || (d.enabled ? "🌍 Evento Global ATIVADO!" : "🌍 Evento Global DESATIVADO.")}`);
    } else {
      setMessage(`❌ ${d.error || "Erro ao alternar"}`);
    }
    setBusy(null);
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
      setLimitMaxTowerFloor(typeof s.maxTowerFloor === "number" ? String(s.maxTowerFloor) : "0");
      setLimitMaxLevel(typeof s.maxLevel === "number" ? String(s.maxLevel) : "0");
      setLimitTowerXpMult(typeof s.towerXpMult === "number" ? String(s.towerXpMult) : "1");
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

  /** Salva os limites/balanceamento (torre, nível e XP da torre). */
  const saveBalanceLimits = async () => {
    setBusy("balance_limits");
    const d = await callAdmin({
      action: "update_server_settings",
      maxTowerFloor: Math.max(0, Math.floor(Number(limitMaxTowerFloor) || 0)),
      maxLevel: Math.max(0, Math.floor(Number(limitMaxLevel) || 0)),
      towerXpMult: Math.min(2, Math.max(0.01, Number(limitTowerXpMult) || 1)),
    });
    setMessage(
      d.success
        ? "✅ Limites e balanceamento salvos! (0 = sem limite próprio — usa o padrão do jogo)"
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
    if (tab === "ghost" && !ghostLoaded) loadGhostShop();
    if (tab === "worldboss" && !wbLoaded) loadWorldBoss();
  }, [tab, serverLoaded, donateLoaded, pixLoaded, ghostLoaded, wbLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
    { id: "send", label: "Enviar", icon: "📦" },
    { id: "excluded", label: "Excluídos", icon: "🚫" },
    { id: "music", label: "Músicas das Ilhas", icon: "🎵" },
    { id: "server", label: "Mensagem Global", icon: "📢" },
    { id: "codes", label: "Códigos", icon: "🎟️" },
    { id: "logs", label: "Logs", icon: "📜" },
    { id: "donate", label: "Donate (PIX)", icon: "💖" },
    { id: "pix", label: "Compras PIX", icon: "💎" },
    { id: "ghost", label: "Loja Fantasma", icon: "👻" },
    { id: "worldboss", label: "Evento Global", icon: "🌍" },
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
                // Limpa o cookie httpOnly do admin no servidor antes de sair.
                fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
                setAuthenticated(false);
                setAdminKey("");
                setMessage("");
                try { localStorage.removeItem(ADMIN_KEY_STORAGE_LEGACY); } catch { /* ignora */ }
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
                  Apaga <b className="text-red-300">TODOS os jogadores</b> (contas, personagens, guildas, inventário, correio e códigos usados). O catálogo de itens e missões é mantido.
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
                      // Senha nunca é armazenada em texto puro — só o hash bcrypt.
                      // O admin define uma nova senha pelo botão "🔑 Senha".
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
                              <span className="text-[10px] bg-gray-800 rounded-lg px-2 py-1 text-gray-500" title="Senhas são guardadas apenas como hash bcrypt. Use 'Redefinir senha' para definir uma nova.">
                                🔒 hash (definir nova)
                              </span>
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
                  <button
                    onClick={() => recalcEquipment()}
                    disabled={busy === "recalc_all"}
                    className="bg-gradient-to-r from-[#a855f7] to-[#7c5cfc] text-white rounded-xl px-4 py-2 font-bold text-sm hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === "recalc_all" ? "Recalculando..." : "⚙️ Recalcular Equipamentos (Todos)"}
                  </button>
                </div>

                {/* Edit Form */}
                <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#ffd700]/30 mb-4">
                  <h3 className="text-sm font-bold text-[#ffd700] mb-3">⚡ Editar Personagem (use o ID da lista abaixo)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <input value={editCharId} onChange={(e) => setEditCharId(e.target.value)} placeholder="ID do personagem" className="bg-[#0a0a12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff6b6b] focus:outline-none" />
                    {["gold", "diamonds", "towerCoins", "energy", "maxEnergy", "level", "xp", "towerFloor", "attack", "defense", "speed", "critical", "maxHp", "unspentStatPoints", "skillPoints", "power", "vipLevel"].map((f) => (
                      <input key={f} value={editFields[f] || ""} onChange={(e) => setEditFields({ ...editFields, [f]: e.target.value })} placeholder={f}
                        type="number" className="bg-[#0a0a12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff6b6b] focus:outline-none" />
                    ))}
                  </div>
                  <button onClick={editCharacter} className="bg-[#ffd700] text-black rounded-xl px-4 py-2 font-bold text-sm">💾 Salvar Alterações</button>
                </div>

                {loading ? <div className="text-center py-10 text-gray-400">Carregando...</div> : (
                  <div className="space-y-2">
                    {Array.isArray((data as { characters?: unknown[] }).characters) && ((data as { characters: Record<string, unknown>[] }).characters).map((c) => (
                      <div key={String(c.id)} className="bg-[#1a1a2e] rounded-xl p-3 border border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xl">{CLASS_ICONS[(c.classType as ClassName) || "warrior"]}</span>
                          <div>
                            <div className="font-bold text-white">{String(c.name)}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{String(c.id)}</div>
                          </div>
                          <div className="text-xs text-[#ffd700] font-bold">Lv.{String(c.level)}</div>
                          <div className="text-xs text-gray-400">💰 {Number(c.gold || 0).toLocaleString()} • 💎 {Number(c.diamonds || 0)} • 🗼 {Number(c.towerCoins || 0).toLocaleString()} • 🏯 Andar {Number(c.towerFloor || 1)}</div>
                        </div>
                        {/* Chips de status */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="text-[10px] bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 text-[#ff6b6b] rounded-full px-2 py-0.5 font-bold">⚔️ {Number(c.attack || 0).toLocaleString()}</span>
                          <span className="text-[10px] bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-blue-300 rounded-full px-2 py-0.5 font-bold">🛡️ {Number(c.defense || 0).toLocaleString()}</span>
                          <span className="text-[10px] bg-[#22c55e]/10 border border-[#22c55e]/30 text-green-300 rounded-full px-2 py-0.5 font-bold">❤️ {Number(c.maxHp || 0).toLocaleString()}</span>
                          <span className="text-[10px] bg-[#4ecdc4]/10 border border-[#4ecdc4]/30 text-teal-300 rounded-full px-2 py-0.5 font-bold">👟 {Number(c.speed || 0)}</span>
                          <span className="text-[10px] bg-[#ffd700]/10 border border-[#ffd700]/30 text-yellow-300 rounded-full px-2 py-0.5 font-bold">💥 {Number(c.critical || 0)}%</span>
                          <span className="text-[10px] bg-[#a855f7]/10 border border-[#a855f7]/30 text-purple-300 rounded-full px-2 py-0.5 font-bold">⭐ {Number(c.power || 0).toLocaleString()}</span>
                          {Number(c.unspentStatPoints || 0) > 0 && (
                            <span className="text-[10px] bg-[#00ff88]/10 border border-[#00ff88]/30 text-green-300 rounded-full px-2 py-0.5 font-bold">🎯 {Number(c.unspentStatPoints || 0)} pts</span>
                          )}
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
                          <button
                            onClick={() => recalcEquipment(c)}
                            disabled={busy === `recalc_${String(c.id)}`}
                            className="text-xs bg-[#7c5cfc] text-white rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                            {busy === `recalc_${String(c.id)}` ? "..." : "⚙️ Recalc. Equip."}
                          </button>
                        </div>
                      </div>
                      {/* 👑 VIP — setar / remover */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                        <span className="text-[11px] text-gray-400">
                          👑 VIP:{" "}
                          {(() => {
                            const active = currentVipTier(c);
                            if (active) {
                              const label = VIP_LABELS[active.id] || active.id;
                              return (
                                <span className="text-[#ffd700] font-bold">
                                  {label} até {new Date(String(c.vipUntil)).toLocaleDateString("pt-BR")}
                                </span>
                              );
                            }
                            return c.vipTier ? (
                              <span className="text-red-400 font-bold">expirado</span>
                            ) : (
                              <span className="text-gray-500">nenhum</span>
                            );
                          })()}
                        </span>
                        <select
                          value={vipSelects[String(c.id)] || ""}
                          onChange={(e) => setVipSelects((s) => ({ ...s, [String(c.id)]: e.target.value }))}
                          className="bg-[#0a0a12] border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-[#ffd700] focus:outline-none"
                        >
                          <option value="">Selecione o tier...</option>
                          {VIP_TIERS.map((tier) => (
                            <option key={tier.id} value={tier.id}>{VIP_LABELS[tier.id] || tier.id}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setVip(c)}
                          disabled={busy === `vip_set_${String(c.id)}`}
                          className="text-xs bg-[#ffd700] text-black rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                          {busy === `vip_set_${String(c.id)}` ? "..." : "👑 Setar VIP"}
                        </button>
                        <button
                          onClick={() => removeVip(c)}
                          disabled={busy === `vip_rm_${String(c.id)}`}
                          className="text-xs bg-[#ff6b6b] text-white rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                          {busy === `vip_rm_${String(c.id)}` ? "..." : "🗑️ Remover VIP"}
                        </button>
                      </div>

                      {/* ⚖️ Dar / tirar status (amount negativo tira) */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                        <span className="text-[11px] text-gray-400 font-bold">⚖️ Ajustar status:</span>
                        <select
                          value={adjStat[String(c.id)] || ""}
                          onChange={(e) => setAdjStat((s) => ({ ...s, [String(c.id)]: e.target.value }))}
                          className="bg-[#0a0a12] border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-[#7c5cfc] focus:outline-none"
                        >
                          <option value="">Status...</option>
                          {STAT_ADJUST_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={adjAmount[String(c.id)] || ""}
                          onChange={(e) => setAdjAmount((s) => ({ ...s, [String(c.id)]: e.target.value }))}
                          placeholder="+/- valor"
                          className="w-24 bg-[#0a0a12] border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-[#7c5cfc] focus:outline-none"
                        />
                        <button
                          onClick={() => adjustStats(c)}
                          disabled={busy === `adj_${String(c.id)}`}
                          className="text-xs bg-[#4ecdc4] text-black rounded-lg px-3 py-1.5 font-bold hover:opacity-90 disabled:opacity-40">
                          {busy === `adj_${String(c.id)}` ? "..." : "✅ Aplicar"}
                        </button>
                      </div>
                    </div>
                  ))}
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

                {/* Limites da torre & balanceamento */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10 md:col-span-2">
                  <h3 className="text-sm font-bold text-[#7c5cfc] mb-1">🗼 Limites da Torre & Balanceamento</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Controle o progresso da torre e o ganho de nível. <b className="text-gray-300">0 = sem limite próprio</b> (usa o padrão do jogo).
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🏯 Limite de andar da torre</label>
                      <input
                        type="number"
                        min={0}
                        value={limitMaxTowerFloor}
                        onChange={(e) => setLimitMaxTowerFloor(e.target.value)}
                        placeholder="0 = sem limite"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-[#7c5cfc] focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">O jogador não passa deste andar.</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">⬆️ Limite de nível</label>
                      <input
                        type="number"
                        min={0}
                        value={limitMaxLevel}
                        onChange={(e) => setLimitMaxLevel(e.target.value)}
                        placeholder={`0 = ${MAX_LEVEL}`}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-[#7c5cfc] focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Nenhuma fonte de XP passa deste nível.</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">⚡ XP da torre (multiplicador)</label>
                      <input
                        type="number"
                        min={0.01}
                        max={2}
                        step={0.05}
                        value={limitTowerXpMult}
                        onChange={(e) => setLimitTowerXpMult(e.target.value)}
                        placeholder="1 = normal"
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-[#7c5cfc] focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Ex.: 0.3 = só 30% do XP por andar (torre menos apelona).</p>
                    </div>
                  </div>
                  <button
                    onClick={saveBalanceLimits}
                    disabled={busy === "balance_limits"}
                    className="bg-[#7c5cfc] hover:bg-[#6b4fd8] text-white rounded-xl px-4 py-2.5 font-bold text-sm disabled:opacity-40"
                  >
                    {busy === "balance_limits" ? "Salvando..." : "💾 Salvar limites e balanceamento"}
                  </button>
                </div>
              </div>
            )}
            {tab === "ghost" && (
              <div className="space-y-4">
                {/* Ativar/desativar + horários + duração */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Ligar/desligar */}
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h3 className="text-sm font-bold text-[#7c5cfc]">👻 Loja Fantasma</h3>
                      <button
                        onClick={toggleGhostEnabled}
                        disabled={busy === "ghost_toggle"}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                          ghostEnabled
                            ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
                            : "bg-[#7c5cfc] hover:bg-[#6b4fd8] text-white"
                        }`}
                      >
                        {busy === "ghost_toggle" ? "⏳ Aguarde..." : ghostEnabled ? "⛔ Desativar agora" : "✅ Ativar agora"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Loja temporária paga com <b className="text-purple-300">moedas da torre (towerCoins)</b>. Quando ativada, abre nos horários abaixo e fica disponível pelo tempo configurado. Fechada, os jogadores veem a contagem regressiva para a próxima abertura.
                    </p>
                    <div className={`mt-3 text-center rounded-xl py-2 text-sm font-black ${ghostEnabled ? "bg-[#7c5cfc]/15 border border-[#7c5cfc]/40 text-[#7c5cfc]" : "bg-[#0a0a12] border border-gray-700 text-gray-500"}`}>
                      {ghostEnabled ? "🟢 ATIVA — a loja abre nos horários agendados" : "⚪ DESATIVADA — ninguém vê a loja"}
                    </div>
                  </div>

                  {/* Horários + duração */}
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <h3 className="text-sm font-bold text-white mb-1">🕐 Horários de abertura (horário do servidor)</h3>
                    <div className="mb-3"><ServerClock headers={headers} /></div>
                    <TimezoneWarning />
                    <p className="text-xs text-gray-400 mb-3">
                      A loja abre todos os dias nos horários abaixo e fica aberta por <b className="text-gray-300">{Math.max(1, Math.floor(Number(ghostDuration) || 60))} min</b>.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="time"
                        value={ghostTime}
                        onChange={(e) => setGhostTime(e.target.value)}
                        className="bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#7c5cfc] focus:outline-none"
                      />
                      <button onClick={addGhostTime} className="bg-[#7c5cfc] hover:bg-[#6b4fd8] text-white rounded-xl px-4 py-2 text-sm font-bold">
                        ➕ Adicionar
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500">Duração (min):</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={ghostDuration}
                          onChange={(e) => setGhostDuration(e.target.value)}
                          className="w-20 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#7c5cfc] focus:outline-none"
                        />
                      </div>
                    </div>
                    {ghostSchedule.length === 0 ? (
                      <p className="text-xs text-gray-600 bg-[#0a0a12] border border-dashed border-gray-700 rounded-xl p-3 text-center">
                        Nenhum horário — adicione pelo menos 1 para a loja poder abrir.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {ghostSchedule.map((hhmm) => (
                          <span key={hhmm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7c5cfc]/10 border border-[#7c5cfc]/40 text-purple-200 font-mono text-sm">
                            🕐 {hhmm}
                            <button
                              onClick={() => setGhostSchedule((prev) => prev.filter((t) => t !== hhmm))}
                              className="text-purple-300 hover:text-red-400 transition"
                              title="Remover horário"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Itens da loja */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-1">🧪 Itens à venda ({ghostItems.length})</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Clique em um item do catálogo para adicioná-lo. O <b className="text-purple-300">preço</b> é em moedas da torre e a <b className="text-gray-300">quantidade</b> é quantas unidades o jogador recebe por compra.
                  </p>

                  {/* Itens já configurados */}
                  {ghostItems.length > 0 && (
                    <div className="space-y-2 mb-5">
                      {ghostItems.map((it) => {
                        const tpl = itemCatalog.find((x) => Number(x.id) === it.templateId) as Record<string, unknown> | undefined;
                        const rarity = String(tpl?.rarity || "common");
                        const color = RARITY_COLORS[rarity] ?? "#9ca3af";
                        return (
                          <div key={it.templateId} className="flex flex-wrap items-center gap-3 bg-[#0a0a12] rounded-xl border border-white/10 p-3">
                            {tpl?.image ? (
                              <img src={String(tpl.image)} alt="" className="w-10 h-10 object-contain" />
                            ) : (
                              <span className="text-2xl">{String(tpl?.icon || "🗡️")}</span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-white truncate">
                                {tpl ? t(String(tpl.nameKey)) : `Item #${it.templateId}`}
                              </div>
                              <div className="text-[10px] font-bold uppercase" style={{ color }}>{rarity}</div>
                            </div>
                            <label className="text-xs text-gray-500 flex items-center gap-1.5">🪙 Preço
                              <input
                                type="number"
                                min={0}
                                value={it.price}
                                onChange={(e) => setGhostItems((prev) => prev.map((x) => x.templateId === it.templateId ? { ...x, price: e.target.value } : x))}
                                className="w-24 bg-[#1a1a2e] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:border-[#7c5cfc] focus:outline-none"
                              />
                            </label>
                            <label className="text-xs text-gray-500 flex items-center gap-1.5">Qtd
                              <input
                                type="number"
                                min={1}
                                value={it.quantity}
                                onChange={(e) => setGhostItems((prev) => prev.map((x) => x.templateId === it.templateId ? { ...x, quantity: e.target.value } : x))}
                                className="w-16 bg-[#1a1a2e] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:border-[#7c5cfc] focus:outline-none"
                              />
                            </label>
                            <button
                              onClick={() => setGhostItems((prev) => prev.filter((x) => x.templateId !== it.templateId))}
                              className="text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Seletor de itens do catálogo */}
                  <input
                    value={ghostItemSearch}
                    onChange={(e) => setGhostItemSearch(e.target.value)}
                    placeholder="🔍 Buscar item no catálogo para adicionar..."
                    className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#7c5cfc] focus:outline-none mb-3"
                  />
                  {loading && itemCatalog.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">Carregando catálogo...</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-h-[360px] overflow-y-auto pr-1">
                      {itemCatalog.filter((it) => {
                        if (ghostItemSearch.trim()) {
                          const q = ghostItemSearch.trim().toLowerCase();
                          const name = t(String(it.nameKey)).toLowerCase();
                          if (!name.includes(q)) return false;
                        }
                        return true;
                      }).map((it) => {
                        const id = Number(it.id);
                        const isSel = ghostItems.some((x) => x.templateId === id);
                        const rarity = String(it.rarity || "common");
                        const color = RARITY_COLORS[rarity] ?? "#9ca3af";
                        return (
                          <button
                            key={id}
                            onClick={() => addGhostItem(id)}
                            disabled={isSel}
                            className={`relative flex flex-col items-center gap-1 rounded-xl border bg-[#0a0a12] p-2.5 text-center transition-all ${
                              isSel ? "opacity-40 border-green-500/40" : "border-white/10 hover:border-[#7c5cfc]/60 hover:bg-[#7c5cfc]/5"
                            }`}
                            style={{ borderColor: isSel ? undefined : color + "33" }}
                            title={isSel ? "Já está na loja" : "Adicionar à loja"}
                          >
                            {isSel && <span className="absolute top-1 right-1 text-[10px] font-black text-green-400">✓</span>}
                            {it.image ? (
                              <img src={String(it.image)} alt="" loading="lazy" decoding="async" className="h-11 w-11 object-contain" />
                            ) : (
                              <span className="text-2xl">{String(it.icon || "🗡️")}</span>
                            )}
                            <span className="w-full truncate text-[10px] font-bold text-white">{t(String(it.nameKey))}</span>
                            <span className="text-[9px] font-bold uppercase" style={{ color }}>{rarity}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Salvar */}
                <button onClick={saveGhostShop} disabled={busy === "ghost"}
                  className="w-full bg-[#7c5cfc] hover:bg-[#6b4fd8] text-white rounded-xl px-4 py-3 font-black text-sm disabled:opacity-40 transition">
                  {busy === "ghost" ? "Salvando..." : "💾 Salvar Loja Fantasma"}
                </button>
              </div>
            )}
            {tab === "worldboss" && (
              <div className="space-y-4">
                {/* Ativar/desativar + horários */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h3 className="text-sm font-bold text-[#ef4444]">🌍 Evento Global (Boss Mundial)</h3>
                      <button
                        onClick={toggleWbEnabled}
                        disabled={busy === "worldboss_toggle"}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                          wbEnabled
                            ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
                            : "bg-[#ef4444] hover:bg-[#d33838] text-white"
                        }`}
                      >
                        {busy === "worldboss_toggle" ? "⏳ Aguarde..." : wbEnabled ? "⛔ Desativar agora" : "✅ Ativar agora"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Batalha conjunta contra um boss com HP gigante. Os jogadores formam <b className="text-red-300">squads de até {Math.max(2, Math.floor(Number(wbSquadSize) || 4))}</b>, atacam juntos e, se derrubarem o boss, todos recebem recompensas proporcionais ao dano.
                    </p>
                    <div className={`mt-3 text-center rounded-xl py-2 text-sm font-black ${wbEnabled ? "bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#ef4444]" : "bg-[#0a0a12] border border-gray-700 text-gray-500"}`}>
                      {wbEnabled ? "🟢 ATIVO — o evento abre nos horários agendados" : "⚪ DESATIVADO — ninguém vê o evento"}
                    </div>
                    <button onClick={resetWorldBoss} disabled={busy === "wb_reset"}
                      className="mt-3 w-full text-red-400 hover:text-red-300 text-xs border border-red-500/30 hover:border-red-500 rounded-xl px-4 py-2 font-bold disabled:opacity-40">
                      {busy === "wb_reset" ? "Zerando..." : "🔄 Zerar evento atual (boss volta com HP cheio)"}
                    </button>
                  </div>

                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <h3 className="text-sm font-bold text-white mb-1">🕐 Horários do evento (horário do servidor)</h3>
                    <div className="mb-3"><ServerClock headers={headers} /></div>
                    <TimezoneWarning />
                    <p className="text-xs text-gray-400 mb-3">
                      O evento abre todos os dias nos horários abaixo e fica disponível por <b className="text-gray-300">{Math.max(1, Math.floor(Number(wbDuration) || 60))} min</b>.
                    </p>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <input
                        type="time"
                        value={wbTime}
                        onChange={(e) => setWbTime(e.target.value)}
                        className="bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#ef4444] focus:outline-none"
                      />
                      <button onClick={addWbTime} className="bg-[#ef4444] hover:bg-[#e03030] text-white rounded-xl px-4 py-2 text-sm font-bold">
                        ➕ Adicionar
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500">Duração (min):</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={wbDuration}
                          onChange={(e) => setWbDuration(e.target.value)}
                          className="w-20 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 text-white focus:border-[#ef4444] focus:outline-none"
                        />
                      </div>
                    </div>
                    {wbSchedule.length === 0 ? (
                      <p className="text-xs text-gray-600 bg-[#0a0a12] border border-dashed border-gray-700 rounded-xl p-3 text-center">
                        Nenhum horário — adicione pelo menos 1 para o evento acontecer.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {wbSchedule.map((hhmm) => (
                          <span key={hhmm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/40 text-red-200 font-mono text-sm">
                            🕐 {hhmm}
                            <button
                              onClick={() => setWbSchedule((prev) => prev.filter((x) => x !== hhmm))}
                              className="text-red-300 hover:text-white transition"
                              title="Remover horário"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Boss + recompensas */}
                <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                  <h3 className="text-sm font-bold text-white mb-3">👹 O Boss</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Tipo do boss (visual da torre)</label>
                      <select value={wbBossKind} onChange={(e) => setWbBossKind(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none">
                        {TOWER_BOSS_KINDS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">❤️ HP máximo</label>
                      <input type="number" min={100000} value={wbMaxHp} onChange={(e) => setWbMaxHp(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">⚔️ Ataque</label>
                      <input type="number" min={1} value={wbAttack} onChange={(e) => setWbAttack(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🛡️ Defesa</label>
                      <input type="number" min={0} value={wbDefense} onChange={(e) => setWbDefense(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">💨 Velocidade</label>
                      <input type="number" min={0} value={wbSpeed} onChange={(e) => setWbSpeed(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🎯 Crítico %</label>
                      <input type="number" min={0} max={100} value={wbCritical} onChange={(e) => setWbCritical(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Recompensas */}
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <h3 className="text-sm font-bold text-[#ffd700] mb-3">🎁 Recompensas (piscina dividida pelo dano)</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">💰 Ouro total</label>
                        <input type="number" min={0} value={wbGold} onChange={(e) => setWbGold(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">⚡ XP total</label>
                        <input type="number" min={0} value={wbXp} onChange={(e) => setWbXp(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">🗼 Moedas torre (fixo)</label>
                        <input type="number" min={0} value={wbCoins} onChange={(e) => setWbCoins(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Regras */}
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                    <h3 className="text-sm font-bold text-white mb-3">⚙️ Regras da batalha</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Máx. jogadores por squad</label>
                        <input type="number" min={2} max={20} value={wbSquadSize} onChange={(e) => setWbSquadSize(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cooldown entre ataques (s)</label>
                        <input type="number" min={1} max={3600} value={wbCooldown} onChange={(e) => setWbCooldown(e.target.value)}
                          className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-[#ef4444] focus:outline-none" />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3">
                      O HP do jogador na batalha regenera 100% em 60s. Cada ataque dá dano baseado em ataque+nível (com chance de crítico). Quando o boss morre, todos os participantes recebem ouro/XP da piscina (proporcional ao dano) + as moedas da torre fixas.
                    </p>
                  </div>
                </div>

                <button onClick={saveWorldBoss} disabled={busy === "worldboss"}
                  className="w-full bg-[#ef4444] hover:bg-[#e03030] text-white rounded-xl px-4 py-3 font-black text-sm disabled:opacity-40 transition">
                  {busy === "worldboss" ? "Salvando..." : "💾 Salvar Evento Global"}
                </button>
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
            {tab === "logs" && (
              <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">📜 Logs do servidor</h3>
                    <p className="text-xs text-gray-400">
                      Avisos automáticos do jogo — <b className="text-red-400">hitkill</b> (anti-one-shot na torre/boss) e transações de <b className="text-yellow-300">economia</b> (anúncios e compras no mercado).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl border border-white/10 overflow-hidden">
                      {[
                        { id: "all", label: "Todos" },
                        { id: "hitkill", label: "💥 Hitkill" },
                        { id: "economy", label: "💰 Economia" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setLogsFilter(f.id)}
                          className={`px-3 py-1.5 text-xs font-bold transition ${logsFilter === f.id ? "bg-[#e94560] text-white" : "bg-[#0a0a12] text-gray-400 hover:text-white"}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => loadLogs()}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-40"
                    >
                      🔄 Atualizar
                    </button>
                    <button
                      onClick={() => clearLogs(logsFilter)}
                      disabled={busy === "clear_logs"}
                      className="text-xs px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      {busy === "clear_logs" ? "Limpando..." : "🗑️ Limpar"}
                    </button>
                  </div>
                </div>

                {loading && logsList.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-10">Carregando logs...</div>
                ) : logsList.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-10">Nenhum log registrado ainda. Eles aparecem aqui quando o anti-one-shot entra em ação (hitkill na torre / boss mundial) ou quando houver transações de mercado.</div>
                ) : (
                  <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                    {logsList.map((l) => {
                      const kind = String(l.kind || "log");
                      const source = String(l.source || "");
                      const isHitkill = kind === "hitkill";
                      const isEconomy = kind === "economy";
                      const ts = l.createdAt ? new Date(String(l.createdAt)) : null;
                      return (
                        <div key={String(l.id)} className={`rounded-xl border p-3 ${isHitkill ? "border-red-500/30 bg-red-950/20" : isEconomy ? "border-yellow-500/30 bg-yellow-950/15" : "border-white/10 bg-[#0a0a12]"}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {isHitkill ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-bold">💥 HITKILL</span>
                            ) : isEconomy ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-bold">💰 ECONOMIA</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-500/40 text-gray-300 font-bold">📋 LOG</span>
                            )}
                            {source === "tower" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">🏯 Torre</span>}
                            {source === "world-boss" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300">🌍 Boss Mundial</span>}
                            {source === "market" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">🏪 Mercado</span>}
                            {l.charName ? (
                              <span className="text-[11px] font-bold text-white">⚔️ {String(l.charName)}</span>
                            ) : l.characterName ? (
                              <span className="text-[11px] font-bold text-white">⚔️ {String(l.characterName)}</span>
                            ) : null}
                            {l.floor !== undefined && (
                              <span className="text-[10px] text-gray-400">🏯 Andar {String(l.floor)}</span>
                            )}
                            {ts && !Number.isNaN(ts.getTime()) && (
                              <span className="ml-auto text-[10px] text-gray-500">🕐 {ts.toLocaleString("pt-BR")}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-300">{String(l.message || "")}</p>
                          {(l.damage !== undefined || l.playerMaxHit !== undefined) && (
                            <p className="text-[10px] text-gray-500 mt-1 font-mono">
                              {l.playerMaxHit !== undefined && <>Dano máximo: <b className="text-red-400">{String(l.playerMaxHit)}</b> • HP do chefe: {String(l.bossHp)} • HP escalado: {String(l.scaledHp)} • Ataque escalado: {String(l.scaledAttack)}</>}
                              {l.damage !== undefined && <>Dano: <b className="text-red-400">{String(l.damage)}</b> • Cap aplicado: {String(l.cappedDamage)} • HP do boss: {String(l.bossHp)}</>}
                            </p>
                          )}
                          {isEconomy && (
                            <p className="text-[10px] text-gray-500 mt-1 font-mono">
                              {String(l.event === "buy" ? "🛒 Compra" : "📦 Anúncio")} • Item #{String(l.templateId)} • {String(l.quantity)}× • Preço: <b className="text-yellow-300">{Number(l.price).toLocaleString("pt-BR")}</b> {l.currency === "diamonds" ? "💎" : "🪙"}
                              {l.event === "buy" && l.sellerName ? <> • Vendedor: {String(l.sellerName)}</> : null}
                              {l.event === "listing" && l.fee !== undefined ? <> • Taxa: {String(l.fee)}</> : null}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <button onClick={loadPurchases} disabled={loading}
                    className="mb-3 text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-40">
                    🔄 Atualizar lista
                  </button>
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
                              {p.screenshotData ? (
                                <details className="w-full">
                                  <summary className="text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1 font-bold inline-block cursor-pointer">
                                    🖼️ Ver comprovante
                                  </summary>
                                  <img src={String(p.screenshotData)} alt="Comprovante PIX"
                                    className="mt-2 max-h-64 rounded-lg border border-white/10 object-contain bg-black/40" />
                                </details>
                              ) : p.screenshotUrl ? (
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
      </div>
    </div>
  );
}

/**
 * Relógio AO VIVO do servidor — os horários dos eventos são interpretados na
 * HORA DO SERVIDOR. Se o servidor estiver em outro fuso (ex.: Vercel em UTC e
 * você no Brasil), configurar 18:00 abriria às 15:00 do seu relógio. Este
 * relógio mostra a hora exata do servidor para calibrar os horários certos.
 */
function ServerClock({ headers }: { headers: Record<string, string> }) {
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stopped = false;
    fetch("/api/admin?action=settings", { headers })
      .then((r) => r.json())
      .then((d) => {
        if (stopped || !d.serverTime) return;
        setServerTime(d.serverTime);
        setOffsetMinutes(Number(d.serverOffsetMinutes) || 0);
        setSkew(Date.now() - new Date(d.serverTime).getTime());
      })
      .catch(() => {});
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(tick);
    };
  }, [headers]);

  if (!serverTime) {
    return <span className="text-[11px] text-gray-600">🕐 buscando relógio do servidor...</span>;
  }

  const server = new Date(now - skew);
  const offsetLabel =
    offsetMinutes === 0 ? "UTC" : `UTC${offsetMinutes > 0 ? "+" : ""}${offsetMinutes / 60}`;

  const dateStr = server.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = server.toLocaleTimeString("pt-BR", { hour12: false });

  return (
    <div className="text-[11px] text-gray-400 bg-[#0a0a12] border border-gray-700 rounded-xl px-3 py-2 inline-flex items-center gap-2 flex-wrap">
      <span>🕐 Relógio do servidor:</span>
      <b className="font-mono text-white tabular-nums">
        {dateStr} {timeStr} ({offsetLabel})
      </b>
      <span className="text-gray-600">— configure os horários por esse relógio (HORA DO SERVIDOR)</span>
    </div>
  );
}

/** Aviso de fuso horário para inputs de horário (HH:MM) */
function TimezoneWarning() {
  return (
    <p className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mt-2">
      ⚠️ <b>ATENÇÃO:</b> Os horários abaixo são interpretados na <b>HORA DO SERVIDOR</b> (acima).
      Se o servidor estiver em fuso diferente do seu (ex.: servidor em UTC, você no Brasil -3h),
      configure o horário convertendo para o fuso do servidor. Ex.: quer abrir às 18:00 do Brasil
      e o servidor é UTC? Coloque 21:00 aqui.
    </p>
  );
}