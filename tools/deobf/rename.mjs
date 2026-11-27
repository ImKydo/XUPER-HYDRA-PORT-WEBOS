#!/usr/bin/env node
// tools/deobf/rename.mjs — renombra identificadores sin cambiar el comportamiento.
//
// Idea: en ES5, renombrar UN nombre de forma global y biyectiva (todas sus
// apariciones, y sólo identificadores reales, no claves de objeto ni propiedades)
// no puede cambiar la semántica. Lo único que la puede cambiar es que el nombre
// nuevo ya exista en el archivo (colisión). Por eso:
//
//   1. Se comprueba que el nombre nuevo no exista ya en NINGUNA parte del archivo.
//   2. Se renombran sólo nodos Identifier (nunca strings, comentarios, claves).
//   3. Se verifica que la forma canónica del AST no cambió (equiv.mjs).
//   4. Se verifica que el archivo sigue parseando y que app.js sigue arrancando.
//
// Uso:
//   node tools/deobf/rename.mjs --map=rename.json --write
//   node tools/deobf/rename.mjs --map=rename.json --check
// rename.json: { "Va": "buildSettingsScreen", "Ca": "buildDetailScreen" }
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// El renombrado se aplica a la FUENTE (src/legacy/app.legacy.js), no al
// artefacto generado: si no, `build --check` fallaría en el siguiente commit.
const TARGET = (process.argv.find((a) => a.startsWith("--target=")) || "").split("=")[1]
  || "src/legacy/app.legacy.js";
const APP = path.resolve(ROOT, TARGET); // resolve, no join: TARGET puede ser absoluto
const MAP = (process.argv.find((a) => a.startsWith("--map=")) || "").split("=")[1];
const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");

if (!MAP) {
  console.error("falta --map=archivo.json");
  process.exit(2);
}

const src = readFileSync(APP, "utf8");
const mapping = JSON.parse(readFileSync(path.resolve(ROOT, MAP), "utf8"));

/* ---------- recorrido genérico con padre y clave ---------- */
function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent, key);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, node, k);
    else if (v && typeof v.type === "string") walk(v, visit, node, k);
  }
}

/* ---------- nombres usados en el archivo ---------- */
const used = new Set();
walk(acorn.parse(src, { ecmaVersion: 5 }), (n) => {
  if (n.type === "Identifier") used.add(n.name);
});

/* ---------- validación del mapeo ---------- */
const VALID = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED = new Set(
  "break case catch continue debugger default delete do else finally for function if in instanceof new return switch this throw try typeof var void while with true false null".split(" ")
);
const problems = [];
const targets = new Set();
// Nombres de la zona protegida de reproducción (AGENTS.md): el renombrador no
// puede tocarlos ni aunque alguien los ponga en el mapeo por error.
const PROTECTED = new Set(
  JSON.parse(readFileSync(path.join(ROOT, "tools/deobf/protected-names.json"), "utf8"))
);
for (const [oldName, newName] of Object.entries(mapping)) {
  if (PROTECTED.has(oldName)) problems.push(`"${oldName}" está en la zona protegida (AGENTS.md)`);
  if (!used.has(oldName)) problems.push(`"${oldName}" no aparece en app.js`);
  if (!VALID.test(newName)) problems.push(`"${newName}" no es un identificador ES5 válido`);
  if (RESERVED.has(newName)) problems.push(`"${newName}" es palabra reservada`);
  if (used.has(newName)) problems.push(`"${newName}" YA existe en app.js (colisión)`);
  if (targets.has(newName)) problems.push(`"${newName}" está repetido en el mapeo`);
  targets.add(newName);
}
if (problems.length) {
  console.error("MaPeo inválido:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

/* ---------- ámbitos: sólo se renombra el binding de nivel superior ---------- */
// Los nombres de una letra son parámetros locales en cientos de funciones.
// Renombrar `e` sin mirar el ámbito convierte también esos parámetros y deja
// `function createEl(createEl, createEl)`: equivalente, pero ilegible.
const ast = acorn.parse(src, { ecmaVersion: 5 });
const scopeOfNode = new Map();
const makeScope = (parent, node) => ({ parent, node, names: new Set() });

function collectScopes(node, scope) {
  if (!node || typeof node.type !== "string") return;

  if (node.type === "FunctionDeclaration") {
    // En ES5 la declaración se eleva al ámbito de la función contenedora.
    if (node.id) scope.names.add(node.id.name);
    const inner = makeScope(scope, node);
    scopeOfNode.set(node, inner);
    for (const p of node.params) if (p.type === "Identifier") inner.names.add(p.name);
    for (const s of node.body.body) collectScopes(s, inner);
    return;
  }
  if (node.type === "FunctionExpression") {
    const inner = makeScope(scope, node);
    scopeOfNode.set(node, inner);
    // El nombre de una función con nombre sólo existe dentro de ella.
    if (node.id) inner.names.add(node.id.name);
    for (const p of node.params) if (p.type === "Identifier") inner.names.add(p.name);
    for (const s of node.body.body) collectScopes(s, inner);
    return;
  }
  if (node.type === "VariableDeclarator") {
    if (node.id && node.id.type === "Identifier") scope.names.add(node.id.name);
    collectScopes(node.init, scope);
    return;
  }
  if (node.type === "CatchClause") {
    const inner = makeScope(scope, node);
    scopeOfNode.set(node, inner);
    if (node.param && node.param.type === "Identifier") inner.names.add(node.param.name);
    collectScopes(node.body, inner);
    return;
  }

  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) collectScopes(c, scope);
    else if (v && typeof v.type === "string") collectScopes(v, scope);
  }
}

