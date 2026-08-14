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
      const res = await fetch(`/api/character/${c.id}`);
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
    <div className="min-h-screen bg-[#050505] relative overflow-hidden p-4 flex items-center justify-center font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] animate-float"></div>

      <div className="w-full max-w-3xl relative z-10 animate-fadeInUp">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text">🗺️ {t("char.select.title", locale)}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {t("char.select.subtitle", locale).replace("{0}", String(characters?.length || 0)).replace("{1}", String(MAX_CHARACTERS_PER_ACCOUNT))}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(characters || []).map((c: any) => {
            const cls = (c.classType as ClassName) || "warrior";
            const sex = (c.sex as string) || "male";
            return (
              <div key={c.id} className="game-card p-4 flex flex-col gap-3 transition-all hover:border-white/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={classImage(cls, sex)}
                      alt={c.name}
                      className="h-20 w-20 rounded-xl border-2 border-white/10 object-cover"
                      draggable={false}
                    />
                    <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-[#0f141f] text-sm">
                      {CLASS_ICONS[cls]}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black text-white">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {t(`class.${cls}`, locale)} · Lv.{Number(c.level) || 1}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#ffd700]">⚡ {Number(c.power || 0).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <button
                  onClick={() => void enter(c)}
                  disabled={busy !== null}
                  className="game-btn w-full"
                >
                  {busy === c.id ? t("general.loading", locale) : `🎮 ${t("char.select.enter", locale)}`}
                </button>
              </div>
            );
          })}

          {/* Slot para criar um novo personagem */}
          {slotsLeft > 0 && (
            <button
              onClick={createNew}
              className="game-card flex min-h-[150px] flex-col items-center justify-center gap-2 border-dashed p-4 text-gray-500 transition-all hover:border-[#e94560]/60 hover:text-white"
            >
              <span className="text-4xl opacity-60">➕</span>
              <span className="text-sm font-bold">{t("char.select.create", locale)}</span>
              <span className="text-[10px] text-gray-600">
                {slotsLeft} {t("char.select.slot", locale)}
              </span>
            </button>
          )}
        </div>

        <button
          onClick={() => logout()}
          className="mx-auto mt-8 block text-sm text-gray-500 transition hover:text-white"
        >
          {t("char.select.back", locale)}
        </button>
      </div>
    </div>
  );
}
