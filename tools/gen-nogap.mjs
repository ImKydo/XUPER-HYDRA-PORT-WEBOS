#!/usr/bin/env node
// tools/gen-nogap.mjs — genera la capa de compatibilidad para `gap` en flex.
//
// Chromium 38–83 (webOS 3.x–5.x) ignora `gap` dentro de display:flex: los
// elementos quedan pegados. En vez de ensuciar app.css (y de reescribirlo con
// un codemod destructivo), se genera un archivo aparte con márgenes y se activa
// con la clase `nogap` sólo en los televisores que lo necesitan.
//
// Patrón tomado de TiviBro (MIT): app/css/nogap.css generado por scripts/gen-nogap.js.
//
// Uso:
//   node tools/gen-nogap.mjs --write    # regenera webos/fidelity/css/nogap.css
//   node tools/gen-nogap.mjs --check    # falla si está desactualizado (CI)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRules, flexGapRules, isZeroLength } from "./css-parse.mjs";
import { APP_FIDELITY } from "./check/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Se leen las dos capas servidas: legacy.css trae las reglas heredadas con
// `gap` y app.css las nuevas. Antes sólo miraba app.css y generaba 0 reglas.
const SOURCES = ["css/legacy.css", "css/app.css"].map((f) => path.join(ROOT, APP_FIDELITY, f));
const OUT = path.join(ROOT, APP_FIDELITY, "css/nogap.css");
const mode = process.argv.includes("--check") ? "check" : "write";

for (const src of SOURCES) {
  if (!existsSync(src)) {
    console.error(`gen-nogap: falta ${path.relative(ROOT, src)}`);
    process.exit(0);
  }
}

let rules = [];
for (const src of SOURCES) {
  rules = rules.concat(parseRules(readFileSync(src, "utf8"), path.basename(src)));
}
const candidates = flexGapRules(rules);

const out = [
  "/* GENERADO por tools/gen-nogap.mjs — no editar a mano.",
  "   Sólo se aplica con la clase .nogap (webOS < 22). Fuente: legacy.css + app.css. */",
  "",
];

for (const { rule, row, col, column } of candidates) {
  const kids = rule.selector
    .split(",")
    .map((s) => `.nogap ${s.trim()} > * + *`)
    .join(",\n");
  const decls = [];
  if (column) {
    if (!isZeroLength(row)) decls.push(`margin-top:${row}`);
    if (!isZeroLength(col)) decls.push(`margin-left:${col}`);
  } else {
    if (!isZeroLength(col)) decls.push(`margin-left:${col}`);
    if (!isZeroLength(row)) decls.push(`margin-top:${row}`);
  }
  if (decls.length) out.push(`${kids}{${decls.join(";")}}`);
}

const text = out.join("\n") + "\n";
const count = out.length - 3; // 3 líneas de cabecera

if (mode === "check") {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error(`gen-nogap --check FALLA: nogap.css desactualizado (${count} reglas).`);
    console.error("Ejecuta: node tools/gen-nogap.mjs --write");
    process.exit(1);
  }
  console.log(`gen-nogap --check OK — ${count} reglas`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-nogap --write OK — ${count} reglas en css/nogap.css`);
}
