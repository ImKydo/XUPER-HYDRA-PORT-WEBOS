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
const SRC = path.join(ROOT, APP_FIDELITY, "css/app.css");
const OUT = path.join(ROOT, APP_FIDELITY, "css/nogap.css");
const mode = process.argv.includes("--check") ? "check" : "write";

if (!existsSync(SRC)) {
  console.error("gen-nogap: falta webos/fidelity/css/app.css (la consolidación CSS aún no se aplicó)");
  process.exit(0);
}

const rules = parseRules(readFileSync(SRC, "utf8"), "app.css");
const candidates = flexGapRules(rules);

const out = [
  "/* GENERADO por tools/gen-nogap.mjs — no editar a mano.",
  "   Sólo se aplica con la clase .nogap (webOS < 22). Fuente: app.css. */",
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
const count = out.length - 4;

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
