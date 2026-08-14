import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { CLASS_BASE_STATS, powerCalc, xpForLevel } from "@/game/constants";
import type { ClassName } from "@/game/constants";
import { isValidUsername } from "@/game/profanityFilter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, sex, classType, avatarId } = body;
    if (!userId || !name || !classType) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    
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
    const existing = await jsonDb.findCharacterByUserId(userId);
    if (existing) {
      return NextResponse.json({ error: "Já possui personagem" }, { status: 409 });
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

    return NextResponse.json({ character: char });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
