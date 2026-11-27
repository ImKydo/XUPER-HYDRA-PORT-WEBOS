#!/usr/bin/env node
// tools/check/inline-scripts.mjs — valida el JS embebido en el HTML.
//
// `node --check` no ve los <script> inline, y un error de sintaxis ahí deja la
// pantalla en blanco en el televisor sin ningún mensaje. index.html trae ~400
// líneas de polyfills en línea, así que este check no es opcional.
//
// Patrón adaptado de scripts/lint.sh de TiviBro (MIT).
//
// Uso: node tools/check/inline-scripts.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const TARGETS = ["webos/fidelity/index.html"];
let bad = 0;

for (const rel of TARGETS) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let n = 0;
  while ((m = re.exec(src))) {
    n++;
    const body = m[1];
    if (!body.trim()) continue;
    const line = src.slice(0, m.index).split("\n").length;
    try {
      new vm.Script(body, { filename: `${rel} inline #${n} (línea ${line})` });
    } catch (e) {
      bad = 1;
      console.error(`${rel}: script inline #${n} desde línea ${line}: ${e.message}`);
    }
  }
  console.log(`${rel}: ${n} script(s) inline`);
}

if (bad) {
  console.error("\nFALLA: hay JS inline con errores de sintaxis");
  process.exit(1);
}
console.log("inline-scripts OK");
