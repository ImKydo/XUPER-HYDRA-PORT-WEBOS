#!/usr/bin/env node
// tools/deobf/analyze.mjs — inventario de las funciones del app.js minificado.
//
// Genera un JSON con lo que hace falta para ponerles nombre con criterio:
// tamaño, parámetros, funciones que llama, selectores/ids del DOM que toca y
// los literales de interfaz que escribe. NO modifica nada.
//
// Uso:
//   node tools/deobf/analyze.mjs > docs/engineering/legacy-inventory.json
//   node tools/deobf/analyze.mjs --top=20        # resumen por consola
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// El renombrado se aplica a la FUENTE (src/legacy/app.legacy.js), no al
// artefacto generado: si no, `build --check` fallaría en el siguiente commit.
const TARGET = (process.argv.find((a) => a.startsWith("--target=")) || "").split("=")[1]
  || "src/legacy/app.legacy.js";
const APP = path.join(ROOT, TARGET);
const TOP = (process.argv.find((a) => a.startsWith("--top=")) || "").split("=")[1];

const src = readFileSync(APP, "utf8");
const lines = src.split("\n");
const ast = acorn.parse(src, { ecmaVersion: 5, locations: true });

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, node);
    else if (v && typeof v.type === "string") walk(v, visit, node);
  }
}

/* El archivo entero es un IIFE: !(function () { ... })();  La forma exacta del
   envoltorio no importa: se toma la FunctionExpression que abarca más código. */
let iife = null;
let iifeSize = 0;
walk(ast, (n) => {
  if (n.type === "FunctionExpression" && n.body && n.body.type === "BlockStatement") {
    const size = n.end - n.start;
    if (size > iifeSize) {
      iifeSize = size;
      iife = n;
    }
  }
});
const scopeBody = iife ? iife.body.body : ast.body;

/* nombres declarados en el nivel superior para distinguir llamadas internas */
const topLevel = new Map();
for (const stmt of scopeBody) {
  const decl = stmt.type === "FunctionDeclaration" ? stmt : null;
  if (decl && decl.id) topLevel.set(decl.id.name, decl);
  if (stmt.type === "VariableDeclaration") {
    for (const d of stmt.declarations) {
      if (d.id && d.id.type === "Identifier" && d.init && d.init.type === "FunctionExpression") {
        topLevel.set(d.id.name, d.init);
      }
    }
  }
}

function describe(fn, name) {
  const calls = new Set();
  const strings = new Set();
  const selectors = new Set();
  walk(fn, (n) => {
    if (n.type === "CallExpression" && n.callee.type === "Identifier" && topLevel.has(n.callee.name)) {
      calls.add(n.callee.name);
    }
    if (n.type === "Literal" && typeof n.value === "string") {
      const s = n.value;
      if (/^#[a-z0-9_-]+$/i.test(s) || /^\.[a-z0-9_-]+$/i.test(s)) selectors.add(s);
      else if (/^[a-z0-9_-]+$/.test(s) && s.length > 2) selectors.add(s); // ids/clases sin prefijo
      else if (/[áéíóúñ¿¡ ]/.test(s) && s.length < 90) strings.add(s);
    }
  });

  const startLine = fn.loc.start.line;
  const endLine = fn.loc.end.line;
  const snippet = lines.slice(startLine - 1, Math.min(endLine, startLine + 14)).join("\n");

  return {
    name,
    line: startLine,
    lines: endLine - startLine + 1,
    params: fn.params.map((p) => (p.type === "Identifier" ? p.name : "(patrón)")),
    internalCalls: [...calls].filter((c) => c !== name).slice(0, 12),
    selectors: [...selectors].slice(0, 14),
    uiStrings: [...strings].slice(0, 8),
    snippet,
  };
}

const inventory = [];
for (const [name, fn] of topLevel) {
  inventory.push(describe(fn, name));
}
inventory.sort((a, b) => b.lines - a.lines);

if (TOP) {
  console.log(`Funciones de nivel superior: ${inventory.length}\n`);
  console.log("linea lineas nombre        llama a");
  for (const f of inventory.slice(0, Number(TOP))) {
    console.log(
      String(f.line).padStart(5) + " " + String(f.lines).padStart(6) + "  " + f.name.padEnd(14) + " " +
        f.internalCalls.slice(0, 5).join(", ")
    );
  }
  const total = inventory.reduce((n, f) => n + f.lines, 0);
  console.log(`\nCobertura: ${total} de ${lines.length} líneas dentro de funciones de nivel superior`);
} else {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), file: "webos/fidelity/js/app.js", functions: inventory }, null, 1));
}
