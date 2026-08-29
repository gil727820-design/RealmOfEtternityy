"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { RARITY_COLORS, classImage, type ClassName } from "@/game/constants";

interface TradeAd {
  id: string;
  posterId: string;
  posterName: string;
  posterClass: string;
  posterLevel: number;
  title: string;
  want: string;
  offeredItems: Array<{ templateId: number; name: string; icon: string; rarity: string; quantity: number }>;
  createdAt: string;
  status: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface TradeSession {
  id: string;
  adId: string;
  playerA: { id: string; name: string; items: Array<{ templateId: number; name: string; icon: string; rarity: string; quantity: number }> };
  playerB: { id: string; name: string; items: Array<{ templateId: number; name: string; icon: string; rarity: string; quantity: number }> };
  status: string;
}

type ViewMode = "list" | "create" | "chat" | "session";

export default function TradePanel() {
  const { characterId, character, locale, notify, setCharacter } = useGameStore();
  const [view, setView] = useState<ViewMode>("list");
  const [ads, setAds] = useState<TradeAd[]>([]);
  const [selectedAd, setSelectedAd] = useState<TradeAd | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Create ad form
  const [adTitle, setAdTitle] = useState("");
  const [adWant, setAdWant] = useState("");
  const [adItems, setAdItems] = useState<Array<{ templateId: number; name: string; icon: string; rarity: string; quantity: number }>>([]);

  const loadAds = useCallback(async () => {
    try {
      const res = await fetch("/api/social?action=trade-ads");
      const data = await res.json();
      setAds(data.ads || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAds(); }, [loadAds]);

  const loadChat = useCallback(async (adId: string) => {
    try {
      const res = await fetch(`/api/social?action=trade-ads-chat&adId=${adId}`);
      const data = await res.json();
      setChatMessages(data.messages || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedAd && (view === "chat" || view === "session")) {
      loadChat(selectedAd.id);
      const interval = setInterval(() => loadChat(selectedAd.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedAd, view, loadChat]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const createAd = async () => {
    if (!characterId || busy || !adTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/social?action=trade-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, title: adTitle, want: adWant, offeredItems: adItems }),
      });
      const data = await res.json();
      if (res.ok) {
        notify("📢 Anuncio criado!", "success");
        setAdTitle("");
        setAdWant("");
        setAdItems([]);
        setView("list");
        await loadAds();
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao criar anuncio", "error"); }
    setBusy(false);
  };

  const sendChat = async () => {
    if (!characterId || !selectedAd || !chatInput.trim()) return;
    try {
      await fetch("/api/social?action=trade-ads-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, adId: selectedAd.id, text: chatInput.trim() }),
      });
      setChatInput("");
      await loadChat(selectedAd.id);
    } catch { /* ignore */ }
  };

  const openSession = async (ad: TradeAd) => {
    if (!characterId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/social?action=trade-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, adId: ad.id }),
      });
      const data = await res.json();
      if (res.ok) {
        notify("🔄 Sala de troca aberta!", "success");
        setView("session");
      } else {
        notify(data.error || "Erro", "error");
      }
    } catch { notify("Erro ao abrir sala", "error"); }
    setBusy(false);
  };

  const isOwner = (ad: TradeAd) => ad.posterId === characterId;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
        <div className="spinner mb-4" />
        <p className="text-gray-400">{t("general.loading", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border border-[#3b82f6]/50 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.35)]">
            <span className="text-2xl">🔄</span>
          </div>
          <div>
            <h2 className="text-3xl font-black">
              <span className="bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] bg-clip-text text-transparent">Trade</span>
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Troque itens com outros jogadores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${view === "list" ? "border-[#3b82f6] bg-[#3b82f6]/15 text-[#3b82f6]" : "border-white/15 text-gray-400 hover:text-white"}`}>
            📋 Anuncios
          </button>
          <button onClick={() => setView("create")} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${view === "create" ? "border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]" : "border-white/15 text-gray-400 hover:text-white"}`}>
            ➕ Criar
          </button>
        </div>
      </div>

      {/* View: List */}
      {view === "list" && (
        <div className="space-y-3">
          {ads.length === 0 ? (
            <div className="game-card p-8 text-center text-sm text-gray-500">
              <span className="text-4xl block mb-2">📭</span>
              Nenhum anuncio de troca no momento.<br />
              Seja o primeiro a criar um!
            </div>
          ) : (
            ads.map((ad) => (
              <div key={ad.id} className="game-card p-4 border border-white/10 hover:border-[#3b82f6]/40 transition-all">
                <div className="flex items-start gap-3">
                  <img src={classImage(ad.posterClass as ClassName, "male")} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{ad.posterName}</span>
                      <span className="text-[10px] text-gray-500">Lv.{ad.posterLevel}</span>
                      <span className="text-[10px] text-gray-600">•</span>
                      <span className="text-[10px] text-gray-600">{new Date(ad.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <h3 className="font-bold text-[#60a5fa] mb-1">{ad.title}</h3>
                    {ad.want && <p className="text-[11px] text-gray-400 mb-2">Quer: {ad.want}</p>}
                    {/* Items oferecidos */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(ad.offeredItems || []).slice(0, 5).map((item, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded-lg border font-bold" style={{ borderColor: `${RARITY_COLORS[item.rarity] || "#666"}44`, color: RARITY_COLORS[item.rarity] || "#999", background: `${RARITY_COLORS[item.rarity] || "#666"}15` }}>
                          {item.icon} {item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
                        </span>
                      ))}
                      {(ad.offeredItems || []).length > 5 && (
                        <span className="text-[10px] text-gray-500">+{(ad.offeredItems || []).length - 5} mais</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedAd(ad); setView("chat"); }} className="text-[11px] px-3 py-1.5 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/40 text-[#3b82f6] font-bold hover:bg-[#3b82f6]/25 transition">
                        💬 Chat
                      </button>
                      {!isOwner(ad) && (
                        <button onClick={() => openSession(ad)} disabled={busy} className="text-[11px] px-3 py-1.5 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/40 text-[#22c55e] font-bold hover:bg-[#22c55e]/25 transition disabled:opacity-40">
                          🔄 Trocar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* View: Create */}
      {view === "create" && (
        <div className="game-card p-5 space-y-4">
          <h3 className="font-bold text-white">➕ Criar Anuncio de Troca</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Titulo (o que voce oferece)</label>
            <input value={adTitle} onChange={(e) => setAdTitle(e.target.value)} placeholder="Ex: Vendo espada epica" maxLength={60}
              className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#3b82f6] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">O que quer em troca</label>
            <input value={adWant} onChange={(e) => setAdWant(e.target.value)} placeholder="Ex: Preciso de armadura lendaria" maxLength={120}
              className="w-full bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#3b82f6] focus:outline-none" />
          </div>
          <p className="text-[11px] text-gray-500">Itens oferecidos serao selecionados na sala de troca quando alguem interessar.</p>
          <div className="flex gap-2">
            <button onClick={() => setView("list")} className="px-4 py-2 rounded-xl text-sm font-bold border border-white/15 text-gray-400 hover:text-white transition">
              Cancelar
            </button>
            <button onClick={createAd} disabled={busy || !adTitle.trim()} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#3b82f6] text-white hover:bg-[#2563eb] transition disabled:opacity-40">
              {busy ? "..." : "📢 Publicar"}
            </button>
          </div>
        </div>
      )}

      {/* View: Chat */}
      {view === "chat" && selectedAd && (
        <div className="game-card p-4 flex flex-col" style={{ height: "70vh" }}>
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
            <button onClick={() => setView("list")} className="text-gray-500 hover:text-white">← Voltar</button>
            <img src={classImage(selectedAd.posterClass as ClassName, "male")} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
            <div className="flex-1">
              <span className="font-bold text-white text-sm">{selectedAd.posterName}</span>
              <span className="text-[10px] text-gray-500 ml-2">{selectedAd.title}</span>
            </div>
            {!isOwner(selectedAd) && (
              <button onClick={() => openSession(selectedAd)} disabled={busy} className="text-[11px] px-3 py-1.5 rounded-xl bg-[#22c55e] text-black font-bold disabled:opacity-40">
                🔄 Abrir Troca
              </button>
            )}
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto space-y-2 mb-3">
            {chatMessages.length === 0 && <p className="text-center text-gray-600 text-xs py-8">Nenhuma mensagem ainda. Digite algo para comecar!</p>}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.senderId === characterId ? "justify-end" : ""}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs ${msg.senderId === characterId ? "bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-white" : "bg-white/5 border border-white/10 text-gray-300"}`}>
                  {msg.senderId !== characterId && <div className="text-[10px] text-[#3b82f6] font-bold mb-0.5">{msg.senderName}</div>}
                  <div>{msg.text}</div>
                  <div className="text-[9px] text-gray-600 mt-0.5">{new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Digite sua mensagem..." maxLength={200}
              className="flex-1 bg-[#0a0a12] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:border-[#3b82f6] focus:outline-none" />
            <button onClick={sendChat} disabled={!chatInput.trim()} className="px-4 py-2 rounded-xl bg-[#3b82f6] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#2563eb] transition">
              📨
            </button>
          </div>
        </div>
      )}

      {/* View: Session */}
      {view === "session" && (
        <div className="game-card p-5 text-center">
          <span className="text-4xl block mb-2">🔄</span>
          <h3 className="font-bold text-white mb-2">Sala de Troca</h3>
          <p className="text-xs text-gray-400 mb-4">Selecione os itens do seu inventario na sala de troca e confirme quando pronto.</p>
          <button onClick={() => setView("list")} className="px-4 py-2 rounded-xl text-sm font-bold border border-white/15 text-gray-400 hover:text-white transition">
            ← Voltar aos anuncios
          </button>
        </div>
      )}
    </div>
  );
}
