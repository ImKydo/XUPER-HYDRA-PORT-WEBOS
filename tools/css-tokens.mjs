#!/usr/bin/env node
// tools/css-tokens.mjs — compila src/design/tokens.json a CSS con valores literales.
//
// Por qué no variables CSS: webOS 1.x–3.x usan Chromium 38, que no soporta
// var(--x). Si escribiéramos var(--space-4), en esas TVs la propiedad se
// ignoraría y el layout se caería. Este script mantiene una única fuente de
// verdad (el JSON) y emite clases utilitarias con valores ya resueltos.
//
// Uso:
//   node tools/css-tokens.mjs --write   # regenera tokens.generated.css
//   node tools/css-tokens.mjs --check   # falla si está desactualizado (CI)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src/design/tokens.json");
const OUT = path.join(ROOT, "webos/fidelity/css/tokens.generated.css");
const mode = process.argv.includes("--check") ? "check" : "write";

if (!existsSync(SRC)) {
  // Antes de la fase CSS (T5.1) todavía no hay tokens: no es un fallo.
  console.log("css-tokens: sin src/design/tokens.json todavía (se crea en T5.1)");
  process.exit(0);
}

const tokens = JSON.parse(readFileSync(SRC, "utf8"));

const lines = [
  "/* GENERADO por tools/css-tokens.mjs — no editar a mano.",
  "   Valores literales: compatible con Chromium 38 (webOS 1.x–3.x).",
  "   Fuente: src/design/tokens.json */",
  "",
  ":root { /* sólo informativo; ningún valor depende de variables */ }",
  "",
];

function emitScale(group, prefix, prop) {
  const values = tokens[group] || {};
  lines.push(`/* ${group} */`);
  for (const [key, value] of Object.entries(values)) {
    lines.push(`.${prefix}-${key} { ${prop}: ${value}; }`);
  }
  lines.push("");
}

emitScale("space", "s", "padding");
emitScale("gap", "g", "margin-right");
emitScale("font", "t", "font-size");
emitScale("line", "lh", "line-height");
emitScale("radius", "r", "border-radius");

/* Colores como clases semánticas, no como valores sueltos en cada regla. */
lines.push("/* color */");
for (const [key, value] of Object.entries(tokens.color || {})) {
  lines.push(`.c-${key} { color: ${value}; }`);
  lines.push(`.bg-${key} { background-color: ${value}; }`);
}
lines.push("");

const output = lines.join("\n");

if (mode === "check") {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== output) {
    console.error("css-tokens --check FALLA: tokens.generated.css desactualizado.");
    console.error("Ejecuta: node tools/css-tokens.mjs --write");
    process.exit(1);
  }
  console.log(`css-tokens --check OK — ${Object.keys(tokens).length} grupos`);
} else {
  writeFileSync(OUT, output);
  console.log(`css-tokens --write OK — ${output.split("\n").length} líneas en ${path.relative(ROOT, OUT)}`);
}
