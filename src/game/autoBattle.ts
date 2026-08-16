/**
 * Auto Battle — modos de combate automático.
 *
 * O jogador escolhe um modo (Agressivo/Equilibrado/Defensivo), se quer usar o
 * golpe especial automaticamente e se quer beber poção de HP abaixo de um
 * percentual de vida. A DECISÃO acontece no servidor (nunca confiamos no
 * cliente): a UI só envia as preferências, e a rota da API decide a ação
 * usando estas funções — mesma filosofia das demais regras em src/game/.
 */

export type AutoBattleMode = "aggressive" | "balanced" | "defensive";

export interface AutoBattleSettings {
  mode: AutoBattleMode;
  /** Usar o golpe especial automaticamente quando tiver mana. */
  useSkill: boolean;
  /** Beber poção de HP automaticamente abaixo de `potionPct`% de vida. */
  potionEnabled: boolean;
  potionPct: number;
}

export const DEFAULT_AUTO_BATTLE: AutoBattleSettings = {
  mode: "balanced",
  useSkill: true,
  potionEnabled: false,
  potionPct: 30,
};

/** Valida o que vier do cliente (nunca confia cegamente nos valores). */
export function sanitizeAutoBattleSettings(raw: unknown): AutoBattleSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode: AutoBattleMode =
    r.mode === "aggressive" || r.mode === "defensive" ? r.mode : "balanced";
  const useSkill = r.useSkill !== false;
  const potionEnabled = r.potionEnabled === true;
  // Limite entre 10% e 90% de vida (protege contra valores absurdos do cliente).
  const potionPct = Math.min(90, Math.max(10, Math.floor(Number(r.potionPct) || 30)));
  return { mode, useSkill, potionEnabled, potionPct };
}

/** Deve beber poção agora? (vida atual <= limite configurado). */
export function shouldUsePotion(
  hp: number,
  maxHp: number,
  settings: AutoBattleSettings
): boolean {
  if (!settings.potionEnabled) return false;
  if (maxHp <= 0) return false;
  const pct = (hp / maxHp) * 100;
  return pct <= settings.potionPct;
}

export interface AutoActionInput {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  enemyHp: number;
  enemyMaxHp: number;
  skillCost: number;
  round: number;
}

/**
 * Decide a ação da rodada pelo modo escolhido:
 * - aggressive: aposta no dano — golpe sempre que tiver mana, quase nunca defende;
 * - balanced:   meio termo — golpe com certa frequência, defende com HP baixo;
 * - defensive:  prioriza sobreviver — defende com HP médio/baixo, golpe só pra rematar.
 * O `useSkill` desligado nunca usa o golpe (economiza mana pra defesa manual).
 */
export function decideAutoAction(
  input: AutoActionInput,
  settings: AutoBattleSettings
): "attack" | "skill" | "defend" {
  const { hp, maxHp, mp, enemyHp, enemyMaxHp, skillCost } = input;
  const hpPct = hp / Math.max(1, maxHp);
  const enemyPct = enemyHp / Math.max(1, enemyMaxHp);
  const hasMana = settings.useSkill && mp >= skillCost;

  switch (settings.mode) {
    case "aggressive": {
      if (hasMana && Math.random() < 0.85) return "skill";
      if (hpPct < 0.15 && Math.random() < 0.3) return "defend";
      return "attack";
    }
    case "defensive": {
      if (hpPct < 0.5 && Math.random() < 0.75) return "defend";
      if (hasMana && enemyPct < 0.25 && Math.random() < 0.7) return "skill";
      return "attack";
    }
    case "balanced":
    default: {
      if (hasMana && Math.random() < 0.45) return "skill";
      if (hpPct < 0.3 && Math.random() < 0.4) return "defend";
      return "attack";
    }
  }
}
