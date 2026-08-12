import { REGIONS } from "@/game/constants";
import { t } from "@/i18n";

/**
 * Missões geradas automaticamente para as ilhas que ainda não possuem missões
 * manuais (ex.: Ruínas Antigas, Minas Profundas, Pântano Sombrio etc.).
 *
 * Por que persistidas: missões iniciadas são referenciadas pelo `missionId`
 * (template) nos endpoints de início/resgate. Para que a geração funcione sem
 * costurar lógica extra nesses endpoints, os templates gerados são inseridos em
 * `mission_templates` com IDs NEGATIVOS estáveis (hash da ilha + índice) — nunca
 * colidem com as missões manuais (IDs positivos) e são idempotentes (ON CONFLICT).
 *
 * Balanceamento: XP usa a curva de `missionXpReward()` (escala com o nível);
 * ouro, duração e custo de energia crescem conforme o `minLevel` da ilha.
 */

export interface LocalizedText {
  "pt-BR": string;
  en: string;
  es: string;
}

interface GenActivity {
  title: LocalizedText;
  icon: string;
}

const L = (pt: string, en: string, es: string): LocalizedText => ({
  "pt-BR": pt,
  en,
  es,
});

const THEME_STARTER_VILLAGE: GenActivity[] = [
  { title: L("Patrulhar a Vila", "Patrol the Village", "Patrullar la Aldea"), icon: "🏘️" },
  { title: L("Vender na Feira", "Sell at the Market", "Vender en el Mercado"), icon: "🪙" },
  { title: L("Reparar as Cercas", "Repair the Fences", "Reparar las Cercas"), icon: "🪵" },
  { title: L("Colher nos Campos", "Harvest the Fields", "Cosechar los Campos"), icon: "🌾" },
  { title: L("Regar as Plantações", "Water the Crops", "Regar los Cultivos"), icon: "💧" },
];

const THEME_FORGOTTEN_FOREST: GenActivity[] = [
  { title: L("Encontrar o Caminho Perdido", "Find the Lost Path", "Encontrar el Camino Perdido"), icon: "🧭" },
  { title: L("Alimentar os Veados", "Feed the Deer", "Alimentar a los Ciervos"), icon: "🦌" },
  { title: L("Limpar os Espinhos", "Clear the Thorns", "Limpiar las Espinas"), icon: "🌿" },
  { title: L("Capturar os Sapos", "Catch the Swamp Frogs", "Capturar las Ranas"), icon: "🐸" },
  { title: L("Seguir a Luz Misteriosa", "Follow the Mysterious Light", "Seguir la Luz Misteriosa"), icon: "✨" },
];

const THEME_ANCIENT_RUINS: GenActivity[] = [
  { title: L("Estudar as Ruínas", "Study the Ruins", "Estudiar las Ruinas"), icon: "🏛️" },
  { title: L("Limpar as Videiras", "Clear the Vines", "Limpiar las Enredaderas"), icon: "🌿" },
  { title: L("Procurar Relíquias", "Search for Relics", "Buscar Reliquias"), icon: "🏺" },
  { title: L("Desarmar as Armadilhas", "Disarm the Traps", "Desactivar Trampas"), icon: "⚠️" },
  { title: L("Decifrar as Tabuletas", "Decipher the Tablets", "Descifrar Tablillas"), icon: "📜" },
];
const THEME_DEEP_MINES: GenActivity[] = [
  { title: L("Minerar Cristais Raros", "Mine Rare Crystals", "Extraer Cristales Raros"), icon: "💎" },
  { title: L("Reforçar os Suportes", "Reinforce the Supports", "Reforzar los Soportes"), icon: "🪨" },
  { title: L("Limpar os Túneis", "Clear the Tunnels", "Limpiar los Túneles"), icon: "⛏️" },
  { title: L("Resgatar os Mineiros", "Rescue the Miners", "Rescatar a los Mineros"), icon: "⛑️" },
  { title: L("Extinguir os Incêndios", "Extinguish the Fires", "Apagar los Incendios"), icon: "🔥" },
];

const THEME_DARK_SWAMP: GenActivity[] = [
  { title: L("Purificar a Água", "Purify the Water", "Purificar el Agua"), icon: "💧" },
  { title: L("Caçar os Jacarés", "Hunt the Alligators", "Cazar a los Caimanes"), icon: "🐊" },
  { title: L("Coletar os Juncos", "Collect the Reeds", "Recoger los Juncos"), icon: "🌾" },
  { title: L("Seguir os Fogos-Fátuos", "Follow the Will-o'-the-Wisps", "Seguir los Fuegos Fatos"), icon: "💡" },
  { title: L("Libertar os Animais Presos", "Free the Trapped Animals", "Liberar a los Animales Atrapados"), icon: "🕸️" },
];

