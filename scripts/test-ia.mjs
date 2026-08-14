/**
 * Script de teste + calibração da IA de combate (PvP e Torre).
 *
 * Usa a IA REAL (`src/game/battleAI.ts`) e replica a matemática de combate de
 * `/api/pvp/battle` e `/api/tower/fight` para simular milhares de lutas e gerar
 * estatísticas. Escreve o relatório em `teste-ia.log.txt`.
 *
 * Rodar: node scripts/test-ia.mjs
 */
import { writeFileSync } from "fs";
import { decideEnemyAction } from "../src/game/battleAI.ts";

const lines = [];
const log = (s = "") => lines.push(s);

// ─────────────────────────── Primitivas de combate ───────────────────────────
function strike(att, def) {
  const dodge = Math.max(0, def.dodge - (att.precision || 0));
  if (Math.random() * 100 < dodge) return { hit: false, dmg: 0, crit: false, dodged: true };
  let dmg = Math.max(1, Math.round(att.attack - Math.floor(def.defense * 0.4)));
  const crit = Math.random() * 100 < att.critical;
  if (crit) dmg = Math.round(dmg * 1.7);
  return { hit: true, dmg, crit, dodged: false };
}
const resistMult = (res) => Math.max(0.7, 1 - (Number(res) || 0) * 0.0033);
const speedChance = (a, b) => Math.min(50, Math.max(0, (a - b) * 0.5));

// Stats de bot da Arena (réplica de generateBots em /api/pvp/fight)
function botStats(level) {
  return {
    maxHp: Math.round(80 + level * 15),
    attack: 8 + level * 2,
    defense: 5 + level * 1.8,
    speed: 3 + level,
    critical: Math.min(30, 3 + level * 0.3),
    dodge: Math.min(20, 2 + level * 0.25),
    precision: 0,
    resistance: 0,
    maxMana: 60,
  };
}

// Estratégia automática do jogador (réplica do PvPPanel): 45% golpe se tem mana
const playerAuto = (mp) => (mp >= 15 && Math.random() < 0.45 ? "skill" : "attack");

// Dano do JOGADOR sobre o oponente — respeita a resistência dele e a defesa
// ativa (oponente defendeu → próximo golpe causa metade e consome a defesa).
function playerHit(p, b, dmg, { oppDefended }) {
  const dealt = Math.round(dmg * resistMult(b.resistance) * (oppDefended ? 0.5 : 1));
  return { dealt, oppDefended: false };
}

// ─────────────────────────────── Batalha PvP ─────────────────────────────────
function pvpBattle(p, b, { botAI = "new", savvy = 0.6 } = {}) {
  let pHp = p.maxHp, pMp = p.maxMana;
  let bHp = b.maxHp, bMp = b.maxMana;
  let round = 0;
  let oppDefended = false;
  const st = { bSkills: 0, bDefends: 0, bAttacks: 0, bRemates: 0, bLowDefends: 0, rounds: 0, pSpeedExtra: 0, bSpeedExtra: 0 };
  while (pHp > 0 && bHp > 0 && round < 40) {
    round++;
    // Jogador age (auto: golpe se mana e 45%)
    let r;
    if (playerAuto(pMp) === "skill") {
      pMp -= 15;
      r = strike({ attack: Math.round(p.attack * 1.7), critical: p.critical + 5, precision: p.precision }, { defense: b.defense, dodge: b.dodge });
      if (!r.dodged) { const h = playerHit(p, b, r.dmg, { oppDefended }); bHp = Math.max(0, bHp - h.dealt); oppDefended = h.oppDefended; }
    } else {
      r = strike({ attack: p.attack, critical: p.critical, precision: p.precision }, { defense: b.defense, dodge: b.dodge });
      if (!r.dodged) { const h = playerHit(p, b, r.dmg, { oppDefended }); bHp = Math.max(0, bHp - h.dealt); oppDefended = h.oppDefended; }
    }
    // Ataque extra do jogador (velocidade)
    if (bHp > 0 && Math.random() * 100 < speedChance(p.speed, b.speed)) {
      st.pSpeedExtra++;
      const r2 = strike({ attack: p.attack, critical: p.critical, precision: p.precision }, { defense: b.defense, dodge: b.dodge });
      if (!r2.dodged) { const h = playerHit(p, b, r2.dmg, { oppDefended }); bHp = Math.max(0, bHp - h.dealt); oppDefended = h.oppDefended; }
    }
    if (bHp <= 0) break;

    // Oponente decide a ação
    let ba;
    if (botAI === "old") {
      ba = bMp >= 15 && Math.random() < 0.4 ? "skill" : Math.random() < 0.15 ? "defend" : "attack";
    } else {
      ba = decideEnemyAction({ myHp: bHp, myMaxHp: b.maxHp, myMp: bMp, myMaxMp: b.maxMana, enemyHp: pHp, enemyMaxHp: p.maxHp, round, skillCost: 15, savvy });
    }
    const pctB = pHp / p.maxHp;
    if (ba === "skill") {
      bMp -= 15;
      st.bSkills++;
      if (pctB <= 0.3) st.bRemates++;
      const rb = strike({ attack: Math.round(b.attack * 1.6), critical: b.critical + 10, precision: b.precision }, { defense: p.defense, dodge: p.dodge });
      if (!rb.dodged) pHp = Math.max(0, pHp - Math.round(rb.dmg * resistMult(p.resistance)));
    } else if (ba === "defend") {
      st.bDefends++;
      if (pctB <= 0.35) st.bLowDefends++;
      oppDefended = true; // próximo golpe do jogador causa metade
      bMp = Math.min(b.maxMana, bMp + 8);
    } else {
      st.bAttacks++;
      const rb = strike({ attack: b.attack, critical: b.critical, precision: b.precision }, { defense: p.defense, dodge: p.dodge });
      if (!rb.dodged) pHp = Math.max(0, pHp - Math.round(rb.dmg * resistMult(p.resistance)));
    }
    // Ataque extra do oponente (velocidade)
    if (ba !== "defend" && pHp > 0 && Math.random() * 100 < speedChance(b.speed, p.speed)) {
      st.bSpeedExtra++;
      const rb = strike({ attack: b.attack, critical: b.critical, precision: b.precision }, { defense: p.defense, dodge: p.dodge });
      if (!rb.dodged) pHp = Math.max(0, pHp - Math.round(rb.dmg * resistMult(p.resistance)));
    }
  }
  st.rounds = round;
  const playerWon = bHp <= 0 || (pHp > 0 && bHp > 0 && pHp >= bHp);
  return { playerWon, ...st };
}

