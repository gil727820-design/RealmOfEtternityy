"use client";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * Toca em loop a música da ilha atual (se a administração enviou uma pelo painel).
 * Respeita as configurações de som (soundOn) e volume do jogador.
 */
export default function MusicController() {
  const { character, soundOn, volume } = useGameStore();
  const [files, setFiles] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Busca a lista de músicas uma única vez
  useEffect(() => {
    let active = true;
    fetch("/api/region/audio")
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.files) setFiles(d.files as Record<string, string>);
      })
      .catch(() => { /* sem música → silêncio */ });
    return () => { active = false; };
  }, []);

  const region = (character?.currentRegion as string) || "starter_village";

  // Volume sempre em dia
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Troca/pausa a música conforme a ilha + preferências
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
    const p = audio.play();
    if (p) p.catch(() => { /* autoplay bloqueado até interação */ });
  }, [region, files, soundOn, volume]);

  return <audio ref={audioRef} preload="auto" loop />;
}