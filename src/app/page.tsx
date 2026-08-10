"use client";
import { useGameStore } from "@/store/gameStore";
import AuthScreen from "@/components/AuthScreen";
import CharacterCreation from "@/components/CharacterCreation";
import GameScreen from "@/components/GameScreen";

export default function Home() {
  const { isLoggedIn, hasCharacter } = useGameStore();

  if (!isLoggedIn) return <AuthScreen />;
  if (!hasCharacter) return <CharacterCreation />;
  return <GameScreen />;
}
