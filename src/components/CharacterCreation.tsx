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
    <div className="min-h-screen bg-[#050505] relative overflow-hidden p-4 flex items-center justify-center font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] animate-float"></div>

      <div className="w-full max-w-4xl relative z-10 animate-fadeInUp">
        <button
          onClick={goBack}
          disabled={loading}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-gray-300 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50"
        >
          ← {t("char.create.back", locale)}
        </button>

        <h1 className="text-4xl font-bold text-center mb-8 gradient-text">
          {t("char.create", locale)} ⚔️
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6 animate-fadeIn">
            <input
              type="text"
              placeholder={t("char.name", locale)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="game-input w-full"
            />

            <div className="flex gap-4">
              {(["male", "female"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`flex-1 py-3 rounded-lg border-2 transition-all ${sex === s ? "border-accent bg-accent/20" : "border-white/10 hover:border-white/20"}`}
                >
                  {s === "male" ? "♂️" : "♀️"} {s === "male" ? t("char.male", locale) : t("char.female", locale)}
                </button>
              ))}
            </div>

            <div className="game-card game-card-accent p-6 text-center animate-float">
              <img
                src={classImage(classType, sex)}
                alt={`${sex}-${classType}`}
                className="w-40 h-40 mx-auto mb-4 rounded-xl border-2 border-accent/30 object-cover shadow-[0_0_30px_rgba(233,69,96,0.3)]"
              />
              <div className="text-2xl font-bold text-white">{name || "..."}</div>
              <div className="text-sm text-gray-400 mt-2">{CLASS_ICONS[classType]} {t(`class.${classType}`, locale)}</div>
            </div>
          </div>

          <div className="space-y-6 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {CLASS_LIST.map(cls => (
                <button key={cls} onClick={() => setClassType(cls)}
                  className={`game-card p-4 rounded-xl border-2 transition-all text-left ${classType === cls ? "border-accent" : "border-white/10 hover:border-white/20"}`}>
                  <div className="text-xl">{CLASS_ICONS[cls]}</div>
                  <div className="text-sm font-semibold mt-1">{t(`class.${cls}`, locale)}</div>
                </button>
              ))}
            </div>

            <div className="game-card p-6 border-gray-700">
              <div className="text-lg font-bold text-purple-400 mb-2">{CLASS_ICONS[classType]} {t(`class.${classType}`, locale)}</div>
              <p className="text-sm text-gray-400 mb-4">{t(`class.${classType}.desc`, locale)}</p>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "HP", val: stats.hp, icon: "❤️" },
                  { label: "ATK", val: stats.attack, icon: "⚔️" },
                  { label: "DEF", val: stats.defense, icon: "🛡️" },
                  { label: "SPD", val: stats.speed, icon: "💨" },
                  { label: "CRT", val: stats.critical + "%", icon: "💥" },
                  { label: "MAN", val: stats.mana, icon: "🔮" }
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 p-2 rounded-lg text-xs">
                    <span className="text-gray-300">{s.icon} {s.label}: </span>
                    <span className="font-bold">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {error && <div className="text-red-400 text-center mb-4 bg-red-900/20 p-2 rounded-lg">{error}</div>}
          <button onClick={handleCreate} disabled={loading} className="game-btn w-full py-4 text-xl">
             {loading ? t("general.loading", locale) : `⚔️ ${t("char.confirm", locale)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
