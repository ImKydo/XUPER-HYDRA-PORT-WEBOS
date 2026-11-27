// El chequeo de llamadas inexistentes salvó un bundle roto, pero su primera
// versión comparaba contra una lista global de nombres: una llamada a `i()`
// pasaba por buena si CUALQUIER otra función tenía un `var i`. Ahora resuelve
// por ámbito, y esto lo fija.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOOL = path.join(ROOT, "tools/check/undefined-calls.mjs");

function run(source) {
  const dir = mkdtempSync(path.join(tmpdir(), "uc-"));
  const file = path.join(dir, "x.js");
  writeFileSync(file, source);
  try {
    execFileSync("node", [TOOL, file], { stdio: "pipe" });
    return { code: 0, out: "OK" };
  } catch (e) {
    return { code: e.status, out: String(e.stderr || "") };
  }
}

test("pasa cuando la función está declarada", () => {
  assert.equal(run("function g(){}function f(){g()}").code, 0);
});

test("falla si se llama a algo que no existe", () => {
  const r = run("function f(){g()}");
  assert.equal(r.code, 1);
  assert.match(r.out, /g\(\)/);
});

test("no se deja engañar por un nombre declarado en otra función", () => {
  // El falso negativo real: `i` existía como variable local en otra parte del
  // bundle, así que la lista global lo daba por bueno.
  const r = run("function a(){var i=1;return i}function b(){i()}");
  assert.equal(r.code, 1);
  assert.match(r.out, /i\(\)/);
});

test("acepta la recursión de una expresión de función con nombre", () => {
  assert.equal(run("var x=(function i(n){return n?i(n-1):0})(3);").code, 0);
});

test("acepta parámetros usados como función", () => {
  assert.equal(run("function f(cb){cb()}").code, 0);
});

test("acepta globals del navegador", () => {
  assert.equal(run("var t=setTimeout(function(){},1);parseInt('1',10);").code, 0);
});
