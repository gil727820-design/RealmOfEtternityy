import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { missionXpReward } from "@/game/constants";
import { computeEnergyRegen } from "@/game/energy";
import { energyMultiplier, xpMultiplier } from "@/game/boosts";
import { computeAfkRewards } from "@/game/afk";
import { computeDungeonStatus } from "@/game/dungeons";

// Calculate AFK rewards (buffado — fórmula compartilhada via @/game/afk)
function calcAfkRewards(char: any) {
  const r = computeAfkRewards(char, char.afkSince, new Date());
  return { gold: r.gold, xp: r.xp * xpMultiplier(char), duration: r.diffSec };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const char = await jsonDb.findCharacterById(id);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    // Conta banida? Bloqueia o acesso imediatamente (logout no cliente).
    const owner = char.userId ? await jsonDb.findUserById(char.userId) : null;
    if (owner?.banned) {
      return NextResponse.json(
        { error: `Conta banida: ${owner.banReason || "Violação dos termos"}` },
        { status: 403 }
      );
    }
    // Conta excluída (soft delete) — bloqueia o acesso e força logout.
    if (owner?.deleted) {
      return NextResponse.json(
        { error: "Conta excluída pela administração." },
        { status: 403 }
      );
    }

    // Aplica a recarga passiva de energia (1 a cada ENERGY_REGEN_MINUTES min)
    // antes de devolver o personagem ao cliente, e expõe o tempo até a próxima
    // energia para o contador da interface.
    const regenNow = new Date();
    const regen = computeEnergyRegen(char, regenNow, energyMultiplier(char));
    if (regen.gained > 0) {
      await jsonDb.updateCharacter(char.id, {
        energy: regen.energy,
        lastEnergyAt: regen.lastEnergyAt,
        lastActivity: regenNow.toISOString(),
      });
    }
    char.energy = regen.energy;
    (char as any).energyRegenMs = regen.msToNext;
    (char as any).energyFull = regen.full;

    // Get inventory (with templates)
    const inv = await jsonDb.getInventoryForCharacter(id);

    // Get all mission templates
    const allMissions: any[] = await jsonDb.getMissionTemplates();

    const level = char.level || 1;
    const region = char.currentRegion || "starter_village";

    // Missões do nível atual (podem ser jogadas agora)
    const eligible = allMissions.filter((m: any) =>
      (!m.region || m.region === region) && (m.minLevel || 1) <= level
    );
    // Missões "desafio": sempre geramos ao menos uma de nível (level + 1)
    const nextTier = allMissions.filter((m: any) =>
      (!m.region || m.region === region) && (m.minLevel || 1) === level + 1
    );

    const reachable = (m: any) => {
      const lv = m.minLevel || 1;
      return (!m.region || m.region === region) && lv <= level + 1;
    };

    // Reutiliza o grupo gerado até que a missão seja concluída (embaralha só na conclusão)
    let batchIds: number[] = Array.isArray(char.missionBatch)
      ? (char.missionBatch as number[]).filter((id: number) => allMissions.some((m: any) => m.id === id && reachable(m)))
      : [];

    const batchHasNextTier = nextTier.length > 0 && batchIds.some((id: number) => {
      const m = allMissions.find((x: any) => x.id === id);
      return !!m && (m.minLevel || 1) === level + 1;
    });

    if (batchIds.length === 0 || (nextTier.length > 0 && !batchHasNextTier)) {
      const guaranteed = nextTier.length ? nextTier[Math.floor(Math.random() * nextTier.length)].id : null;
      batchIds = guaranteed != null ? [guaranteed] : [];
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      for (const m of shuffled) {
        if (batchIds.length >= 3) break;
        if (!batchIds.includes(m.id)) batchIds.push(m.id);
      }
      if (batchIds.length) {
        await jsonDb.updateCharacter(char.id, { missionBatch: batchIds });
      }
    }

    const availableMissions = batchIds
      .map((id) => allMissions.find((m: any) => m.id === id))
      .filter(Boolean)
      .map((m: any) => ({ ...m, effectiveXp: missionXpReward(m) }));

    // Get active missions (not claimed) with their templates
    const activeMission = await jsonDb.findActiveMissionByCharacterId(id);
    const activeMissions: any[] = [];
    if (activeMission) {
      const template = await jsonDb.getMissionTemplateById(activeMission.missionId);
      if (template) {
        activeMissions.push({ active: activeMission, template });
      }
    }

    // Calc AFK
    const afk = calcAfkRewards(char);

    // Masmorra off-line: expedição ativa + limites diários + prévia de recompensas
    const dungeonStatus = computeDungeonStatus(char);

    // Caixa de correio: pendências para o badge no TopBar
    const mailboxCount = await jsonDb.countUnclaimedMails(id);

    return NextResponse.json({ character: char, inventory: inv, activeMissions, availableMissions, afkRewards: afk, dungeonStatus, mailboxCount });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
