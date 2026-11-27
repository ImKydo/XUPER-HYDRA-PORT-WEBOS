#!/usr/bin/env node
// tools/check/undefined-calls.mjs — detecta llamadas a funciones que no existen.
//
// El bundle está repleto de identificadores de una letra: una llamada a un
// nombre que nadie declaró no rompe la carga, solo explota cuando esa rama se
// ejecuta (a veces meses después, en el televisor del usuario). Este check la
// encuentra en frío.
//
// Encontró un fallo real: `firstFocusable()` se llamaba en el cierre del
// diálogo de actualización y no estaba definida en ninguna parte.
//
// Uso: node tools/check/undefined-calls.mjs [archivo.js]
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./lib.mjs";

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

const declared = new Set();

const addPattern = (id) => {
  if (!id) return;
  if (id.type === "Identifier") declared.add(id.name);
};

const walk = (node, visit) => {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) walk(c, visit);
    else if (v && typeof v.type === "string") walk(v, visit);
  }
};

const ast = acorn.parse(src, { ecmaVersion: 5 });

walk(ast, (n) => {
  if (n.type === "FunctionDeclaration") addPattern(n.id);
  if (n.type === "FunctionExpression" && n.id) addPattern(n.id);
  if (n.type === "VariableDeclarator") addPattern(n.id);
  if (n.type === "CatchClause") addPattern(n.param);
  if (
    (n.type === "FunctionDeclaration" || n.type === "FunctionExpression") &&
    Array.isArray(n.params)
  ) {
    for (const p of n.params) addPattern(p);
  }
});

const missing = new Map();
walk(ast, (n) => {
  if (n.type !== "CallExpression" || !n.callee || n.callee.type !== "Identifier") return;
  const name = n.callee.name;
  if (declared.has(name) || GLOBALS.has(name)) return;
  if (!missing.has(name)) missing.set(name, []);
  missing.get(name).push(src.slice(0, n.start).split("\n").length);
});

const names = [...missing.keys()].sort();
if (!names.length) {
  console.log(`undefined-calls OK — ninguna llamada a función inexistente en ${path.relative(ROOT, target)}`);
  process.exit(0);
}

console.error(`FALLA: ${names.length} nombre(s) llamados como función y nunca declarados:`);
for (const name of names) {
  const lines = missing.get(name);
  console.error(`  ${name}()  ${lines.length} llamada(s), primera en línea ${lines[0]}`);
  if (process.env.VERBOSE) console.error(`      líneas: ${lines.join(", ")}`);
}
process.exit(1);
