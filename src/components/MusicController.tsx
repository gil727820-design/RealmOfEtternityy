"use client";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * Toca em loop a música da ilha atual (se a administração enviou uma pelo painel).
 * Respeita as configurações de som (soundOn) e volume do jogador.
 *
 * Correções de autoplay/upload:
 *  1. Busca a lista de músicas ao montar, a cada 15s E ao voltar para a aba do
 *     jogo (visibilitychange) — um upload feito pelo admin com o jogo já aberto
 *     passa a tocar sem precisar recarregar a página.
 *  2. O navegador bloqueia áudio sem interação do usuário, então o primeiro
 *     play() pode rejeitar. Escutamos a primeira interação (clique/tecla/toque)
 *     e tentamos tocar de novo — a música passa a funcionar no jogo.
 */
export default function MusicController() {
  const { character, soundOn, volume } = useGameStore();
  const [files, setFiles] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const interactedRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  // Busca a lista de músicas ao montar, a cada 15s e ao voltar para a aba.
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/region/audio")
        .then((r) => r.json())
        .then((d) => {
          if (active && d?.files) setFiles(d.files as Record<string, string>);
        })
        .catch(() => { /* sem música → silêncio */ });
    };
    load();
    const id = setInterval(load, 15000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const region = (character?.currentRegion as string) || "starter_village";

  // Volume sempre em dia
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Na primeira interação do usuário, tenta tocar de novo (o navegador libera o áudio).
  useEffect(() => {
    const tryResume = () => {
      interactedRef.current = true;
      // Força o effect da música rodar de novo (se houver fonte pendente).
      setRetryTick((t) => t + 1);
    };
    window.addEventListener("pointerdown", tryResume);
    window.addEventListener("keydown", tryResume);
    window.addEventListener("touchstart", tryResume);
    return () => {
      window.removeEventListener("pointerdown", tryResume);
      window.removeEventListener("keydown", tryResume);
      window.removeEventListener("touchstart", tryResume);
    };
  }, [soundOn]);

  // Troca/pausa a música conforme a ilha + preferências.
  // `retryTick` força o effect rodar de novo após a interação.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = files[region];

    if (!src || !soundOn) {
      audio.pause();
      return;
    }
    const absolute = new URL(src, window.location.origin).href;
    if (audio.src !== absolute) {
      audio.src = absolute;
      audio.loop = true;
      audio.volume = volume;
      audio.load();
    }
    // Sempre tenta play: se o navegador permitir (usuário já interagiu com a
    // página), toca na hora; se bloquear, a interação seguinte retoma (tryResume).
    const p = audio.play();
    if (p) p.catch(() => { /* autoplay bloqueado até interação */ });
  }, [region, files, soundOn, volume, retryTick]);

  // Fallback de loop: se o atributo `loop` não for respeitado (alguns navegadores
  // ao trocar a fonte com load()), reinicia manualmente ao terminar.
  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio || !soundOn) return;
    audio.currentTime = 0;
    const p = audio.play();
    if (p) p.catch(() => { /* autoplay bloqueado até interação */ });
  };

  return <audio ref={audioRef} preload="auto" loop onEnded={handleEnded} />;
}
