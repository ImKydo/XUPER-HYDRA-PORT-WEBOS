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
