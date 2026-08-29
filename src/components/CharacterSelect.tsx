"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { CLASS_ICONS, classImage, MAX_CHARACTERS_PER_ACCOUNT, type ClassName } from "@/game/constants";

export default function CharacterSelect() {
  const { characters, setCharacter, setCreatingCharacter, logout, locale, notify } = useGameStore();
  const [busy, setBusy] = useState<string | null>(null);

  const enter = async (c: any) => {
    if (busy) return;
    setBusy(c.id);
    try {
      // Carrega o personagem completo antes de entrar.
      const res = await fetch(`/api/character?id=${c.id}`);
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Erro ao entrar no personagem", "error");
        return;
      }
      if (data.character) {
        setCharacter(data.character);
      } else {
        notify("Personagem não encontrado", "error");
      }
    } catch {
      notify("Erro ao entrar no personagem", "error");
    } finally {
      setBusy(null);
    }
  };

  const createNew = () => {
    // Vai para a tela de criação de personagem (CharacterCreation).
    setCreatingCharacter(true);
  };

  const slotsLeft = Math.max(0, MAX_CHARACTERS_PER_ACCOUNT - (characters?.length || 0));

  return (
    <div className="min-h-[100dvh] min-h-screen bg-[#060a14] relative overflow-hidden p-4 sm:p-6 flex items-center justify-center font-sans safe-bottom">
      {/* Background — brilhos do reino */}
      <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] bg-[#d4a843]/8 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-indigo-900/25 rounded-full blur-[100px] animate-floatSlow" />
      <div className="vignette absolute inset-0" />

      <div className="w-full max-w-3xl relative z-10 animate-fadeInUp">
        {/* Header — responsivo */}
        <div className="text-center mb-6 sm:mb-8 px-2">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text tracking-wide">
            {t("char.select.title", locale)}
          </h1>
          <div className="ornate-rule w-40 sm:w-56 mx-auto mt-3" />
          <p className="mt-3 text-xs sm:text-sm text-gray-400">
            {t("char.select.subtitle", locale).replace("{0}", String(characters?.length || 0)).replace("{1}", String(MAX_CHARACTERS_PER_ACCOUNT))}
          </p>
        </div>

        {/* Grid de personagens — 1 coluna no mobile, 2 no desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {(characters || []).map((c: any) => {
            const cls = (c.classType as ClassName) || "warrior";
            const sex = (c.sex as string) || "male";
            return (
              <div 
                key={c.id} 
                className="game-card p-4 flex flex-col gap-3 transition-all card-hover border-white/10 hover:border-[#d4a843]/40"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img
                      src={classImage(cls, sex)}
                      alt={c.name}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 border-[#d4a843]/25 object-cover shadow-[0_0_14px_rgba(212,168,67,0.12)]"
                      draggable={false}
                    />
                    <div className="absolute -bottom-1 -right-1 grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-[#d4a843]/30 bg-[#0f141f] text-sm">
                      {CLASS_ICONS[cls]}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base sm:text-lg font-display font-bold text-white tracking-wide">{c.name}</p>
                    <p className="text-[11px] sm:text-xs text-gray-400">
                      {t(`class.${cls}`, locale)} · Lv.{Number(c.level) || 1}
                    </p>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#f0c86a] font-bold">
                      ⚡ {Number(c.power || 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void enter(c)}
                  disabled={busy !== null}
                  className="game-btn w-full py-2.5 sm:py-3 text-sm sm:text-base font-bold touch-target"
                >
                  {busy === c.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="spinner w-4 h-4 border-2" />
                      {t("general.loading", locale)}
                    </span>
                  ) : (
                    <>
                      <span className="text-base">⚔️</span> {t("char.select.enter", locale)}
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {/* Slot para criar um novo personagem */}
          {slotsLeft > 0 && (
            <button
              onClick={createNew}
              className="game-card flex min-h-[120px] sm:min-h-[150px] flex-col items-center justify-center gap-2 border-dashed p-4 text-gray-500 transition-all hover:border-[#d4a843]/60 hover:text-white card-hover touch-target"
            >
              <span className="text-3xl sm:text-4xl opacity-60">⚜️</span>
              <span className="text-xs sm:text-sm font-bold tracking-wide">{t("char.select.create", locale)}</span>
              <span className="text-[10px] text-gray-600">
                {slotsLeft} {t("char.select.slot", locale)}
              </span>
            </button>
          )}
        </div>

        {/* Botão voltar — responsivo */}
        <button
          onClick={() => logout()}
          className="mx-auto mt-6 sm:mt-8 block text-xs sm:text-sm text-gray-500 transition hover:text-white touch-target"
        >
          ← {t("char.select.back", locale)}
        </button>
      </div>
    </div>
  );
}
