import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { GUILD_SKILLS, guildSkillTotalCost, guildSkillBonus } from "@/game/guildSkills";

/** GET: retorna skills da guilda e níveis atuais. */
export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const guildId = char.guildId;
    if (!guildId) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 400 });

    const guild = await jsonDb.findGuildById(String(guildId));
    if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

    const skills = (guild as any).skills || {};
    const coins = (guild as any).guildCoins || 0;

    const skillData = GUILD_SKILLS.map((s) => ({
      ...s,
      currentLevel: skills[s.id] || 0,
      upgradeCost: guildSkillTotalCost(s, (skills[s.id] || 0) + 1),
      currentBonus: guildSkillBonus(s, skills[s.id] || 0),
      canUpgrade: (skills[s.id] || 0) < s.maxLevel && coins >= guildSkillTotalCost(s, (skills[s.id] || 0) + 1),
    }));

    return NextResponse.json({ skills: skillData, guildCoins: coins, guildId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST: upgrade uma skill da guilda. */
export async function POST(req: NextRequest) {
  try {
    const { characterId, skillId } = await req.json();
    if (!characterId || !skillId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;

    const char = auth.char;
    const guildId = char.guildId;
    if (!guildId) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 400 });

    // Só líder ou oficial pode upar skills
    const rank = String(char.guildRank || "member");
    if (rank !== "leader" && rank !== "officer") {
      return NextResponse.json({ error: "Apenas líderes e oficiais podem melhorar skills" }, { status: 403 });
    }

    const guild = await jsonDb.findGuildById(String(guildId));
    if (!guild) return NextResponse.json({ error: "Guilda não encontrada" }, { status: 404 });

    const skill = GUILD_SKILLS.find((s) => s.id === skillId);
    if (!skill) return NextResponse.json({ error: "Skill inválida" }, { status: 400 });

    const skills = (guild as any).skills || {};
    const currentLevel = skills[skillId] || 0;
    if (currentLevel >= skill.maxLevel) return NextResponse.json({ error: "Skill já está no nível máximo" }, { status: 400 });

    const cost = guildSkillTotalCost(skill, currentLevel + 1);
    const coins = (guild as any).guildCoins || 0;
    if (coins < cost) return NextResponse.json({ error: `Moedas insuficientes (${coins}/${cost})` }, { status: 400 });

    // Deduz moedas e sobe skill
    const newSkills = { ...skills, [skillId]: currentLevel + 1 };
    await jsonDb.updateGuild(String(guildId), {
      guildCoins: coins - cost,
      skills: newSkills,
    });

    return NextResponse.json({
      success: true,
      message: `${skill.icon} ${skill.nameKey} subiu para nível ${currentLevel + 1}!`,
      skillId,
      newLevel: currentLevel + 1,
      cost,
      guildCoins: coins - cost,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