const rootScope = makeScope(null, ast);
for (const s of ast.body) collectScopes(s, rootScope);

// El "nivel superior" es el cuerpo del IIFE que envuelve el bundle.
let topScope = rootScope;
for (const s of scopeOfNode.values()) {
  if (s.parent === rootScope && s.names.size > topScope.names.size) topScope = s;
}

const resolveScope = (scope, name) => {
  for (let s = scope; s; s = s.parent) if (s.names.has(name)) return s;
  return null;
};

/* ---------- aplicar el renombrado sólo a Identifier del nivel superior ---------- */
const edits = [];
let renamed = 0;

function renameWalk(node, scope, parent, key) {
  if (!node || typeof node.type !== "string") return;

  // En una función, el `id` pertenece al ámbito EXTERIOR (ahí se declara el
  // nombre); parámetros y cuerpo al interior. Sin esta distinción, un parámetro
  // con el mismo nombre que la función tapa la declaración y el bundle queda
  // con llamadas renombradas y declaración sin renombrar.
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
    const inner = scopeOfNode.get(node) || scope;
    if (node.id) renameWalk(node.id, scope, node, "id");
    for (const p of node.params) renameWalk(p, inner, node, "params");
    renameWalk(node.body, inner, node, "body");
    return;
  }
  if (node.type === "CatchClause") {
    const inner = scopeOfNode.get(node) || scope;
    if (node.param) renameWalk(node.param, inner, node, "param");
    renameWalk(node.body, inner, node, "body");
    return;
  }

  if (node.type === "Identifier" && node.name in mapping) {
    const isProperty =
      parent &&
      ((parent.type === "MemberExpression" && key === "property" && !parent.computed) ||
        (parent.type === "Property" && key === "key" && !parent.computed));
    // Sólo si el identificador resuelve al binding de nivel superior.
    if (!isProperty && resolveScope(scope, node.name) === topScope) {
      edits.push([node.start, node.end, mapping[node.name]]);
      renamed++;
    }
  }

  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) renameWalk(c, scope, node, k);
    else if (v && typeof v.type === "string") renameWalk(v, scope, node, k);
  }
}
for (const s of ast.body) renameWalk(s, rootScope, null, null);

if (!renamed) {
  console.error("no se encontró ninguna aparición que renombrar");
  process.exit(1);
}

let out = src;
for (const [start, end, name] of edits.sort((a, b) => b[0] - a[0])) {
  out = out.slice(0, start) + name + out.slice(end);
}

/* ---------- verificación 1: sigue parseando ---------- */
try {
  acorn.parse(out, { ecmaVersion: 5 });
} catch (e) {
  console.error("El resultado NO parsea:", e.message);
  process.exit(1);
}

/* ---------- verificación 2: forma canónica idéntica ---------- */
// Asigna un id a cada nombre distinto según orden de aparición. `nameMap`
// deshace el renombrado en la salida: sin eso, un identificador renombrado
// obtiene un id nuevo y el chequeo falla aunque el cambio sea correcto (p. ej.
// cuando el nombre viejo también aparece como clave de objeto, que no se toca).
function canonical(code, nameMap = {}) {
  const tree = acorn.parse(code, { ecmaVersion: 5 });
  const seen = new Map();
  let next = 0;
  return JSON.stringify(tree, (k, v) => {
    // start/end/loc/range cambian con la longitud de los nombres: fuera.
    if (k === "loc" || k === "range" || k === "start" || k === "end") return undefined;
    if (v && typeof v === "object" && v.type === "Identifier") {
      const name = Object.prototype.hasOwnProperty.call(nameMap, v.name) ? nameMap[v.name] : v.name;
      if (!seen.has(name)) seen.set(name, next++);
      return { type: "Identifier", id: seen.get(name) };
    }
    return v;
  });
}
const reverse = {};
for (const [oldName, newName] of Object.entries(mapping)) reverse[newName] = oldName;
if (canonical(src) !== canonical(out, reverse)) {
  console.error("La forma canónica cambió: el renombrado NO es equivalente.");
  process.exit(1);
}

/* ---------- verificación 3: cada nombre nuevo queda declarado ---------- */
// La verificación 2 no basta: si las llamadas se renombran y la declaración no,
// el mapeo inverso hace que la forma canónica coincida igual y la app se rompe
// en ejecución con "x is not defined". Pasó de verdad con `function e(e, t)`.
const outAst = acorn.parse(out, { ecmaVersion: 5 });
const declaredNames = new Set();
walk(outAst, (n) => {
  if (n.type === "FunctionDeclaration" && n.id) declaredNames.add(n.id.name);
  if (n.type === "VariableDeclarator" && n.id && n.id.type === "Identifier") declaredNames.add(n.id.name);
});
const undeclared = Object.values(mapping).filter((n) => !declaredNames.has(n));
if (undeclared.length) {
  console.error(
    `Renombrado inconsistente: ${undeclared.join(", ")} se usa pero no se declara. No se escribe nada.`
  );
  process.exit(1);
}

const before = Object.keys(mapping).length;
console.log(`OK  ${before} nombres, ${renamed} apariciones renombradas, forma canónica idéntica`);

if (CHECK && out !== src) {
  console.error("--check: el archivo en disco no tiene aplicado el mapeo.");
  process.exit(1);
}
if (WRITE) {
  writeFileSync(APP, out);
  console.log(`escrito ${path.relative(ROOT, APP)} (${src.length} -> ${out.length} bytes)`);
}
if (!WRITE) console.log("(sin --write no se modifica nada)");