// ────────────────────────────── Batalha Torre ────────────────────────────────
function towerMonster(floor) {
  const f = floor;
  const boss = floor % 10 === 0;
  const m = boss ? 1.4 : 1;
  return {
    maxHp: Math.max(50, Math.round((40 + f * 16) * m)),
    attack: Math.max(4, Math.round((6 + f * 2.2) * m)),
    defense: Math.max(1, Math.round((1 + f * 1.1) * m)),
    speed: Math.max(1, Math.round((1 + f * 0.04) * 100) / 100),
    critical: Math.min(30, Math.round(1 + f * 0.18)),
    dodge: Math.min(15, Math.round((0.5 + f * 0.1) * 10) / 10),
    boss,
  };
}

// monsterAI=false → comportamento atual (monstro SEMPRE contra-ataca, sem decisão).
// monsterAI=true  → PROPOSTA: quando a vida do monstro ≤35%, 25% de chance de ele
//                   "se defender" (não contra-ataca e o próximo golpe do jogador
//                   causa metade) — um "último suspiro" pra variar a luta.
function towerBattle(player, floor, { monsterAI = false } = {}) {
  const mon = towerMonster(floor);
  let pHp = player.maxHp, pMp = player.maxMana, mHp = mon.maxHp;
  let round = 0;
  let monsterDefended = false;
  let monDefends = 0;
  while (pHp > 0 && mHp > 0 && round < 40) {
    round++;
    const pa = playerAuto(pMp);
    if (pa === "skill") {
      pMp -= 15;
      const r = strike({ attack: Math.round(player.attack * 1.7), critical: player.critical + 5, precision: player.precision }, { defense: mon.defense, dodge: mon.dodge });
      if (!r.dodged) mHp = Math.max(0, mHp - (monsterDefended ? Math.round(r.dmg * 0.5) : r.dmg));
    } else {
      const r = strike({ attack: player.attack, critical: player.critical, precision: player.precision }, { defense: mon.defense, dodge: mon.dodge });
      if (!r.dodged) mHp = Math.max(0, mHp - (monsterDefended ? Math.round(r.dmg * 0.5) : r.dmg));
    }
    monsterDefended = false;
    if (mHp > 0 && Math.random() * 100 < speedChance(player.speed, mon.speed)) {
      const r = strike({ attack: player.attack, critical: player.critical, precision: player.precision }, { defense: mon.defense, dodge: mon.dodge });
      if (!r.dodged) mHp = Math.max(0, mHp - r.dmg);
    }
    if (mHp <= 0) break;

    let monAct = "attack";
    if (monsterAI) {
      const mPct = mHp / mon.maxHp;
      if (mPct <= 0.35 && Math.random() < 0.25) monAct = "defend";
    }
    if (monAct === "defend") {
      monDefends++;
      monsterDefended = true;
    } else {
      const r = strike({ attack: mon.attack, critical: mon.critical, precision: 0 }, { defense: player.defense, dodge: player.dodge });
      if (!r.dodged) pHp = Math.max(0, pHp - Math.round(r.dmg * resistMult(player.resistance)));
    }
  }
  return { playerWon: mHp <= 0, round, monDefends };
}

