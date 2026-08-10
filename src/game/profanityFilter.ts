// Lista de palavras proibidas (palavrões, termos +18, ofensas)
const BLOCKED_WORDS = [
  // Português
  "porra", "caralho", "buceta", "boceta", "pinto", "piroca", "rola", "pau", "foda", "foder",
  "merda", "bosta", "coco", "cuzao", "cuzão", "cu", "bunda", "viado", "viada", "bicha",
  "puta", "putinha", "putaria", "vagabunda", "vadia", "prostituta", "piranha", "galinha",
  "fdp", "pqp", "vsf", "tnc", "krl", "carai", "porra", "arrombado", "arrombada",
  "otario", "otário", "idiota", "imbecil", "retardado", "burro", "estupido", "estúpido",
  "babaca", "trouxa", "corno", "chifrudo", "safado", "safada", "tarado", "tarada",
  "punheta", "punheteiro", "masturbacao", "masturbar", "gozar", "goza", "ejacular",
  "sexo", "sexual", "sexy", "xxx", "porn", "porno", "pornô", "nude", "nudes",
  "nazista", "nazi", "hitler", "fascista", "racista", "negra", "preto", "macaco",
  "judeu", "judio", "gay", "lesbica", "lésbica", "trans", "travesti",
  // English
  "fuck", "fucking", "shit", "bitch", "ass", "asshole", "dick", "cock", "pussy",
  "whore", "slut", "bastard", "damn", "crap", "cunt", "nigger", "nigga", "fag",
  "faggot", "retard", "porn", "sex", "nude", "naked", "penis", "vagina", "boobs",
  "tits", "anal", "oral", "cum", "jizz", "sperm", "dildo", "viagra", "erection",
  // Variações e leetspeak
  "fck", "f4ck", "sh1t", "b1tch", "d1ck", "c0ck", "pvta", "put4", "buc3ta",
  "p1roca", "car4lho", "m3rda", "arr0mbado", "v1ado", "g4y",
  // Admin/Hack
  "admin", "administrador", "moderador", "mod", "gm", "gamemaster", "hack", "hacker",
  "cheat", "cheater", "bot", "exploit", "bug", "glitch",
];

// Caracteres similares para detectar evasão
const CHAR_REPLACEMENTS: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "+": "t",
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  // Remover acentos
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Substituir caracteres similares
  for (const [char, replacement] of Object.entries(CHAR_REPLACEMENTS)) {
    normalized = normalized.split(char).join(replacement);
  }
  // Remover caracteres especiais e números
  normalized = normalized.replace(/[^a-z]/g, "");
  return normalized;
}

export function containsProfanity(text: string): boolean {
  const normalized = normalizeText(text);
  
  for (const word of BLOCKED_WORDS) {
    const normalizedWord = normalizeText(word);
    if (normalized.includes(normalizedWord)) {
      return true;
    }
  }
  
  // Verificar padrões suspeitos
  if (/(.)\1{3,}/.test(normalized)) return true; // 4+ caracteres repetidos
  
  return false;
}

export function isValidUsername(username: string): { valid: boolean; reason?: string } {
  if (!username || typeof username !== "string") {
    return { valid: false, reason: "Nome de usuário obrigatório" };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, reason: "Mínimo 3 caracteres" };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, reason: "Máximo 20 caracteres" };
  }
  
  // Apenas letras, números e underscore
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, reason: "Apenas letras, números e _" };
  }
  
  // Deve começar com letra
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return { valid: false, reason: "Deve começar com uma letra" };
  }
  
  if (containsProfanity(trimmed)) {
    return { valid: false, reason: "Nome contém termos proibidos" };
  }
  
  return { valid: true };
}
