// El catálogo empaquetado y la respuesta de /home pesan 274 KB porque cada
// ítem trae sinopsis, reparto, director y cinco campos más que una tarjeta no
// pinta. La proyección los quita SOLO en las rejillas; el detalle sigue
// recibiendo el ítem completo.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const magis = require(path.join(
  ROOT,
  "webos/services/com.webosflux.xuptertv.fidelity.service/magis.js"
));

const FULL = {
  id: "ABC1",
  title: "Una película",
  category: "movies",
  kind: "película",
  score: "7.1",
  year: "2025",
  duration: "01:50:00",
  genres: ["Acción", "Aventura", "Drama", "Ciencia ficción"],
  poster: "https://cdn/p.jpg",
  landscape: "https://cdn/l.jpg",
  backdrop: "https://cdn/b.jpg",
  type: "movie",
  director: "Alguien",
  actors: "Uno, Dos, Tres",
  synopsis: "Una sinopsis larguísima que solo hace falta en el detalle.",
  alias: "Alias",
  country: "ES",
  releaseDate: "2025-01-01",
  tagline: "Frase",
  volumeCount: 3,
  updateCount: 7,
  moreAudio: 1,
  moreSubtitle: 2,
  row: "",
  streamUrl: "",
  portal: true,
};

test("conserva los campos que pinta una tarjeta", () => {
  const p = magis.projectItem(FULL);
  // `genres` se recorta a tres: tiene su propia prueba.
  for (const k of ["id", "title", "category", "kind", "score", "year", "duration", "poster", "landscape", "backdrop", "type"]) {
    assert.deepEqual(p[k], FULL[k], `falta ${k}`);
  }
});

test("quita lo que solo usa el detalle", () => {
  const p = magis.projectItem(FULL);
  for (const k of ["director", "actors", "synopsis", "alias", "country", "releaseDate", "tagline", "volumeCount", "updateCount", "moreAudio", "moreSubtitle", "row", "streamUrl", "portal"]) {
    assert.equal(p[k], undefined, `sobra ${k}`);
  }
});

test("recorta los géneros a tres", () => {
  const p = magis.projectItem(FULL);
  assert.equal(p.genres.length, 3);
  assert.deepEqual(p.genres, ["Acción", "Aventura", "Drama"]);
});

test("no muta el original", () => {
  const copia = JSON.parse(JSON.stringify(FULL));
  magis.projectItem(FULL);
  assert.deepEqual(FULL, copia);
});

test("aguanta entradas vacías", () => {
  assert.equal(magis.projectItem(null), null);
  assert.equal(magis.projectItem(undefined), undefined);
});

test("un ítem ya proyectado se queda igual", () => {
  const p = magis.projectItem(FULL);
  assert.deepEqual(magis.projectItem(p), p);
});