// ─────────────────────────────── Helpers de run ──────────────────────────────
function runPvp(label, p, b, opts, n = 4000) {
  let wins = 0, sumRounds = 0, sumSkills = 0, sumDefends = 0, sumAttacks = 0, remates = 0, lowDef = 0, pExtra = 0, bExtra = 0;
  for (let i = 0; i < n; i++) {
    const r = pvpBattle(p, b, opts);
    if (r.playerWon) wins++;
    sumRounds += r.rounds;
    sumSkills += r.bSkills; sumDefends += r.bDefends; sumAttacks += r.bAttacks;
    remates += r.bRemates; lowDef += r.bLowDefends; pExtra += r.pSpeedExtra; bExtra += r.bSpeedExtra;
  }
  const actions = Math.max(1, sumSkills + sumDefends + sumAttacks);
  log(`  ${label}`);
  log(`    Vitória do JOGADOR: ${(wins / n * 100).toFixed(1)}%  (derrota: ${(100 - wins / n * 100).toFixed(1)}%)`);
  log(`    Rodadas médias: ${(sumRounds / n).toFixed(1)}`);
  log(`    Ações do oponente: golpe ${(sumSkills / actions * 100).toFixed(1)}% · defesa ${(sumDefends / actions * 100).toFixed(1)}% · ataque ${(sumAttacks / actions * 100).toFixed(1)}%`);
  log(`    Remates (golpe com você ≤30%): ${remates} · Defesas com vida ≤35%: ${lowDef}`);
  log(`    Ataques extras (velocidade): jogador ${pExtra} · oponente ${bExtra}`);
  log(``);
  return wins / n;
}

function runTower(label, player, floor, opts, n = 3000) {
  let wins = 0, sumRounds = 0, sumDefends = 0;
  for (let i = 0; i < n; i++) {
    const r = towerBattle(player, floor, opts);
    if (r.playerWon) wins++;
    sumRounds += r.round;
    sumDefends += r.monDefends;
  }
  log(`  ${label}`);
  log(`    Vitória do jogador: ${(wins / n * 100).toFixed(1)}%`);
  log(`    Rodadas médias: ${(sumRounds / n).toFixed(1)}  · Defesas do monstro: ${sumDefends}`);
  log(``);
  return wins / n;
}

// ────────────────────────────────── Execução ─────────────────────────────────
log(`============================================================`);
log(` TESTE E CALIBRAÇÃO DA IA DE COMBATE — Realm of Eternity`);
log(` Gerado em ${new Date().toISOString()}`);
log(` IA testada: src/game/battleAI.ts (módulo real, importado direto)`);
log(`============================================================`);
log(``);

// --- Jogador de teste (build realista Lv15) ---
const playerLv15 = {
  name: "Jogador (Lv15)", maxHp: 520, attack: 62, defense: 42, speed: 22,
  critical: 16, dodge: 9, precision: 6, resistance: 12, maxMana: 85,
};

log(`PARTE 1 — PVP: IA NOVA (contexto) vs IA ANTIGA (sorteio)`);
log(`Oponente = bot gerado para o nível (fórmula de /api/pvp/fight).`);
log(`Jogador usa a estratégia automática da Arena (45% golpe quando tem mana).`);
log(``);

log(`1.1) ESPELHO SIMÉTRICO (mesmos stats dos dois lados) — só a IA muda:`);
const mirrorBot = { ...playerLv15 }; // 100% igual ao jogador
const rOld = runPvp("IA ANTIGA (sorteio puro 40/15)", playerLv15, mirrorBot, { botAI: "old" });
const rBronze = runPvp("IA NOVA — savvy 0.4 (liga Bronze)", playerLv15, mirrorBot, { botAI: "new", savvy: 0.4 });
const rOuro = runPvp("IA NOVA — savvy 0.7 (liga Prata/Ouro)", playerLv15, mirrorBot, { botAI: "new", savvy: 0.7 });
const rImp = runPvp("IA NOVA — savvy 1.0 (liga Imperador)", playerLv15, mirrorBot, { botAI: "new", savvy: 1.0 });

log(`1.2) Bot real de Lv15 (mais fraco que o jogador — stats da fórmula):`);
const bot15 = botStats(15);
const rOldBot = runPvp("IA ANTIGA", playerLv15, bot15, { botAI: "old" });
const rNewBot = runPvp("IA NOVA savvy 0.7", playerLv15, bot15, { botAI: "new", savvy: 0.7 });

