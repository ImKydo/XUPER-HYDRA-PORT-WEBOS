#!/usr/bin/env node
// Falla si alguna hoja servida declara text-shadow. En un panel OLED la sombra
// solo ensucia el borde de las letras: el contraste se resuelve con el fondo.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "webos/fidelity/css");
const hits = [];
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".css"))) {
  readFileSync(path.join(DIR, f), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/text-shadow\s*:/.test(line)) hits.push(`${f}:${i + 1}  ${line.trim()}`);
    });
}
if (hits.length) {
  console.error(`no-text-shadow: ${hits.length} declaraciones\n` + hits.join("\n"));
  process.exit(1);
}
console.log("no-text-shadow OK — 0 declaraciones");
