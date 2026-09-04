import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";

/*
 * JSON Store — persistência 100% local em arquivos data/*.json (um por coleção).
 *
 * Substitui o SQLite (better-sqlite3 + drizzle). Cada "coleção" antiga virou um
 * arquivo JSON contendo um array de documentos INTEIROS (o documento é o registro,
 * com todos os campos dinâmicos — talents, skins, achievements, missionBatch,
 * afkSince etc. — preservados tal como o antigo jsonDb).
 *
 * Características:
 *  - Carrega tudo em memória uma única vez (singleton no globalThis).
 *  - Toda mutação é síncrona (single-thread Node → sem corrida entre requisições
 *    dentro de um mesmo bloco) e persiste via escrita atômica (temp + rename).
 *  - Nenhum lock de banco, nenhum WAL, nenhum arquivo efêmero no git.
 */

export const COLLECTIONS = [
  "users",
  "characters",
  "itemTemplates",
  "inventoryItems",
  "missionTemplates",
  "activeMissions",
  "afkRewards",
  "battles",
  "guilds",
  "guildInvites",
  "guildChats",
  "mailbox",
  "excludedUsers",
  "regionAudio",
  "serverSettings",
  "codes",
  "marketplace",
  "adminLogs",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

const DATA_DIR =
  process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(process.cwd(), "data");

const TMP_SUFFIX = ".tmp";

const globalForStore = globalThis as typeof globalThis & {
  __jsonStoreData?: Record<string, any[]>;
};

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/** Carrega todas as coleções do disco (uma vez por processo). */
function loadAll(): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const name of COLLECTIONS) {
    out[name] = loadCollection(name);
  }
  globalForStore.__jsonStoreData = out;
  return out;
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

function loadCollection(name: string): any[] {
  const file = filePath(name);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? (parsed as any[]) : [];
  } catch {
    // Arquivo corrompido/parcial → começa vazio (e o próximo write reconstrói).
    return [];
  }
}

/** Escrita atômica: grava num arquivo temporário e renomeia por cima. */
function persistCollection(name: string): void {
  const file = filePath(name);
  const tmp = file + TMP_SUFFIX;
  writeFileSync(tmp, JSON.stringify(data[name] ?? [], null, 2), "utf8");
  renameSync(tmp, file);
}

const data: Record<string, any[]> =
  globalForStore.__jsonStoreData ?? loadAll();

/* ─── Leitura (retorna referências vivas da memória) ─── */

export function allOf(name: CollectionName): any[] {
  return data[name] ?? [];
}

export function findIn(name: CollectionName, predicate: (rec: any) => boolean): any | undefined {
  return allOf(name).find(predicate);
}

export function filterIn(name: CollectionName, predicate: (rec: any) => boolean): any[] {
  return allOf(name).filter(predicate);
}

/* ─── Escrita (mutação síncrona + persistência atômica) ─── */

export function insertRecord(name: CollectionName, rec: any): any {
  const col = data[name] ?? (data[name] = []);
  col.push(rec);
  persistCollection(name);
  return rec;
}

export function updateRecord(
  name: CollectionName,
  match: (rec: any) => boolean,
  next: any
): any {
  const col = data[name] ?? (data[name] = []);
  const idx = col.findIndex(match);
  if (idx < 0) return null;
  col[idx] = next;
  persistCollection(name);
  return next;
}

export function deleteRecord(name: CollectionName, match: (rec: any) => boolean): boolean {
  const col = data[name];
  if (!col) return false;
  const idx = col.findIndex(match);
  if (idx < 0) return false;
  col.splice(idx, 1);
  persistCollection(name);
  return true;
}

export function replaceCollection(name: CollectionName, items: any[]): any[] {
  data[name] = items ?? [];
  persistCollection(name);
  return data[name];
}

export { DATA_DIR };