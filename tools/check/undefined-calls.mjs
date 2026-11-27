#!/usr/bin/env node
// tools/check/undefined-calls.mjs — detecta llamadas a funciones que no existen.
//
// El bundle está repleto de identificadores de una letra: una llamada a un
// nombre que nadie declaró no rompe la carga, solo explota cuando esa rama se
// ejecuta (a veces meses después, en el televisor del usuario).
//
// Es consciente del ámbito: `i()` sólo es válido si `i` se declara en la
// función que la contiene o en una que la envuelve. La versión anterior
// comparaba contra una lista global de nombres declarados, así que una llamada
// a `i()` pasaba por buena porque otra función cualquiera tenía un `var i`.
// Ese falso negativo dejó pasar un bundle con
// `(function placeAbsolute() { ... i(); ... })`, que reventaba en ejecución.
//
// Uso: node tools/check/undefined-calls.mjs [archivo.js]
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./lib.mjs";
import { buildScopes } from "../deobf/scope.mjs";

const require = createRequire(import.meta.url);
const acorn = require("acorn");

const target = path.resolve(ROOT, process.argv[2] || "webos/fidelity/js/app.js");
const src = readFileSync(target, "utf8");

// Globals del navegador y del runtime. Si falta alguno, se añade aquí.
const GLOBALS = new Set(
  (
    "window document console navigator location history screen localStorage sessionStorage " +
    "setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame " +
    "XMLHttpRequest fetch WebSocket Image Audio Option Promise RegExp Date Math JSON Object Array " +
    "String Number Boolean Function Error TypeError escape unescape encodeURIComponent decodeURIComponent " +
    "encodeURI decodeURI parseInt parseFloat isNaN isFinite alert confirm prompt open close print " +
    "PalmServiceBridge webOS performance MutationObserver IntersectionObserver CustomEvent Event " +
    "KeyboardEvent MouseEvent URL URLSearchParams Blob File FileReader FormData Worker " +
    "getComputedStyle matchMedia scrollTo postMessage addEventListener dispatchEvent"
  ).split(/\s+/)
);

const ast = acorn.parse(src, { ecmaVersion: 5 });
const scopes = buildScopes(ast);

const missing = new Map();
scopes.walk(ast, scopes.rootScope, (node, scope) => {
  if (node.type !== "CallExpression" || !node.callee || node.callee.type !== "Identifier") return;
  const name = node.callee.name;
  if (GLOBALS.has(name)) return;
  if (!scopes.resolve(scope, name)) {
    if (!missing.has(name)) missing.set(name, []);
    missing.get(name).push(src.slice(0, node.start).split("\n").length);
  }
});

const names = [...missing.keys()].sort();
if (!names.length) {
  console.log(`undefined-calls OK — ninguna llamada a función inexistente en ${path.relative(ROOT, target)}`);
  process.exit(0);
}

console.error(`FALLA: ${names.length} nombre(s) llamados como función y no declarados en su ámbito:`);
for (const name of names) {
  const lines = missing.get(name);
  console.error(`  ${name}()  ${lines.length} llamada(s), primera en línea ${lines[0]}`);
  if (process.env.VERBOSE) console.error(`      líneas: ${lines.join(", ")}`);
}
process.exit(1);
