"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

const BUG_CATEGORIES = ["Combate", "Missões", "Inventário", "Loja", "PvP", "Torre", "Guilda", "Gráficos", "Outro"];
const FEEDBACK_CATEGORIES = ["Sugestões", "Bugs que encontrei", "Economia", "Balanceamento", "Eventos", "Outro"];

export default function ReportPanel() {
  const { characterId, character, notify } = useGameStore();
  const [type, setType] = useState<"bug" | "feedback">("bug");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const categories = type === "bug" ? BUG_CATEGORIES : FEEDBACK_CATEGORIES;

  const submit = async () => {
    if (!characterId) return notify("Personagem não encontrado.", "error");
    if (message.trim().length < 5) return notify("Descreva o ocorrido (mínimo 5 caracteres).", "error");
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          type,
          category,
          message,
          characterName: character?.name,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        notify(d.error || "Falha ao enviar.", "error");
        return;
      }
      notify("✅ " + (d.message || "Recebido! Obrigado."), "success");
      setMessage("");
      setCategory("");
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch {
      notify("Erro de conexão. Tente novamente.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <img
          src={type === "bug" ? "/images/report/bug.png" : "/images/report/feedback.png"}
          alt=""
          className="h-12 w-12 object-contain rounded-2xl"
        />
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Reporte / Feedback</h2>
          <p className="text-xs text-gray-400">Nos ajude a melhorar! Escolha o tipo e envie sua mensagem.</p>
        </div>
      </div>

      <div className="game-card p-6 max-w-2xl">
        {/* Seletor único com as duas opções */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => { setType("bug"); setCategory(""); }}
            className={`rounded-2xl border p-4 text-left transition ${type === "bug" ? "border-red-500/60 bg-red-500/10" : "border-white/10 bg-[#0a0a12] hover:border-white/30"}`}
          >
            <img
              src="/images/report/bug.png"
              alt=""
              loading="lazy"
              className={`h-16 w-16 object-contain mx-auto mb-2 ${type === "bug" ? "" : "grayscale opacity-70"}`}
            />
            <div className="font-bold text-white text-center">Reportar Bug</div>
            <div className="text-[11px] text-gray-400 mt-0.5 text-center">Problemas, erros ou travamentos</div>
          </button>
          <button
            onClick={() => { setType("feedback"); setCategory(""); }}
            className={`rounded-2xl border p-4 text-left transition ${type === "feedback" ? "border-[#4ecdc4]/60 bg-[#4ecdc4]/10" : "border-white/10 bg-[#0a0a12] hover:border-white/30"}`}
          >
            <img
              src="/images/report/feedback.png"
              alt=""
              loading="lazy"
              className={`h-16 w-16 object-contain mx-auto mb-2 ${type === "feedback" ? "" : "grayscale opacity-70"}`}
            />
            <div className="font-bold text-white text-center">Enviar Feedback</div>
            <div className="text-[11px] text-gray-400 mt-0.5 text-center">Sugestões e opiniões</div>
          </button>
        </div>

        {/* Categoria opcional */}
        <label className="block text-xs text-gray-500 mb-1">Categoria (opcional)</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-[#0a0a12] border border-white/15 rounded-xl px-4 py-2.5 text-white focus:border-[#4ecdc4] focus:outline-none mb-4"
        >
          <option value="">Selecione...</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Mensagem */}
        <label className="block text-xs text-gray-500 mb-1">Mensagem</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder={type === "bug" ? "Descreva o bug: o que você fez, o que aconteceu e o que deveria acontecer..." : "Conte sua sugestão ou ideia para deixarmos o jogo melhor..."}
          className="w-full bg-[#0a0a12] border border-white/15 rounded-xl px-4 py-3 text-white focus:border-[#4ecdc4] focus:outline-none resize-none mb-4"
        />

        <button
          onClick={submit}
          disabled={sending}
          className={`w-full text-white rounded-xl px-4 py-3 font-bold text-sm disabled:opacity-40 transition ${
            type === "bug"
              ? "bg-gradient-to-r from-red-500 to-red-600 hover:brightness-110"
              : "bg-gradient-to-r from-[#4ecdc4] to-[#2cb2a8] hover:brightness-110"
          }`}
        >
          {sending ? "Enviando..." : type === "bug" ? "Enviar reporte de bug" : "Enviar feedback"}
        </button>

        {sent && (
          <p className="text-center text-sm text-[#4ecdc4] mt-4 animate-fadeInUp">
            Recebido! A administração foi notificada. Obrigado por ajudar o Realm of Eternity.
          </p>
        )}
      </div>
    </div>
  );
}