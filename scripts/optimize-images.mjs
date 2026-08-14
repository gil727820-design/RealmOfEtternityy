/**
 * Otimização de imagens do jogo (sem quebrar referências).
 *
 * - Redimensiona PNGs "in place" (mesmo nome/extensão) com paleta quantizada,
 *   mantendo transparência. Regras por pasta conforme o tamanho máximo exibido.
 * - Converte os fundos das ilhas (map_bg) para WebP (fundo em tela cheia e
 *   escurecido) — as referências ficam em src/game/constants.ts (REGIONS.bg).
 *
 * Uso: node scripts/optimize-images.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

// Pasta → dimensão máxima (px). Arquivos já menores que o alvo e < 150KB são pulados.
const RULES = [
  { dir: "public/images/sidebar", max: 256 },      // sidebar 40-48px
  { dir: "public/images/icons", max: 256 },        // missões 32-44px, ligas até 112px
  { dir: "public/images/attributes", max: 128 },   // ícones de status 24-28px
  { dir: "public/images/potions", max: 256 },      // poções 24-96px
  { dir: "public/images/chests", max: 512 },       // baús até 176px
  { dir: "public/images/islands", max: 512 },      // ilhas 64-96px
  { dir: "public/images/tower/monsters", max: 512 }, // monstros 64-144px
  { dir: "public/images/tower", max: 512 },        // torre_infinita (160px)
  { dir: "public/classes", max: 512 },             // avatares até 144px
  { dir: "public/skins", max: 512 },               // skins até ~96px
  { dir: "public/images/items", max: 128 },        // ícones de item 12-64px
];

let processed = 0;
let skipped = 0;
let savedBytes = 0;

async function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.png$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function optimizeFile(file, max) {
  const stat = fs.statSync(file);
  const meta = await sharp(file, { failOn: "none" }).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const tooBig = w > max || h > max;
  // Já pequeno e dentro da dimensão → não mexe.
  if (!tooBig && stat.size < 150 * 1024) {
    skipped++;
    return;
  }
  const tmp = file + ".tmp";
  await sharp(file, { failOn: "none" })
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .png({ palette: true, quality: 92, effort: 9 })
    .toFile(tmp);
  const newSize = fs.statSync(tmp).size;
  if (newSize < stat.size) {
    fs.renameSync(tmp, file);
    savedBytes += stat.size - newSize;
    processed++;
  } else {
    fs.unlinkSync(tmp);
    skipped++;
  }
}

async function convertBgToWebp() {
  const dir = "public/images/map_bg";
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (!/^bg_.+\.png$/i.test(f)) continue;
    const file = path.join(dir, f);
    const out = file.replace(/\.png$/i, ".webp");
    if (fs.existsSync(out)) continue;
    const before = fs.statSync(file).size;
    await sharp(file, { failOn: "none" })
      .webp({ quality: 78, effort: 6 })
      .toFile(out);
    const after = fs.statSync(out).size;
    if (after < before) {
      fs.unlinkSync(file);
      savedBytes += before - after;
      processed++;
    } else {
      fs.unlinkSync(out);
      skipped++;
    }
  }
}

(async () => {
  for (const rule of RULES) {
    const files = await walk(rule.dir);
    for (const f of files) {
      try {
        await optimizeFile(f, rule.max);
      } catch (e) {
        console.error("ERRO em", f, "-", e.message);
      }
    }
  }
  await convertBgToWebp();
  console.log(`✔ ${processed} imagens otimizadas, ${skipped} puladas, ${(savedBytes / 1024 / 1024).toFixed(1)} MB economizados.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