const THEME_FROZEN_MOUNTAINS: GenActivity[] = [
  { title: L("Limpar a Neve", "Clear the Snow", "Limpiar la Nieve"), icon: "❄️" },
  { title: L("Resgatar os Alpinistas", "Rescue the Climbers", "Rescatar a los Escaladores"), icon: "🧗" },
  { title: L("Acender os Sinalizadores", "Light the Beacons", "Encender las Balizas"), icon: "🔥" },
  { title: L("Coletar Gelo Puro", "Gather Pure Ice", "Recolectar Hielo Puro"), icon: "🧊" },
  { title: L("Rastrear o Mamute", "Track the Mammoth", "Rastrear al Mamut"), icon: "🦣" },
];

const THEME_SCORCHING_DESERT: GenActivity[] = [
  { title: L("Escavar o Oásis", "Dig Out the Oasis", "Excavar el Oasis"), icon: "🏜️" },
  { title: L("Resgatar os Viajantes", "Rescue the Travelers", "Rescatar a los Viajeros"), icon: "🐪" },
  { title: L("Caçar os Escorpiões", "Hunt the Scorpions", "Cazar Escorpiones"), icon: "🦂" },
  { title: L("Coletar Areia Rara", "Collect Rare Sand", "Recolectar Arena Rara"), icon: "✨" },
  { title: L("Consertar as Caravanas", "Fix the Caravans", "Reparar las Caravanas"), icon: "🐫" },
];
const THEME_IMPERIAL_CASTLE: GenActivity[] = [
  { title: L("Guardar as Muralhas", "Guard the Walls", "Guardar las Murallas"), icon: "🛡️" },
  { title: L("Polir as Armaduras", "Polish the Armor", "Pulir las Armaduras"), icon: "⚔️" },
  { title: L("Entregar as Mensagens", "Deliver the Messages", "Entregar los Mensajes"), icon: "📜" },
  { title: L("Treinar os Soldados", "Train the Soldiers", "Entrenar a los Soldados"), icon: "🗡️" },
  { title: L("Inspecionar as Torres", "Inspect the Towers", "Inspeccionar las Torres"), icon: "🏰" },
];

const THEME_LOST_ISLANDS: GenActivity[] = [
  { title: L("Traçar Novas Rotas", "Chart New Routes", "Trazar Nuevas Rutas"), icon: "🗺️" },
  { title: L("Resgatar os Marinheiros", "Rescue the Sailors", "Rescatar a los Marineros"), icon: "⚓" },
  { title: L("Coletar Pérolas", "Gather Pearls", "Recolectar Perlas"), icon: "🦪" },
  { title: L("Caçar os Caranguejos", "Hunt the Crabs", "Cazar Cangrejos"), icon: "🦀" },
  { title: L("Reparar os Barcos", "Repair the Boats", "Reparar los Barcos"), icon: "🛶" },
];

const THEME_DRAGON_WORLD: GenActivity[] = [
  { title: L("Coletar Escamas de Dragão", "Collect Dragon Scales", "Recolectar Escamas de Dragón"), icon: "🐉" },
  { title: L("Proteger os Ninhos", "Guard the Nests", "Proteger los Nidos"), icon: "🥚" },
  { title: L("Estudar o Voo dos Dragões", "Study the Dragons' Flight", "Estudiar el Vuelo de los Dragones"), icon: "🕊️" },
  { title: L("Acalmar os Dragões", "Calm the Dragons", "Calmar a los Dragones"), icon: "🐲" },
  { title: L("Limpar a Lava", "Clear the Lava", "Limpiar la Lava"), icon: "🌋" },
];

const THEME_DEMON_REALM: GenActivity[] = [
  { title: L("Purificar o Chão", "Purify the Ground", "Purificar el Suelo"), icon: "🔮" },
  { title: L("Quebrar as Maldições", "Break the Curses", "Romper las Maldiciones"), icon: "🧿" },
  { title: L("Banir as Almas Perdidas", "Banish the Lost Souls", "Desterrar las Almas Perdidas"), icon: "👻" },
  { title: L("Apagar os Rituais", "Stop the Rituals", "Detener los Rituales"), icon: "🕯️" },
  { title: L("Selar os Portais", "Seal the Portals", "Sellar los Portales"), icon: "🌀" },
];

