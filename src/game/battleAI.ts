/**
 * IA leve de combate dos oponentes da Arena (PvP).
 *
 * ANTES: o oponente decidia no "sorteio" puro (40% golpe, 15% defesa, resto
 * ataque) — batalha repetitiva e sem reação ao que você faz.
 *
 * AGORA: ele decide olhando o contexto — a vida dos dois, a mana dele, a rodada
 * — com uma "esperteza" (savvy) que cresce conforme o rating do oponente.
 * Oponentes de liga alta jogam melhor que os de liga baixa (rematam, se
 * defendem quando estão fracos e usam o golpe na hora certa).
 *
 * As probabilidades ainda têm aleatoriedade (não vira previsível 100%), mas a
 * tendência agora é estratégica.
 */

export type BattleAIDecision = "attack" | "skill" | "defend";

export interface BattleAIInput {
  /** Vida atual do oponente (quem decide). */
  myHp: number;
  myMaxHp: number;
  /** Mana atual/máxima do oponente. */
  myMp: number;
  myMaxMp: number;
  /** Vida atual/máxima do jogador (o alvo). */
  enemyHp: number;
  enemyMaxHp: number;
  /** Rodada atual da batalha. */
  round: number;
  /** Custo de mana do golpe especial. */
  skillCost: number;
  /** 0..1 — o quanto o oponente "joga bem" (cresce com o rating da liga). */
  savvy: number;
}

export function decideEnemyAction(input: BattleAIInput): BattleAIDecision {
  const {
    myHp,
    myMaxHp,
    myMp,
    myMaxMp,
    enemyHp,
    enemyMaxHp,
    round,
    skillCost,
    savvy = 0.5,
  } = input;

  const hpPct = myHp / Math.max(1, myMaxHp);
  const enemyPct = enemyHp / Math.max(1, enemyMaxHp);
  const mpPct = myMp / Math.max(1, myMaxMp);
  const hasMana = myMp >= skillCost;

  // 1) REMATE: jogador com vida baixa → golpe especial para não deixar escapar.
  //    Oponentes espertos quase nunca perdem a chance de matar.
  if (hasMana && enemyPct <= 0.3 && Math.random() < 0.6 + savvy * 0.35) return "skill";

  // 2) DEFESA: própria vida baixa → se esconde (reduz o dano e regenera mana).
  //    Oponentes fracos continuam atacando mesmo à beira da morte.
  if (hpPct <= 0.35 && myMp < myMaxMp && Math.random() < 0.3 + savvy * 0.4) return "defend";

  // 3) GOLPE CEDO: mana cheia/alta → solta o golpe enquanto o jogador está inteiro.
  if (hasMana && mpPct >= 0.6 && Math.random() < 0.3 + savvy * 0.3) return "skill";

  // 4) FIM DE BATALHA: rodadas altas → aposta tudo no golpe especial.
  if (hasMana && round >= 25 && Math.random() < 0.4 + savvy * 0.35) return "skill";

  // 5) VARIAÇÃO: defende de vez em quando para recuperar mana (não fica 100%
  //    previsível, mas é raro).
  if (myMp < myMaxMp && Math.random() < 0.05 + savvy * 0.1) return "defend";

  return "attack";
}
