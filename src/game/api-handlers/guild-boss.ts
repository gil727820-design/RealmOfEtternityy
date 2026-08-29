import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";
import { grantGuildXp } from "@/game/guildLevels";
import {
  ensureGuildBoss,
  applyGuildBossAttack,
  guildBossCanFreeAttack,
  guildBossTotalDamage,
  guildBossRanking,
  guildBossRewardFor,
  guildBossWeekKey,
  guildBossMaxHp,
  GUILD_BOSS_EXTRA_ATTACK_COST,
} from "@/game/guildBoss";
import { seasonPatch } from "@/game/season";
import { bossBattleStart, bossBattleStep } from "@/game/bossBattle";

/** Imagem do Boss de Guilda — reutilizada dos chefes da torre (sem asset novo). */
const GUILD_BOSS_IMAGE = "/images/tower/monsters/realm_of_eternity_void_wyrm_clean.png";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const guild = await jsonDb.findGuildByMemberId(String(characterId));
    if (!guild) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 404 });

    const boss = ensureGuildBoss(guild);
    const weekKey = guildBossWeekKey();
    // Se o estado da semana mudou, persiste o reset.
    if (guild?.guildBoss?.weekKey !== weekKey) {
      await jsonDb.updateGuild(String(guild.id), { guildBoss: boss });
    }

    const ranking = guildBossRanking(boss);
    const myId = String(characterId);
    const myRank = ranking.findIndex((r) => r.characterId === myId);

    return NextResponse.json({
      guildId: String(guild.id),
      boss: {
        weekKey: boss.weekKey,
        bossHp: boss.bossHp,
        bossMaxHp: boss.bossMaxHp,
        defeated: boss.bossHp <= 0,
        defeatedAt: boss.defeatedAt,
        totalDamage: guildBossTotalDamage(boss),
        freeAttacksLeft: guildBossCanFreeAttack(boss, myId) ? 1 : 0,
        extraCost: GUILD_BOSS_EXTRA_ATTACK_COST,
        ranking: ranking.map((r) => ({ ...r, me: r.characterId === myId })),
        myRank: myRank >= 0 ? myRank + 1 : null,
        myDmg: Number(boss.hits?.[myId]?.dmg) || 0,
      },
      gold: char.gold || 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterId, extra } = body;
    if (!characterId) return NextResponse.json({ error: "Personagem é obrigatório" }, { status: 400 });

    const auth = await requireCharacterAuth(req, String(characterId));
    if (!auth.ok) return auth.response;
    const char = auth.char;

    const guild = await jsonDb.findGuildByMemberId(String(characterId));
    if (!guild) return NextResponse.json({ error: "Você não está em uma guilda" }, { status: 404 });

    const boss = ensureGuildBoss(guild);
    if (boss.bossHp <= 0) return NextResponse.json({ error: "O Boss de Guilda já foi derrotado esta semana!" }, { status: 400 });

    // Compra de ataque extra: valida ouro antes de lutar.
    if (extra) {
      if ((Number(char.gold) || 0) < GUILD_BOSS_EXTRA_ATTACK_COST) {
        return NextResponse.json(
          { error: `Requer ${GUILD_BOSS_EXTRA_ATTACK_COST.toLocaleString()} de ouro para um ataque extra` },
          { status: 400 }
        );
      }
      await jsonDb.updateCharacter(String(characterId), { gold: (Number(char.gold) || 0) - GUILD_BOSS_EXTRA_ATTACK_COST });
    }

    // Monstro da batalha pessoal (imagem da torre, stats escalados ao jogador
    // para a luta ser justa — o dano da luta vira dano no raid compartilhado).
    const monster = {
      nameKey: "gb.title",
      image: GUILD_BOSS_IMAGE,
      icon: "🐲",
      stats: {
        maxHp: Math.max(500, Math.round(guildBossMaxHp(guild) / 200)),
        attack: Math.max(10, Math.round((Number(char.maxHp) || 100) * 0.18)),
        defense: Math.max(5, Math.round((Number(char.defense) || 10) * 0.6)),
        speed: Math.max(1, Math.round((Number(char.speed) || 5) * 0.7 * 100) / 100),
        critical: Math.min(25, Math.round((Number(char.critical) || 5) * 0.5)),
        dodge: Math.min(10, Math.round((Number(char.dodge) || 2) * 0.4 * 10) / 10),
      },
      boss: true,
    };

    const action = String(body?.action || "");
    const state = body?.state as any;

    // ---- BATALHA IGUAL À TORRE ----
    if (action === "start") {
      const { battle } = bossBattleStart(char, monster);
      return NextResponse.json({ ok: true, action, battle, log: [], events: [], won: false, lost: false });
    }

    if (action) {
      if (!state || typeof state.monHp !== "number") {
        return NextResponse.json({ error: "Estado de batalha inválido" }, { status: 400 });
      }
      const step = bossBattleStep(char, monster, state, action, body?.auto || undefined);
      if (step.error) {
        const status = step.code === "battle_expired" ? 410 : 400;
        return NextResponse.json({ error: step.error, code: step.code }, { status });
      }

      // Fim da luta pessoal → aplica o dano no raid compartilhado.
      // Vitória = dano cheio; derrota = ainda arranha o boss (40% do dano).
      const power = Number(char.power) || 0;
      const dmgPower = step.won ? power : Math.round(power * 0.4);
      const result = applyGuildBossAttack(boss, String(characterId), dmgPower, !!extra);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

      // Se derrotou: recompensas proporcionais + XP de guilda + ouro no banco.
      let defeatedRewards: Array<{ characterId: string; gold: number; crystals: number }> | null = null;
      if (result.boss.bossHp <= 0 && !result.boss.rewardsGiven) {
        result.boss.rewardsGiven = true;
        const totalDmg = guildBossTotalDamage(result.boss);
        const grants: Array<{ characterId: string; gold: number; crystals: number }> = [];
        for (const member of guild.members || []) {
          if (!member?.id) continue;
          const reward = guildBossRewardFor({ ...guild, guildBoss: result.boss }, String(member.id), totalDmg);
          const mChar = await jsonDb.findCharacterById(String(member.id));
          if (!mChar) continue;
          await jsonDb.updateCharacter(String(member.id), {
            gold: (Number(mChar.gold) || 0) + reward.gold,
            crystals: (Number(mChar.crystals) || 0) + reward.crystals,
            // XP proporcional.
            xp: (Number(mChar.xp) || 0) + Math.floor(reward.xp * 0.1),
            lastActivity: new Date().toISOString(),
          });
          grants.push({ characterId: String(member.id), gold: reward.gold, crystals: reward.crystals });
        }
        // Bônus para o banco da guilda + XP de guilda (todos os membros).
        const guildXpGain = grantGuildXp(guild, "boss");
        await jsonDb.updateGuild(String(guild.id), {
          guildBoss: result.boss,
          gold: (Number(guild.gold) || 0) + 200_000,
          xp: (Number(guild.xp) || 0) + guildXpGain.gain,
        });
        await jsonDb.insertGuildChatMessage({
          guildId: String(guild.id),
          characterId: "system",
          name: "Sistema",
          text: `🐲 O BOSS DE GUILDA FOI DERROTADO! Todos os membros receberam recompensas +200.000 🪙 no banco da guilda!`,
        });
        defeatedRewards = grants;
      } else {
        await jsonDb.updateGuild(String(guild.id), { guildBoss: result.boss });
      }

      // Temporada global: ataque ao boss de guilda dá pontos de temporada.
      await jsonDb.updateCharacter(String(characterId), seasonPatch(char, "boss"));

      // Guilda evolutiva: o dano ao boss conta como atividade.
      await grantGuildXp(guild, "boss");

      const finalGuild = await jsonDb.findGuildById(String(guild.id));
      const finalBoss = finalGuild?.guildBoss ?? result.boss;

      return NextResponse.json({
        ok: true,
        success: true,
        action,
        battle: step.battle,
        log: step.log,
        events: step.events,
        won: step.won,
        lost: !step.won,
        dmg: result.dmg,
        boss: {
          bossHp: finalBoss.bossHp,
          bossMaxHp: finalBoss.bossMaxHp,
          defeated: finalBoss.bossHp <= 0,
          totalDamage: guildBossTotalDamage(finalBoss),
          myDmg: Number(finalBoss.hits?.[String(characterId)]?.dmg) || 0,
          freeAttacksLeft: guildBossCanFreeAttack(finalBoss, String(characterId)) ? 1 : 0,
          ranking: guildBossRanking(finalBoss).map((r) => ({ ...r, me: r.characterId === String(characterId) })),
        },
        defeatedRewards,
        character: { ...char, gold: extra ? (Number(char.gold) || 0) - GUILD_BOSS_EXTRA_ATTACK_COST : Number(char.gold) || 0 },
      });
    }

    // ---- Fluxo antigo (sem action): ataque instantâneo, mantido p/ compat. ----
    const result = applyGuildBossAttack(boss, String(characterId), Number(char.power) || 0, !!extra);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    // Se derrotou: recompensas proporcionais + XP de guilda + ouro no banco.
    let defeatedRewards: Array<{ characterId: string; gold: number; crystals: number }> | null = null;
    if (result.boss.bossHp <= 0 && !result.boss.rewardsGiven) {
      result.boss.rewardsGiven = true;
      const totalDmg = guildBossTotalDamage(result.boss);
      const grants: Array<{ characterId: string; gold: number; crystals: number }> = [];
      for (const member of guild.members || []) {
        if (!member?.id) continue;
        const reward = guildBossRewardFor({ ...guild, guildBoss: result.boss }, String(member.id), totalDmg);
        const mChar = await jsonDb.findCharacterById(String(member.id));
        if (!mChar) continue;
        await jsonDb.updateCharacter(String(member.id), {
          gold: (Number(mChar.gold) || 0) + reward.gold,
          crystals: (Number(mChar.crystals) || 0) + reward.crystals,
          // XP proporcional.
          xp: (Number(mChar.xp) || 0) + Math.floor(reward.xp * 0.1),
          lastActivity: new Date().toISOString(),
        });
        grants.push({ characterId: String(member.id), gold: reward.gold, crystals: reward.crystals });
      }
      // Bônus para o banco da guilda + XP de guilda (todos os membros).
      const guildXpGain = grantGuildXp(guild, "boss");
      await jsonDb.updateGuild(String(guild.id), {
        guildBoss: result.boss,
        gold: (Number(guild.gold) || 0) + 200_000,
        xp: (Number(guild.xp) || 0) + guildXpGain.gain,
      });
      await jsonDb.insertGuildChatMessage({
        guildId: String(guild.id),
        characterId: "system",
        name: "Sistema",
        text: `🐲 O BOSS DE GUILDA FOI DERROTADO! Todos os membros receberam recompensas +200.000 🪙 no banco da guilda!`,
      });
      defeatedRewards = grants;
    } else {
      await jsonDb.updateGuild(String(guild.id), { guildBoss: result.boss });
    }

    // Temporada global: ataque ao boss de guilda dá pontos de temporada.
    await jsonDb.updateCharacter(String(characterId), seasonPatch(char, "boss"));

    // Guilda evolutiva: o dano ao boss conta como atividade.
    await grantGuildXp(guild, "boss");

    const finalGuild = await jsonDb.findGuildById(String(guild.id));
    const finalBoss = finalGuild?.guildBoss ?? result.boss;

    return NextResponse.json({
      success: true,
      dmg: result.dmg,
      boss: {
        bossHp: finalBoss.bossHp,
        bossMaxHp: finalBoss.bossMaxHp,
        defeated: finalBoss.bossHp <= 0,
        totalDamage: guildBossTotalDamage(finalBoss),
        myDmg: Number(finalBoss.hits?.[String(characterId)]?.dmg) || 0,
        freeAttacksLeft: guildBossCanFreeAttack(finalBoss, String(characterId)) ? 1 : 0,
        ranking: guildBossRanking(finalBoss).map((r) => ({ ...r, me: r.characterId === String(characterId) })),
      },
      defeatedRewards,
      character: { ...char, gold: extra ? (Number(char.gold) || 0) - GUILD_BOSS_EXTRA_ATTACK_COST : Number(char.gold) || 0 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("Guild boss error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
