import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { CLASS_BASE_STATS, powerCalc, xpForLevel, MAX_CHARACTERS_PER_ACCOUNT } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { isValidUsername } from "@/game/profanityFilter";
import { requireSession } from "@/game/auth";
import { addPetToCharacter } from "@/game/pets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sex, classType, avatarId } = body;
    if (!name || !classType) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // O dono da conta vem da SESSÃO autenticada (cookie httpOnly), nunca do
    // corpo da requisição — impede criar personagem na conta de outro usuário.
    const sess = requireSession(req);
    if (!sess.ok) return sess.response;
    const userId = sess.session.sub;
    
    // Validar nome do personagem
    const validation = isValidUsername(name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    
    // Verificar se nome já existe
    const existingName = await jsonDb.findCharacterByName(name.trim());
    if (existingName) {
      return NextResponse.json({ error: "Nome de personagem já está em uso" }, { status: 409 });
    }
    // Limite de personagens por conta (até 3 no total, incluindo o principal).
    const mine = await jsonDb.getCharactersByUserId(userId);
    if (mine.length >= MAX_CHARACTERS_PER_ACCOUNT) {
      return NextResponse.json(
        { error: `Limite de ${MAX_CHARACTERS_PER_ACCOUNT} personagens por conta` },
        { status: 409 }
      );
    }
    const stats = CLASS_BASE_STATS[classType as ClassName] ?? CLASS_BASE_STATS.warrior;
    const power = powerCalc({ ...stats, level: 1 });
    const char = await jsonDb.insertCharacter({
      userId,
      name: name.trim(),
      sex: sex || "male",
      classType: classType || "warrior",
      avatarId: avatarId || 1,
      hairColor: "#8B4513",
      eyeColor: "#2E86AB",
      // Base stats
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      critical: stats.critical,
      precision: 5,
      dodge: 5,
      resistance: 5,
      mana: stats.mana,
      maxMana: stats.mana,
      energy: 100,
      maxEnergy: 100,
      lastEnergyAt: new Date().toISOString(),
      power,
      // Progression
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      prestige: 0,
      unspentStatPoints: 0,
      talentPoints: 0,
      talents: {},
      // Currencies
      gold: 500,
      diamonds: 0,
      crystals: 0,
      pvpCoins: 0,
      guildCoins: 0,
      towerCoins: 0,
      // Region / PvP / Tower
      currentRegion: "starter_village",
      pvpLeague: "bronze",
      pvpRating: 0,
      towerFloor: 1,
      afkSince: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      // Pet inicial (Lobo Sombrio) — todo herói nasce com um companheiro.
      pets: addPetToCharacter({}, "lobo_sombrio"),
      activePetId: "lobo_sombrio",
    });

    // O personagem nasce sem itens iniciais: o kit de equipamento foi removido
    // e o futuro sistema de skins assumirá a visualização do personagem.
    const base = {
      attack: stats.attack,
      defense: stats.defense,
      maxHp: stats.hp,
      speed: stats.speed,
      critical: stats.critical,
    };

    await jsonDb.updateCharacter(char.id, {
      baseStats: base,
      attack: base.attack,
      defense: base.defense,
      maxHp: base.maxHp,
      hp: base.maxHp,
      speed: base.speed,
      critical: base.critical,
      power: powerCalc({
        attack: base.attack,
        defense: base.defense,
        hp: base.maxHp,
        speed: base.speed,
        critical: base.critical,
        level: 1,
      }),
    });

    // Itens removidos do jogo por enquanto — novos personagens não recebem
    // poções de boas-vindas.

    // Lista completa da conta (atualizada) para o cliente sincronizar.
    const allChars = (await jsonDb.getCharactersByUserId(userId)).sort((a: any, b: any) =>
      (a.createdAt || "").localeCompare(b.createdAt || "")
    );

    return NextResponse.json({
      character: char,
      characters: allChars.map((c: any) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        classType: c.classType,
        sex: c.sex,
        power: c.power,
        currentRegion: c.currentRegion,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
