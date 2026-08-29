import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { QUESTLINES, getQuestlineProgress } from "@/game/questlines";
import { requireCharacterAuth } from "@/game/auth";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const completedQuestlines = Array.isArray(char.completedQuestlines) ? char.completedQuestlines : [];
    const completedSteps = Array.isArray(char.completedQuestSteps) ? char.completedQuestSteps : [];

    const questlines = QUESTLINES.map((ql) => {
      const progress = getQuestlineProgress(ql, char, completedSteps);
      const isCompleted = completedQuestlines.includes(ql.id);

      return {
        id: ql.id,
        name: ql.name,
        description: ql.description,
        icon: ql.icon,
        category: ql.category,
        difficulty: ql.difficulty,
        steps: progress.steps.map((s) => ({
          id: s.step.id,
          name: s.step.name,
          description: s.step.description,
          icon: s.step.icon,
          objective: s.step.objective,
          reward: s.step.reward,
          done: s.done,
          canClaim: s.done && !completedSteps.includes(s.step.id),
        })),
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        completed: isCompleted,
        finalReward: ql.finalReward,
      };
    });

    return NextResponse.json({ questlines });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, action, questlineId, stepId } = body;

    if (!characterId) {
      return NextResponse.json({ error: "characterId necessario" }, { status: 400 });
    }

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    if (action === "claim_step") {
      if (!stepId) {
        return NextResponse.json({ error: "stepId necessario" }, { status: 400 });
      }

      const completedSteps = Array.isArray(char.completedQuestSteps) ? char.completedQuestSteps : [];
      if (completedSteps.includes(stepId)) {
        return NextResponse.json({ error: "Passo ja coletado" }, { status: 400 });
      }

      // Find the step in any questline
      let foundStep: any = null;
      let foundQuestline: any = null;
      for (const ql of QUESTLINES) {
        const step = ql.steps.find((s) => s.id === stepId);
        if (step) {
          foundStep = step;
          foundQuestline = ql;
          break;
        }
      }

      if (!foundStep || !foundQuestline) {
        return NextResponse.json({ error: "Passo nao encontrado" }, { status: 404 });
      }

      // Check if condition is met
      if (!foundStep.condition(char)) {
        return NextResponse.json({ error: "Condicao ainda nao atendida" }, { status: 400 });
      }

      // Check if previous steps are completed
      const stepIndex = foundQuestline.steps.findIndex((s: any) => s.id === stepId);
      for (let i = 0; i < stepIndex; i++) {
        if (!completedSteps.includes(foundQuestline.steps[i].id)) {
          return NextResponse.json({ error: "Complete os passos anteriores primeiro" }, { status: 400 });
        }
      }

      // Apply step reward
      const patch: any = { completedQuestSteps: [...completedSteps, stepId] };
      if (foundStep.reward.gold) patch.gold = (char.gold || 0) + foundStep.reward.gold;
      if (foundStep.reward.crystals) patch.crystals = (char.crystals || 0) + foundStep.reward.crystals;
      if (foundStep.reward.diamonds) patch.diamonds = (char.diamonds || 0) + foundStep.reward.diamonds;
      if (foundStep.reward.xp) {
        const newXp = (char.xp || 0) + foundStep.reward.xp;
        patch.xp = newXp;
      }

      // Check if questline is now complete
      const allStepsCompleted = foundQuestline.steps.every((s: any) =>
        [...completedSteps, stepId].includes(s.id)
      );

      if (allStepsCompleted) {
        const completedQuestlines = Array.isArray(char.completedQuestlines) ? char.completedQuestlines : [];
        patch.completedQuestlines = [...completedQuestlines, foundQuestline.id];

        // Apply final reward
        const final = foundQuestline.finalReward;
        if (final.gold) patch.gold = (patch.gold || char.gold || 0) + final.gold;
        if (final.crystals) patch.crystals = (patch.crystals || char.crystals || 0) + final.crystals;
        if (final.diamonds) patch.diamonds = (patch.diamonds || char.diamonds || 0) + final.diamonds;
      }

      await jsonDb.updateCharacter(characterId, patch);
      const updated = await jsonDb.findCharacterById(characterId);

      return NextResponse.json({
        success: true,
        step: foundStep,
        questlineComplete: allStepsCompleted,
        finalReward: allStepsCompleted ? foundQuestline.finalReward : null,
        character: updated,
      });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
