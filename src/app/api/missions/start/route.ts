import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier } from "@/game/boosts";

export async function POST(req: NextRequest) {
  try {
    const { characterId, missionId } = await req.json();
    
    if (!characterId || !missionId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    
    const char = await jsonDb.findCharacterById(characterId);
    if (!char) {
      return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });
    }

    // VERIFICAR SE JÁ TEM UMA MISSÃO ATIVA (NÃO CONCLUÍDA)
    const existingMission = await jsonDb.findActiveMissionByCharacterId(characterId);
    if (existingMission) {
      return NextResponse.json({ error: "Você já tem uma missão em andamento! Complete-a primeiro." }, { status: 400 });
    }

    const mission = await jsonDb.getMissionTemplateById(missionId);
    if (!mission) {
      return NextResponse.json({ error: "Missão não encontrada" }, { status: 404 });
    }

    const now = new Date();

    // Aplica a recarga passiva de energia ANTES de verificar/gastar.
    const regen = computeEnergyRegen(char, now, energyMultiplier(char));
    const currentEnergy = regen.energy;

    if (currentEnergy < mission.energyCost) {
      return NextResponse.json({ error: "Energia insuficiente!" }, { status: 400 });
    }

    if (char.level < mission.minLevel) {
      return NextResponse.json({ error: `Nível ${mission.minLevel} necessário!` }, { status: 400 });
    }

    const endsAt = new Date(now.getTime() + mission.durationSec * 1000);

    // Deduzir energia (timer de recarga recomeça a partir deste momento)
    await jsonDb.updateCharacter(characterId, {
      energy: currentEnergy - mission.energyCost,
      lastEnergyAt: now.toISOString(),
      lastActivity: now.toISOString(),
    });

    // Criar missão ativa
    const active = await jsonDb.insertActiveMission({ characterId, missionId, startedAt: now.toISOString(), endsAt: endsAt.toISOString(), claimed: false });

    return NextResponse.json({ success: true, mission: active, endsAt: endsAt.toISOString(), message: "Missão iniciada!" });
  } catch (e: unknown) {
    console.error("Mission start error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
