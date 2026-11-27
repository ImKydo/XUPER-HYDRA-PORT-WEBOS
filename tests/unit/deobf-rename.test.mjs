// El renombrador es la herramienta que hace legible el bundle. Toca 14.000
// líneas de código en producción, así que sus garantías se prueban antes de
// usarlo: equivalencia, no tocar propiedades y respetar la zona protegida.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOOL = path.join(ROOT, "tools/deobf/rename.mjs");

function run(source, mapping) {
  const dir = mkdtempSync(path.join(tmpdir(), "deobf-"));
  const target = path.join(dir, "x.js");
  writeFileSync(target, source);
  const map = path.join(dir, "map.json");
  writeFileSync(map, JSON.stringify(mapping));
  try {
    execFileSync("node", [TOOL, `--map=${map}`, `--target=${target}`, "--write"], { stdio: "pipe" });
    return readFileSync(target, "utf8");
  } catch (e) {
    return "__ERROR__:" + (e.stderr || "").toString();
  }
}

test("renombra la declaración y sus usos", () => {
  const out = run("function Va(a){return a+1}var b=Va(2);", { Va: "sumaUno" });
  assert.match(out, /function sumaUno/);
  assert.match(out, /sumaUno\(2\)/);
});

test("no toca nombres que son propiedad de objeto", () => {
  const out = run("var o={Va:1};var x=o.Va;function Va(){}", { Va: "sumaUno" });
  assert.match(out, /\{Va:1\}/);
  assert.match(out, /o\.Va/);
  assert.match(out, /function sumaUno/);
});

test("rechaza una colisión", () => {
  const out = run("function Va(){}function f(){}", { Va: "f" });
  assert.match(out, /__ERROR__/);
  assert.match(out, /colisión/);
});

test("rechaza renombrar la zona protegida", () => {
  const out = run("function resolveSmooth(){}\nvar x=resolveSmooth();", { resolveSmooth: "suave" });
  assert.match(out, /__ERROR__/);
  assert.match(out, /protegid/i);
});

test("rechaza nombres ausentes del archivo", () => {
  const out = run("function Va(){}", { NoExiste: "otro" });
  assert.match(out, /__ERROR__/);
  assert.match(out, /no aparece/);
});

/* Los nombres de una letra son el 65% de las funciones, pero además son
   parámetros locales en cientos de sitios. Renombrar por texto los convierte a
   todos y deja `function createEl(createEl, createEl)`. El renombrado debe
   respetar el ámbito: solo el binding de nivel superior. */

test("no renombra un parámetro que se llama igual", () => {
  const out = run("function e(x){return x}function f(e){return e+1}var y=e(2);", { e: "createEl" });
  assert.match(out, /function createEl\(x\)/);
  assert.match(out, /function f\(e\)\{return e\+1\}/);
  assert.match(out, /y=createEl\(2\)/);
});

test("no renombra una variable local que se llama igual", () => {
  const out = run("function e(){return 1}function g(){var e=9;return e}var z=e();", { e: "readConfig" });
  assert.match(out, /function readConfig\(\)/);
  assert.match(out, /var e=9;return e/);
  assert.match(out, /z=readConfig\(\)/);
});

test("no renombra el parámetro de un catch que se llama igual", () => {
  const out = run("function e(){}try{e()}catch(e){e()}", { e: "runTask" });
  assert.match(out, /function runTask\(\)/);
  assert.match(out, /catch\(e\)\{e\(\)\}/);
});

test("renombra una función cuyos parámetros repiten su propio nombre", () => {
  // Caso real del bundle: `function e(e, t, a) { ... document.createElement(e) }`.
  // Si el id se resuelve en el ámbito interno, el parámetro lo tapa y la
  // declaración no se renombra mientras las llamadas sí: bundle roto.
  const out = run("function e(e,t){return document.createElement(e)}var x=e(1,2);", { e: "createEl" });
  assert.match(out, /function createEl\(e,t\)/);
  assert.match(out, /x=createEl\(1,2\)/);
});

test("respeta una expresión de función con nombre que hace sombra", () => {
  // `(function i() { ... i() ... })()` enlaza `i` DENTRO de sí misma. El
  // renombrador de nivel superior no debe tocar ni el nombre ni la recursión.
  // Caso real: el bucle de refreshCatalog, que quedó roto con
  // `(function placeAbsolute() { ... i(); ... })`.
  const out = run(
    "function i(){return 1}(function i(n){return n?i(n-1):2})();var z=i();",
    { i: "placeAbsolute" }
  );
  assert.match(out, /\(function i\(n\)\{return n\?i\(n-1\):2\}\)\(\)/);
  assert.match(out, /z=placeAbsolute\(\)/);
});