const THEME_CELESTIAL_TEMPLE: GenActivity[] = [
  { title: L("Orar nos Altares", "Pray at the Altars", "Orar en los Altares"), icon: "⛪" },
  { title: L("Acender os Braseiros", "Light the Braziers", "Encender los Braseros"), icon: "🏮" },
{ title: L("Meditar em Paz", "Meditate in Peace", "Meditar en Paz"), icon: "🧘" },
  { title: L("Coletar Luz Celestial", "Collect Celestial Light", "Recolectar Luz Celestial"), icon: "✨" },
  { title: L("Proteger as Relíquias", "Guard the Relics", "Proteger las Reliquias"), icon: "🔱" },
];

export const REGION_THEMES: Record<string, GenActivity[]> = {
  starter_village: THEME_STARTER_VILLAGE,
  forgotten_forest: THEME_FORGOTTEN_FOREST,
  ancient_ruins: THEME_ANCIENT_RUINS,
  deep_mines: THEME_DEEP_MINES,
  dark_swamp: THEME_DARK_SWAMP,
  frozen_mountains: THEME_FROZEN_MOUNTAINS,
  scorching_desert: THEME_SCORCHING_DESERT,
  imperial_castle: THEME_IMPERIAL_CASTLE,
  lost_islands: THEME_LOST_ISLANDS,
  dragon_world: THEME_DRAGON_WORLD,
  demon_realm: THEME_DEMON_REALM,
  celestial_temple: THEME_CELESTIAL_TEMPLE,
};

/** Quantas missões geradas por ilha (garante grupo completo de 3 + desafio). */
export const GENERATED_PER_REGION = 5;

/** Hash FNV-1a 31-bit — base de um ID negativo estável por (ilha, índice). */
function fnv1a31(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

/** ID negativo estável para uma missão gerada (nunca colide com ids manuais positivos). */
export function generatedMissionId(region: string, index: number): number {
  return -(fnv1a31(`${region}:${index}`) || 1);
}

/** Monta o template de uma missão gerada com custos/recompensas escalando pelo nível da ilha. */
export function missionTemplateForRegion(
  regionId: string,
  index: number
): Record<string, unknown> | null {
  const region = REGIONS.find((r) => r.id === regionId);
  const theme = REGION_THEMES[regionId];
  if (!theme) return null;
  const act = theme[index % theme.length];
  if (!act) return null;
  const base = region?.minLevel ?? 1;
  const minLevel = base + (index >= 4 ? 2 : index >= 2 ? 1 : 0);
  return {
    id: generatedMissionId(regionId, index),
    nameKey: `mission.gen.${regionId}.${index}`,
    title: act.title,
    icon: act.icon,
    region: regionId,
    minLevel,
    // xpReward: 0 → missionXpReward() já escala o XP pela curva de nível da missão.
    xpReward: 0,
    goldReward: Math.round((10 + minLevel * 8) / 5) * 5,
    durationSec: Math.round(30 + minLevel * 4 + (index % 2) * 12),
    energyCost: Math.min(25, Math.round(3 + minLevel * 0.3)),
    difficulty: minLevel >= 50 ? 3 : minLevel >= 20 ? 2 : 1,
    generated: true,
  };
}

/**
 * Retorna os templates gerados que ainda faltam para as ilhas SEM NENHUMA
 * missão. Ilhas que já possuem missões manuais são preservadas — a geração não
 * repete conteúdo curado nem "suja" ilhas já prontas.
 */
export function missingRegionMissions(allMissions: any[]): Record<string, unknown>[] {
  const regionsWithMissions = new Set(
    allMissions.map((m: any) => m?.region).filter(Boolean) as string[]
  );
  const missing: Record<string, unknown>[] = [];
  for (const region of REGIONS) {
    if (regionsWithMissions.has(region.id)) continue;
    for (let i = 0; i < GENERATED_PER_REGION; i++) {
      const tpl = missionTemplateForRegion(region.id, i);
      if (tpl) missing.push(tpl);
    }
  }
  return missing;
}

/** Nome exibido da missão — usa o título localizado quando existir (missões geradas). */
export function missionTitle(m: any, locale: string): string {
  const title = m?.title;
  const localized =
    title && typeof title === "object"
      ? title[locale] ?? title["pt-BR"] ?? title.en
      : undefined;
  return localized || t(String(m?.nameKey || ""), locale);
}