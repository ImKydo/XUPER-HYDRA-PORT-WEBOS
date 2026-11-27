#!/usr/bin/env node
// tools/build.mjs — genera webos/fidelity/js/app.js a partir de src/.
//
// Por qué existe: hoy app.js es un archivo de 14 000 líneas con nombres
// minificados (e, t, a, i, u…) que nadie puede mantener. Este script convierte
// ese archivo en la SALIDA de un build, igual que ya lo trata el autor.
//
// Migración sin riesgo: src/legacy/app.legacy.js es una copia byte a byte del
// app.js actual y el manifiesto está vacío, así que la primera ejecución
// produce exactamente el mismo archivo. A partir de ahí, el código nuevo se
// escribe legible en src/modules/ y se añade al final del manifiesto.
//
// Uso:
//   node tools/build.mjs --write     # regenera app.js y sincroniza ?v=
//   node tools/build.mjs --check     # falla si app.js no coincide (CI)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "src/manifest.json");
const APP_JS = path.join(ROOT, "webos/fidelity/js/app.js");
const INDEX_HTML = path.join(ROOT, "webos/fidelity/index.html");

const mode = process.argv.includes("--check") ? "check" : "write";

function fail(msg) {
  console.error(`build: ${msg}`);
  process.exit(1);
}

if (!existsSync(MANIFEST)) {
  fail("falta src/manifest.json (ver docs/engineering/build.md)");
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) {
  fail("src/manifest.json necesita un array 'modules' no vacío");
}

const parts = [];
const noWrap = new Set(manifest.noWrap || []);
for (const rel of manifest.modules) {
  const abs = path.join(ROOT, "src", rel);
  if (!existsSync(abs)) fail(`módulo declarado y ausente: src/${rel}`);
  const src = readFileSync(abs, "utf8");
  if (noWrap.has(rel)) {
    // El legado se concatena VERBATIM: así la primera migración es byte a byte
    // idéntica al app.js actual y se puede verificar con sha256.
    parts.push(src);
  } else if (manifest.wrap !== false) {
    // Cada módulo va en su propio IIFE: los nombres minificados del legado no
    // pueden colisionar con el código nuevo.
    parts.push(`/* ---- src/${rel} ---- */\n;(function () {\n"use strict";\n${src}\n})();\n`);
  } else {
    parts.push(src);
  }
}

const output = parts.join("\n");

// Sincroniza el cache-buster de index.html con APP_VERSION del bundle.
const appVer = (output.match(/var APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
if (!appVer) fail("no se encontró APP_VERSION en el bundle generado");

const html = readFileSync(INDEX_HTML, "utf8");
// Dos textos deben seguir a APP_VERSION: el cache-buster del <script> y la
// versión que muestra la bienvenida (también la lee el diagnóstico, así que si
// el JS no llega a cargar el usuario ve una versión falsa).
const htmlFixed = html
  .replace(/(src="js\/app\.js\?v=)[\w.-]+(")/, `$1${appVer}$2`)
  .replace(/(class="welcome-version">)v?[\d.]+(<\/div>)/, `$1v${appVer}$2`);
if (!html.includes(`app.js?v=${appVer}`) && !html.includes("js/app.js?v=")) {
  fail("index.html no referencia js/app.js?v=: revisar la etiqueta <script>");
}

if (mode === "check") {
  const current = existsSync(APP_JS) ? readFileSync(APP_JS, "utf8") : "";
  const problems = [];
  if (current !== output) {
    const a = current.split("\n").length;
    const b = output.split("\n").length;
    problems.push(`app.js desincronizado (${a} líneas en disco vs ${b} generadas)`);
  }
  if (htmlFixed !== html) problems.push(`index.html desincronizado (¿v= o welcome-version?) respecto de ${appVer}`);
  if (problems.length) {
    console.error("build --check FALLA:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nEjecuta: node tools/build.mjs --write");
    process.exit(1);
  }
  console.log(`build --check OK — app.js (${output.length} bytes) y ?v=${appVer} al día`);
} else {
  writeFileSync(APP_JS, output);
  writeFileSync(INDEX_HTML, htmlFixed);
  console.log(`build --write OK — ${output.length} bytes, ${output.split("\n").length} líneas, ?v=${appVer}`);
}
