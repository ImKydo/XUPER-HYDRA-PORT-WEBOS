// El servicio de desarrollo debe entender el protocolo real que usa la app
// (GET /<metodo>?q=<json>) además del query plano que usan los curl del README.
import test from "node:test";
import assert from "node:assert/strict";
import { parseQuery } from "../../tools/helpers/dev-service-query.mjs";

test("lee el protocolo ?q= de la app", () => {
  const p = parseQuery("/home?q=" + encodeURIComponent(JSON.stringify({ root: "series", pageNum: 2 })));
  assert.equal(p.root, "series");
  assert.equal(p.pageNum, 2);
});

test("mantiene el query plano", () => {
  assert.equal(parseQuery("/search?value=dragon").value, "dragon");
});

test("q malformado cae al query plano", () => {
  assert.equal(parseQuery("/home?q={roto&root=kids").root, "kids");
});

test("sin query devuelve objeto vacío", () => {
  assert.deepEqual(parseQuery("/ping"), {});
});

test("decodifica valores con acentos y espacios", () => {
  assert.equal(parseQuery("/search?value=a%C3%B1o%20nuevo").value, "año nuevo");
});
