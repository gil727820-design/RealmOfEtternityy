"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { CLASS_LIST, CLASS_ICONS, CLASS_BASE_STATS, classImage, type ClassName } from "@/game/constants";


export default function CharacterCreation() {
  const { userId, locale, characters, setCharacter, setCharacters, setCreatingCharacter, setShowCharacterSelect, logout } = useGameStore();
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [classType, setClassType] = useState<ClassName>("warrior");
  // Removed hair/eye color selection — fixed defaults handled server-side
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stats = CLASS_BASE_STATS[classType];

  const handleCreate = async () => {
    if (!name.trim()) { setError(t("char.name", locale)); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/character/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: name.trim(), sex, classType, avatarId: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setCharacter(data.character);
      // Sincroniza a lista da conta (o novo personagem entra na seleção).
      if (Array.isArray(data.characters)) setCharacters(data.characters);
      setCreatingCharacter(false);
    } catch {
      setError(t("map.connectionError", locale));
    }    setLoading(false);
  };

  // Volta para a seleção de personagens (se a conta já tem) ou para o login
  // (se foi clicado sem querer na primeira criação).
  const goBack = () => {
    if (characters && characters.length > 0) {
      setCreatingCharacter(false);
      setShowCharacterSelect(true);
    } else {
      logout();
    }
  };


  return (
    <div className="min-h-[100dvh] min-h-screen bg-[#060a14] relative overflow-hidden p-4 sm:p-6 flex items-center justify-center font-sans safe-bottom">
      {/* Background — brilhos do reino */}
      <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] bg-[#d4a843]/8 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-indigo-900/25 rounded-full blur-[100px] animate-floatSlow" />
      <div className="vignette absolute inset-0" />

      <div className="w-full max-w-4xl relative z-10 animate-fadeInUp">
        <button
          onClick={goBack}
          disabled={loading}
          className="mb-3 sm:mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-gray-300 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50 touch-target"
        >
          ← {t("char.create.back", locale)}
        </button>

        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-6 sm:mb-8 gradient-text tracking-wide px-2">
          {t("char.create", locale)}
        </h1>
        <div className="ornate-rule w-40 sm:w-56 mx-auto -mt-4 mb-6 sm:-mt-6 sm:mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Coluna esquerda: nome, sexo, preview */}
          <div className="space-y-4 sm:space-y-6 animate-fadeIn">
            <input
              type="text"
              placeholder={t("char.name", locale)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="game-input w-full text-base"
              maxLength={16}
            />

            <div className="flex gap-3">
              {(["male", "female"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold touch-target ${
                    sex === s 
                      ? "border-[#d4a843] bg-[#d4a843]/15 shadow-[0_0_15px_rgba(212,168,67,0.25)] text-white" 
                      : "border-white/10 hover:border-white/25 text-gray-300"
                  }`}
                >
                  {s === "male" ? "♂️" : "♀️"} {s === "male" ? t("char.male", locale) : t("char.female", locale)}
                </button>
              ))}
            </div>

            {/* Preview do personagem — responsivo */}
            <div className="game-card p-4 sm:p-6 text-center animate-float border-[#d4a843]/25" style={{ boxShadow: '0 0 30px rgba(212,168,67,0.08)' }}>
              <img
                src={classImage(classType, sex)}
                alt={`${sex}-${classType}`}
                className="w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 mx-auto mb-3 sm:mb-4 rounded-xl border-2 border-[#d4a843]/35 object-cover shadow-[0_0_30px_rgba(212,168,67,0.25)]"
              />
              <div className="font-display text-xl sm:text-2xl font-bold text-white tracking-wide">{name || "..."}</div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">{CLASS_ICONS[classType]} {t(`class.${classType}`, locale)}</div>
            </div>
          </div>

          {/* Coluna direita: seleção de classe + stats */}
          <div className="space-y-4 sm:space-y-6 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            {/* Grid de classes — scroll horizontal no mobile, grid no desktop */}
            <div className="flex lg:grid lg:grid-cols-2 gap-2 sm:gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:max-h-[300px] lg:overflow-y-auto lg:pr-2">
              {CLASS_LIST.map(cls => (
                <button 
                  key={cls} 
                  onClick={() => setClassType(cls)}
                  className={`game-card p-3 sm:p-4 rounded-xl border-2 transition-all text-left flex-shrink-0 w-[140px] lg:w-auto touch-target ${
                    classType === cls 
                      ? "border-[#d4a843] shadow-[0_0_14px_rgba(212,168,67,0.25)] bg-[#d4a843]/10" 
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="text-xl sm:text-2xl">{CLASS_ICONS[cls]}</div>
                  <div className="text-xs sm:text-sm font-semibold mt-1">{t(`class.${cls}`, locale)}</div>
                </button>
              ))}
            </div>

            {/* Stats da classe — responsivo */}
            <div className="game-card p-4 sm:p-6 border-gray-700">
              <div className="font-display text-base sm:text-lg font-bold text-[#f0c86a] mb-2 sm:mb-3 tracking-wide">
                {CLASS_ICONS[classType]} {t(`class.${classType}`, locale)}
              </div>
              <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">{t(`class.${classType}.desc`, locale)}</p>
              
              <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-3">
                {[
                  { label: "HP", val: stats.hp, icon: "❤️" },
                  { label: "ATK", val: stats.attack, icon: "⚔️" },
                  { label: "DEF", val: stats.defense, icon: "🛡️" },
                  { label: "SPD", val: stats.speed, icon: "💨" },
                  { label: "CRT", val: stats.critical + "%", icon: "💥" },
                  { label: "MAN", val: stats.mana, icon: "🔮" }
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 p-2 sm:p-2.5 rounded-lg text-[11px] sm:text-xs">
                    <span className="text-gray-300">{s.icon} {s.label}: </span>
                    <span className="font-bold text-white">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Botão criar — responsivo */}
        <div className="mt-6 sm:mt-8">
          {error && (
            <div className="text-red-400 text-center mb-4 bg-red-900/20 border border-red-500/30 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          <button 
            onClick={handleCreate} 
            disabled={loading} 
            className="game-btn w-full py-3.5 sm:py-4 text-lg sm:text-xl font-bold touch-target glow-ring font-display tracking-widest uppercase"
          >
             {loading ? (
               <span className="flex items-center justify-center gap-2">
                 <span className="spinner w-5 h-5 border-2" />
                 {t("general.loading", locale)}
               </span>
             ) : (
               <>
                 <span className="text-xl">⚔️</span> {t("char.confirm", locale)}
               </>
             )}
          </button>
        </div>
      </div>
    </div>
  );
}
