"use client";
import { useGameStore } from "@/store/gameStore";
import AuthScreen from "@/components/AuthScreen";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";
import ServerNotice from "@/components/ServerNotice";

export default function Home() {
  const { isLoggedIn, hasCharacter } = useGameStore();

  return (
    <>
      {/* Avisos globais + bloqueio de manutenção — aparecem ANTES de qualquer tela carregar */}
      <ServerNotice />
      {!isLoggedIn ? <AuthScreen /> : !hasCharacter ? <CharacterCreation /> : <GameScreen />}
    </>
  );
}
