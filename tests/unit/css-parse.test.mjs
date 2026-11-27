// Pruebas del parser CSS compartido: es la base de css-compat y de nogap, y
// ya tuvo un bug real (desalineaba bloques con @keyframes y no resolvía la
// cascada entre archivos).
import test from "node:test";
import assert from "node:assert/strict";
import { parseRules, flexGapRules, gapPair, isZeroLength } from "../../tools/css-parse.mjs";

test("parsea una regla simple", () => {
  const rules = parseRules(".a { color: red; display: flex; }", "x.css");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].selector, ".a");
  assert.deepEqual(rules[0].decls.map((d) => d.prop), ["color", "display"]);
  assert.equal(rules[0].display, "flex");
});

test("@keyframes no se confunde con una regla", () => {
  const css = "@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }\n.b { color: blue; }";
  const rules = parseRules(css, "x.css");
  assert.deepEqual(rules.map((r) => r.selector), [".b"]);
});

test("resuelve la cascada: display y gap en reglas distintas del mismo selector", () => {
  const css = ".r { display: flex; }\n.r { gap: 12px; }";
  const out = flexGapRules(parseRules(css, "x.css"));
  assert.equal(out.length, 1);
  assert.equal(out[0].col, "12px");
});

test("ignora gap: 0 y los selectores sin flex", () => {
  const css = ".a { display: flex; gap: 0; }\n.b { display: block; gap: 8px; }\n.c { display: flex; gap: 8px; }";
  const out = flexGapRules(parseRules(css, "x.css"));
  assert.deepEqual(out.map((r) => r.rule.selector), [".c"]);
});

test("gap con dos valores separa fila y columna", () => {
  assert.deepEqual(gapPair("10px 20px"), { row: "10px", col: "20px" });
  assert.deepEqual(gapPair("10px"), { row: "10px", col: "10px" });
});

test("detecta flex-direction column", () => {
  const css = ".col { display: flex; flex-direction: column; gap: 6px; }";
  const out = flexGapRules(parseRules(css, "x.css"));
  assert.equal(out[0].column, true);
});

test("isZeroLength reconoce solo el cero", () => {
  assert.equal(isZeroLength("0"), true);
  assert.equal(isZeroLength("0px"), true);
  assert.equal(isZeroLength("10px"), false);
});
