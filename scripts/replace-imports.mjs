/* One-off: troca os imports de jsonDb para repo em todo o src (sem depender de rede). */
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import path from "path";

const root = path.join(process.cwd(), "src");
const FROM = "@/db/jsonDb";
const TO = "@/db/repo";

function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      const c = readFileSync(p, "utf8");
      if (c.includes(FROM)) {
        writeFileSync(p, c.split(FROM).join(TO), "utf8");
        console.log("updated:", path.relative(process.cwd(), p));
      }
    }
  }
}
walk(root);
console.log("done.");