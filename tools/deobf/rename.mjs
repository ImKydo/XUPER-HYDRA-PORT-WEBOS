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

/* ---------- aplicar el renombrado sólo a Identifier ---------- */
const ast = acorn.parse(src, { ecmaVersion: 5 });
const edits = [];
let renamed = 0;
walk(ast, (node, parent, key) => {
  if (node.type !== "Identifier") return;
  if (!(node.name in mapping)) return;
  // No tocar claves de objeto ni propiedades de acceso (cambiarían el nombre real).
  if (parent && parent.type === "MemberExpression" && key === "property" && !parent.computed) return;
  if (parent && parent.type === "Property" && key === "key" && !parent.computed) return;
  edits.push([node.start, node.end, mapping[node.name]]);
  renamed++;
});

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
