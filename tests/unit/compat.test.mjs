// La matriz de compatibilidad evita que se cuele una API que Chromium 38 no
// tiene. Un `.flat()` parsea perfecto y revienta solo en el televisor viejo.
import test from "node:test";
import assert from "node:assert/strict";
import { scanSource, inlineScripts } from "../../tools/check/compat.mjs";

test("detecta métodos ES2015+", () => {
  assert.equal(scanSource("var x = arr.flat();").length, 1);
  assert.equal(scanSource("var y = s.padStart(2, '0');").length, 1);
  assert.equal(scanSource("var z = list.at(-1);").length, 1);
});

test("detecta Object.values y Promise.allSettled", () => {
  assert.equal(scanSource("Object.values(o);").length, 1);
  assert.equal(scanSource("Promise.allSettled([a]);").length, 1);
});

test("detecta globals modernos", () => {
  assert.equal(scanSource("globalThis.x = 1;").length, 1);
  assert.equal(scanSource("var c = structuredClone(o);").length, 1);
});

test("acepta el uso protegido con typeof", () => {
  assert.equal(scanSource('if (typeof ResizeObserver !== "undefined") { new ResizeObserver(f); }').length, 0);
});

test("acepta las APIs que index.html polyfillea", () => {
  assert.equal(scanSource("if (arr.includes(1) && s.startsWith('a')) {}").length, 0);
  assert.equal(scanSource("Object.assign(a, b);").length, 0);
  assert.equal(scanSource("arr.find(function () { return 1; });").length, 0);
});

test("ignora comentarios", () => {
  assert.equal(scanSource("// no usar arr.flat() aquí").length, 0);
});

test("los polyfills inline del HTML no cuentan como uso", () => {
  const html = `<script>Array.prototype.includes=function(v){return this.indexOf(v)>=0};</script><script>arr.flat();</script>`;
  const scripts = inlineScripts(html);
  assert.equal(scripts.length, 1, "el bloque de polyfills se descarta");
  assert.equal(scanSource(scripts[0].body).length, 1, "el otro script sí se analiza");
});