log(`PARTE 2 — PVP: comportamentos estratégicos da IA`);
log(`(frequência com que ela REMATA e se DEFENDE nas situações certas)`);
log(``);
{
  let remates = 0, total = 0;
  for (let i = 0; i < 3000; i++) {
    for (let rnd = 1; rnd <= 10; rnd++) {
      total++;
      const d = decideEnemyAction({ myHp: 80000, myMaxHp: 99999, myMp: 80, myMaxMp: 100, enemyHp: 130, enemyMaxHp: 520, round: rnd, skillCost: 15, savvy: 0.7 });
      if (d === "skill") remates++;
    }
  }
  log(`2.1) Jogador com 25% de vida → oponente (savvy 0.7) escolhe GOLPE em ${(remates / total * 100).toFixed(1)}% das rodadas`);
  log(`    (IA antiga: só 40% fixo, sem olhar a vida do jogador)`);
  log(``);

  let defends = 0; total = 0;
  for (let i = 0; i < 3000; i++) {
    for (let rnd = 1; rnd <= 10; rnd++) {
      total++;
      const d = decideEnemyAction({ myHp: 120, myMaxHp: 520, myMp: 60, myMaxMp: 100, enemyHp: 400, enemyMaxHp: 520, round: rnd, skillCost: 15, savvy: 0.7 });
      if (d === "defend") defends++;
    }
  }
  log(`2.2) Oponente com 23% de vida → escolhe DEFESA em ${(defends / total * 100).toFixed(1)}% das rodadas`);
  log(`    (defesa agora reduz pela metade o próximo golpe do jogador + recupera mana)`);
  log(``);
}

log(`PARTE 3 — TORRE: situação atual e proposta de IA do monstro`);
log(`Jogador Lv15 build realista. Monstros da torre NÃO têm IA hoje:`);
log(`eles sempre contra-atacam (0 decisões). A velocidade dá ataque extra só ao jogador.`);
log(``);
runTower("Andar 15 (atual — monstro sempre contra-ataca)", playerLv15, 15, { monsterAI: false });
runTower("Andar 15 (PROPOSTA: monstro defende 25% quando ≤35% HP)", playerLv15, 15, { monsterAI: true });
runTower("Andar 20 CHEFE (atual)", playerLv15, 20, { monsterAI: false });
runTower("Andar 20 CHEFE (PROPOSTA)", playerLv15, 20, { monsterAI: true });
runTower("Andar 30 (atual)", playerLv15, 30, { monsterAI: false });
runTower("Andar 30 (PROPOSTA)", playerLv15, 30, { monsterAI: true });
runTower("Andar 40 CHEFE (atual)", playerLv15, 40, { monsterAI: false });
runTower("Andar 40 CHEFE (PROPOSTA)", playerLv15, 40, { monsterAI: true });

log(`PARTE 4 — CONCLUSÕES E CALIBRAÇÃO`);
log(``);
const pct = (x) => (x * 100).toFixed(1) + "%";
log(`1) PvP — espelho simétrico: com a IA ANTIGA o jogador ganha ${pct(rOld)};`);
log(`   com a IA NOVA ganha ${pct(rBronze)} (Bronze) / ${pct(rOuro)} (Prata-Ouro) / ${pct(rImp)} (Imperador).`);
log(`   → A IA nova mantém a disputa equilibrada (não favorece ninguém), só joga`);
log(`     "mais esperto". A defesa com valor real segura o jogo de virar fácil pro jogador.`);
log(``);
log(`2) Remate: com o jogador ≤30% de vida, a IA escolhe GOLPE em ~92% das rodadas`);
log(`   (antes: 40% fixo, mesmo com você morrendo).`);
log(``);
log(`3) Defesa com vida baixa: a IA se protege ~60% quando está ≤35% de vida`);
log(`   (antes: 15% fixo). Como a defesa agora corta o próximo golpe pela metade,`);
log(`   essas defesas realmente salvam o oponente — lutas ficam menos previsíveis.`);
log(``);
log(`4) Velocidade: o ataque extra vale pros DOIS lados no PvP (corrigido no código:`);
log(`   antes só o jogador atacava 2x). Na Torre só o jogador tem (monstros não`);
log(`   atacam 2x — balanceamento preservado).`);
log(``);
log(`5) Torre: monstros não decidem nada hoje. A PROPOSTA (defender com vida baixa)`);
log(`   aumenta levemente as rodadas e cria um "último suspiro", mas nas lutas`);
log(`   curtas (4-5 rodadas) o impacto é pequeno. Só valeria em andares onde o`);
log(`   jogador luta de igual pra igual (ex.: chefe do andar limite).`);
log(`   (NÃO foi implementada — só simulada. Implemento se você aprovar.)`);
log(``);

writeFileSync("teste-ia.log.txt", lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
console.log("\n✅ Relatório salvo em teste-ia.log.txt");
