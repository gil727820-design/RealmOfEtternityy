import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { leagueForRating, CLASS_LIST } from "@/game/constants";

function simulateBattle(attacker: any, defender: { hp: number; attack: number; defense: number; speed: number; critical: number; dodge: number; name: string }) {
  let aHp = attacker.maxHp;
  let dHp = defender.hp;
  const log: string[] = [];
  let round = 0;
  const halfRounds: string[] = [];

  while (aHp > 0 && dHp > 0 && round < 40) {
    round++;
    // Attacker first if faster
    const goesFirst = attacker.speed >= defender.speed;
    
    if (goesFirst) {
      const aCrit = Math.random() * 100 < attacker.critical;
      const dDodge = Math.random() * 100 < defender.dodge;
      if (!dDodge) {
        let dmg = Math.max(1, attacker.attack - Math.floor(defender.defense * 0.45));
        if (aCrit) dmg = Math.floor(dmg * 1.6);
        dHp -= dmg;
        halfRounds.push(`⚔️ ${attacker.name} → ${defender.name} -${dmg}${aCrit ? " 💥CRIT!" : ""}`);
      } else { halfRounds.push(`${attacker.name} → ❌ ESQUIVA`); }
      if (dHp <= 0) break;
      
      const dCrit = Math.random() * 100 < defender.critical;
      const aDodge = Math.random() * 100 < attacker.dodge;
      if (!aDodge) {
        let dmg = Math.max(1, defender.attack - Math.floor(attacker.defense * 0.45));
        if (dCrit) dmg = Math.floor(dmg * 1.6);
        aHp -= dmg;
        halfRounds.push(`🛡️ ${defender.name} → ${attacker.name} -${dmg}${dCrit ? " 💥CRIT!" : ""}`);
      } else { halfRounds.push(`${defender.name} → ❌ ESQUIVA`); }
    } else {
      const dCrit = Math.random() * 100 < defender.critical;
      const aDodge = Math.random() * 100 < attacker.dodge;
      if (!aDodge) {
        let dmg = Math.max(1, defender.attack - Math.floor(attacker.defense * 0.45));
        if (dCrit) dmg = Math.floor(dmg * 1.6);
        aHp -= dmg;
        halfRounds.push(`🛡️ ${defender.name} → ${attacker.name} -${dmg}${dCrit ? " 💥CRIT!" : ""}`);
      } else { halfRounds.push(`${defender.name} → ❌ ESQUIVA`); }
      if (aHp <= 0) break;
      
      const aCrit = Math.random() * 100 < attacker.critical;
      const dDodge = Math.random() * 100 < defender.dodge;
      if (!dDodge) {
        let dmg = Math.max(1, attacker.attack - Math.floor(defender.defense * 0.45));
        if (aCrit) dmg = Math.floor(dmg * 1.6);
        dHp -= dmg;
        halfRounds.push(`⚔️ ${attacker.name} → ${defender.name} -${dmg}${aCrit ? " 💥CRIT!" : ""}`);
      } else { halfRounds.push(`${attacker.name} → ❌ ESQUIVA`); }
    }
  }

  log.push(...halfRounds);
  const attackerWon = dHp <= 0 || (aHp > 0 && dHp > 0 && aHp >= dHp);
  return { attackerWon, log, aHp, dHp };
}

