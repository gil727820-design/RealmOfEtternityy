import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { ACHIEVEMENTS, getAchievementById } from "@/game/achievements";
import { TITLES, getUnlockedTitles } from "@/game/titles";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    // Só o dono pode ver as conquistas/títulos do próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const claimed = Array.isArray(char.achievements) ? (char.achievements as string[]) : [];
    const ownedTitles = Array.isArray(char.titles) ? (char.titles as string[]) : [];

    const achievements = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      nameKey: a.nameKey,
      descKey: a.descKey,
      icon: a.icon,
      category: a.category,
      rarity: a.rarity,
      reward: a.reward,
      unlocked: a.condition(char),
      claimed: claimed.includes(a.id),
      progress: a.progress ? a.progress(char) : undefined,
    }));

    // Títulos: desbloquear gera a lista; owned mantém histórico
    const unlockedTitles = getUnlockedTitles(char);
    const titles = TITLES.map((tt) => {
      const unlockedByCond = tt.condition(char);
      return {
        id: tt.id,
        nameKey: tt.nameKey,
        icon: tt.icon,
        rarity: tt.rarity,
        unlocked: unlockedByCond,
        owned: ownedTitles.includes(tt.id) || unlockedByCond,
        active: char.activeTitle === tt.id,
      };
    });

    return NextResponse.json({ achievements, titles, activeTitle: char.activeTitle || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const { characterId } = body;
    if (!characterId) return NextResponse.json({ error: "characterId necessário" }, { status: 400 });

    // Só o dono pode coletar conquistas/equipar títulos do próprio personagem.
    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // ---- Coletar recompensa de conquista ----
    if (action === "claim") {
      const { achievementId } = body;
      const def = getAchievementById(String(achievementId));
      if (!def) return NextResponse.json({ error: "Conquista não encontrada" }, { status: 404 });
      if (!def.condition(char)) {
        return NextResponse.json({ error: "Conquista ainda não desbloqueada" }, { status: 400 });
      }
      const claimed = Array.isArray(char.achievements) ? (char.achievements as string[]) : [];
      if (claimed.includes(def.id)) {
        return NextResponse.json({ error: "Recompensa já coletada" }, { status: 400 });
      }
      const gold = (char.gold || 0) + (def.reward.gold || 0);
      const crystals = (char.crystals || 0) + (def.reward.crystals || 0);
      const diamonds = (char.diamonds || 0) + (def.reward.diamonds || 0);
      await jsonDb.updateCharacter(char.id, {
        gold,
        crystals,
        diamonds,
        achievements: [...claimed, def.id],
      });
      return NextResponse.json({
        success: true,
        reward: def.reward,
        character: await jsonDb.findCharacterById(char.id),
      });
    }

    // ---- Equipar título ----
    if (action === "equip_title") {
      const { titleId } = body;
      const title = TITLES.find((x) => x.id === String(titleId));
      if (!title) return NextResponse.json({ error: "Título não encontrado" }, { status: 404 });
      if (!title.condition(char)) {
        return NextResponse.json({ error: "Título ainda não desbloqueado" }, { status: 400 });
      }
      const owned = Array.isArray(char.titles) ? (char.titles as string[]) : [];
      const nextTitles = owned.includes(title.id) ? owned : [...owned, title.id];
      const updated = await jsonDb.updateCharacter(char.id, {
        titles: nextTitles,
        activeTitle: title.id === char.activeTitle ? null : title.id, // toggle
      });
      return NextResponse.json({ success: true, character: updated });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Achievements error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}