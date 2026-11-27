#!/usr/bin/env node
// tools/check/es5.mjs — exige ES5 puro en el cliente y en el servicio.
//
// Motivo: webOS 3.x ejecuta el servicio en Node 0.12 / V8 3.28 y la app en
// Chromium 38. Un solo `const`, una arrow o un template string rompen la carga
// y el televisor muestra "el servicio no arrancó" o una pantalla en blanco.
//
// Uso: node tools/check/es5.mjs
import { exists, parse, jsFiles, checker, APP_FIDELITY, SVC_DIR, SERVICE_FILES } from "./lib.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const c = checker("es5");

const targets = [
  `${APP_FIDELITY}/js/app.js`,
  ...SERVICE_FILES.map((f) => `${SVC_DIR}/${f}`).filter((f) => exists(f)),
];

let failures = 0;
for (const rel of targets) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  try {
    parse(src, rel);
    c.ok(rel, "ES5 válido");
  } catch (err) {
    failures++;
    c.fail(rel, "no es ES5", err.message);
  }
}

/* Comprobaciones extra que acorn no cubre: APIs de ES6+ usadas como método. */
const BANNED_METHODS = [
  [".includes(", "String/Array.prototype.includes (ES6)"],
  [".startsWith(", "String.prototype.startsWith (ES6)"],
  [".endsWith(", "String.prototype.endsWith (ES6)"],
  [".padStart(", "String.prototype.padStart (ES2017)"],
  [".padEnd(", "String.prototype.padEnd (ES2017)"],
  ["Object.assign(", "Object.assign (ES6)"],
  ["Array.from(", "Array.from (ES6)"],
  ["Number.isInteger(", "Number.isInteger (ES6)"],
];

for (const rel of targets) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  const hits = [];
  for (const [needle, label] of BANNED_METHODS) {
    let idx = -1;
    while ((idx = src.indexOf(needle, idx + 1)) !== -1) {
      const line = src.slice(0, idx).split("\n").length;
      hits.push(`${label} en :${line}`);
    }
  }
  c.assert(`${rel} · APIs`, "sin APIs ES6+ sin polyfill", hits.length === 0, hits.slice(0, 6).join(" | "));
}

process.exit(c.report());