// Generate bot opponents
function generateBots(charLevel: number, charPower: number, baseRating: number): Array<Record<string, unknown>> {
  const botNames = [
    "Zerath, o Imortal", "Morgana Sombria", "Thorgrim Martelo", "Kael'thas Flamejante",
    "Seraphina Luz", "Drakon Voraz", "Lunara Noturna", "Vex, o Cruel",
    "Ragnarok Escarlate", "Nyx Tempestade", "Aetherion Celestial", "Fenrir Sombrio",
    "Valquiria Alada", "Mephisto Astuto", "Sylvanas Ventania", "Kronos Titã",
  ];
  
  return botNames.map((name, i) => {
    const rating = Math.max(0, baseRating - 200 + Math.floor(Math.random() * 400));
    const level = Math.max(1, charLevel + (Math.floor(Math.random() * 5) - 2));
    const power = Math.max(10, Math.round(charPower * (0.75 + Math.random() * 0.5)));
    const cls = CLASS_LIST[Math.floor(Math.random() * CLASS_LIST.length)];
    
    return {
      id: `bot_${i}`,
      name,
      level,
      power,
      pvpRating: rating,
      pvpLeague: leagueForRating(rating),
      classType: cls,
      sex: Math.random() < 0.5 ? "male" : "female",
      isBot: true,
      hp: 80 + level * 15,
      attack: 8 + level * 2,
      defense: 5 + level * 1.8,
      speed: 3 + level,
      critical: Math.min(30, 3 + level * 0.3),
      dodge: Math.min(20, 2 + level * 0.25),
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { attackerId, defenderId, isBot } = await req.json();
    const attacker = await jsonDb.findCharacterById(attackerId);
    if (!attacker) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

    let defenderStats: { hp: number; attack: number; defense: number; speed: number; critical: number; dodge: number; name: string };
    let defenderRating: number;
    let realDefenderId = defenderId;

    if (isBot) {
      // Parse bot from the generated list or create one
      const bots = generateBots(Number(attacker.level) || 1, Number(attacker.power) || 0, attacker.pvpRating);
      const botMatch = bots.find(b => b.id === defenderId) || bots[0];
      defenderStats = {
        hp: botMatch.hp as number,
        attack: botMatch.attack as number,
        defense: botMatch.defense as number,
        speed: botMatch.speed as number,
        critical: botMatch.critical as number,
        dodge: botMatch.dodge as number,
        name: botMatch.name as string,
      };
      defenderRating = botMatch.pvpRating as number;
    } else {
      const defender = await jsonDb.findCharacterById(defenderId);
      if (!defender) return NextResponse.json({ error: "Oponente não encontrado" }, { status: 404 });
      defenderStats = {
        hp: defender.maxHp, attack: defender.attack, defense: defender.defense,
        speed: defender.speed, critical: defender.critical, dodge: defender.dodge,
        name: defender.name,
      };
      defenderRating = defender.pvpRating;
    }

    const { attackerWon, log } = simulateBattle(attacker, defenderStats);
    const ratingChange = attackerWon ? 5 : -3;
    const newAtkRating = Math.max(0, attacker.pvpRating + ratingChange);

    await jsonDb.updateCharacter(attackerId, {
      pvpRating: newAtkRating,
      pvpLeague: leagueForRating(newAtkRating),
      pvpCoins: (attacker.pvpCoins || 0) + (attackerWon ? 10 : 2),
    });

    if (!isBot && realDefenderId) {
      const newDefRating = Math.max(0, defenderRating - ratingChange);
      await jsonDb.updateCharacter(realDefenderId, {
        pvpRating: newDefRating,
        pvpLeague: leagueForRating(newDefRating),
      });
    }

    return NextResponse.json({ won: attackerWon, ratingChange, log });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Matchmaking por nível e poder: oponentes na mesma faixa do jogador
    const allChars = await jsonDb.listCharacters("", 100);
    const myLevel = Number(char.level) || 1;
    const myPower = Number(char.power) || 0;

    const realPlayers = allChars
      .filter((c: any) => c.id !== characterId)
      .map((c: any) => ({
        ...c,
        _lvlDiff: Math.abs((Number(c.level) || 1) - myLevel),
        _pwrDiff: Math.abs((Number(c.power) || 0) - myPower),
      }))
      .filter((c: any) => c._lvlDiff <= 3)
      .filter((c: any) => c._pwrDiff <= Math.max(150, myPower * 0.35))
      .sort((a: any, b: any) => a._pwrDiff - b._pwrDiff || a._lvlDiff - b._lvlDiff)
      .slice(0, 5)
      .map(({ _lvlDiff, _pwrDiff, ...rest }: any) => ({ ...rest, isBot: false }));

    // Bots gerados na mesma faixa de nível/poder para completar a lista
    const bots = generateBots(myLevel, myPower, char.pvpRating || 0);
    const needed = Math.max(0, 8 - realPlayers.length);
    const combined = [...realPlayers, ...bots.slice(0, needed)];

    return NextResponse.json({ opponents: combined });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}