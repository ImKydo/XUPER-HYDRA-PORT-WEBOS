#!/usr/bin/env node
// tools/check/dead-css.mjs — clases definidas en el CSS que nadie usa.
//
// Informativo: no falla el build. Sirve para decidir qué borrar de legacy.css
// cuando se migre una pantalla. Ojo: una clase puede crearse desde el JS con
// concatenación ("is-" + estado), así que antes de borrar conviene buscar el
// prefijo, no sólo el nombre completo.
//
// Uso: node tools/check/dead-css.mjs [--max=200]
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT, APP_FIDELITY } from "./lib.mjs";

const CSS_DIR = path.join(ROOT, APP_FIDELITY, "css");
const SERVED = ["tokens.generated.css", "legacy.css", "app.css", "nogap.css"];

// Texto donde buscar uso: HTML + todo el JS propio.
const html = readFileSync(path.join(ROOT, APP_FIDELITY, "index.html"), "utf8");
const jsFiles = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      walk(abs);
    } else if (e.name.endsWith(".js")) jsFiles.push(abs);
  }
};
walk(path.join(ROOT, "webos/fidelity"));
walk(path.join(ROOT, "src"));

const haystack = [html, ...jsFiles.map((f) => readFileSync(f, "utf8"))].join("\n");

const classes = new Set();
for (const f of SERVED) {
  let src;
  try {
    src = readFileSync(path.join(CSS_DIR, f), "utf8");
  } catch {
    continue;
  }
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Sólo selectores (antes de cada llave), sin pseudo-clases ni estados.
  for (const block of src.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const m of block[1].matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) classes.add(m[1]);
  }
}

const dead = [...classes].filter((c) => haystack.indexOf(c) === -1).sort();
const max = Number((process.argv.find((a) => a.startsWith("--max=")) || "").split("=")[1] || 200);

console.log(`clases definidas: ${classes.size}`);
console.log(`sin ninguna referencia en HTML/JS: ${dead.length}`);
for (const c of dead.slice(0, max)) console.log(`  .${c}`);
if (dead.length > max) console.log(`  … y ${dead.length - max} más`);
