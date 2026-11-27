#!/usr/bin/env node
// tools/check/css-compat.mjs — detecta CSS que el Chromium del televisor ignora.
//
// Matriz real de webOS (no la del navegador de escritorio):
//   webOS 3.0/3.5 -> Chromium 38
//   webOS 4.x     -> Chromium 53
//   webOS 5.x     -> Chromium 68
//   webOS 6.x/22+ -> Chromium 87+
//
// Una propiedad no soportada no lanza error: se ignora, y la pantalla queda
// distinta a la del PC. Por eso hay que detectarla en CI.
//
// `gap` en flex se resuelve por CASCADA: display y gap suelen estar en reglas
// distintas del mismo selector, así que mirar un bloque aislado da falsos
// negativos. El resto de características se evalúa por bloque.
//
// Uso: node tools/check/css-compat.mjs [--fail]
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT, APP_FIDELITY } from "./lib.mjs";
import { parseRules, flexGapRules } from "../css-parse.mjs";

const CSS_DIR = path.posix.join(APP_FIDELITY, "css");
const ALL = readdirSync(path.join(ROOT, CSS_DIR)).filter((f) => f.endsWith(".css"));
// Tras la consolidación sólo se sirven estas tres; antes, las tres capas históricas.
const CONSOLIDATED = ["app.css", "tokens.generated.css", "nogap.css"];
const LEGACY = ["style.css", "ui-refresh.css", "clean.css"];
const files = ALL.some((f) => f === "app.css")
  ? ALL.filter((f) => CONSOLIDATED.includes(f))
  : ALL.filter((f) => LEGACY.includes(f));

let rules = [];
let totalLines = 0;
for (const f of files) {
  const src = readFileSync(path.join(ROOT, CSS_DIR, f), "utf8");
  totalLines += src.split("\n").length;
  rules = rules.concat(parseRules(src, `${CSS_DIR}/${f}`));
}

console.log(`CSS analizado: ${files.length} archivos, ${rules.length} reglas, ${totalLines} líneas\n`);

/* ---------- gap en flex (resuelto por cascada) ---------- */
const gapRules = flexGapRules(rules);
let blockers = gapRules.length;
if (gapRules.length) {
  console.log(
    `BLOQ  ${"flex-gap".padEnd(16)} ${String(gapRules.length).padStart(4)} reglas  (Chromium 84+) — en flex se ignora: los elementos quedan pegados`
  );
  for (const g of gapRules.slice(0, 3)) console.log(`        ${g.rule.selector.slice(0, 70)}`);
}

/* ---------- resto de características (por bloque) ---------- */
const FEATURES = [
  { id: "backdrop-filter", test: (r) => r.decls.some((d) => /^(-webkit-)?backdrop-filter$/.test(d.prop)), min: 76, severity: "alta", note: "el panel translucent se vuelve opaco o invisible" },
  { id: "aspect-ratio", test: (r) => r.decls.some((d) => d.prop === "aspect-ratio"), min: 88, severity: "alta", note: "la tarjeta pierde su proporción" },
  { id: "css-vars", test: (r) => r.decls.some((d) => /var\(--/.test(d.value)), min: 49, severity: "alta", note: "sin variables no hay tema" },
  { id: "position-sticky", test: (r) => r.decls.some((d) => d.prop === "position" && d.value === "sticky"), min: 56, severity: "media", note: "se comporta como static" },
  { id: "logical-inset", test: (r) => r.decls.some((d) => d.prop === "inset"), min: 87, severity: "media", note: "se ignora por completo" },
  { id: "is-where", test: (r) => /:(is|where)\(/.test(r.selector), min: 88, severity: "alta", note: "toda la regla se descarta" },
  { id: "clamp-minmax", test: (r) => r.decls.some((d) => /(clamp|minmax)\(/.test(d.value)), min: 79, severity: "media", note: "tipografía/medidas no se aplican" },
  { id: "display-grid", test: (r) => r.decls.some((d) => d.prop === "display" && /grid/.test(d.value)), min: 57, severity: "alta", note: "cae a block: sin rejilla" },
  { id: "scroll-behavior", test: (r) => r.decls.some((d) => d.prop === "scroll-behavior"), min: 61, severity: "baja", note: "el scroll salta en vez de animarse" },
  { id: "will-change", test: (r) => r.decls.some((d) => d.prop === "will-change"), min: 36, severity: "info", note: "soportado, pero crea capas GPU: usar con cuidado en TV" },
  { id: "filter-blur", test: (r) => r.decls.some((d) => d.prop === "filter" && /blur\(/.test(d.value)), min: 53, severity: "media", note: "caro en GPU de TV" },
];

for (const feat of FEATURES) {
  const hits = rules.filter((r) => {
    try {
      return feat.test(r);
    } catch {
      return false;
    }
  });
  if (!hits.length) continue;
  if (feat.severity === "alta") blockers += hits.length;
  console.log(
    `${feat.severity === "alta" ? "BLOQ" : feat.severity === "media" ? "AVIS" : "INFO"}  ${feat.id.padEnd(16)} ${String(hits.length).padStart(4)} reglas  (Chromium ${feat.min}+) — ${feat.note}`
  );
  for (const h of hits.slice(0, 3)) {
    console.log(`        ${h.file}:${h.line}  ${h.selector.slice(0, 70)}`);
  }
}

const impCount = files.reduce((n, f) => {
  const src = readFileSync(path.join(ROOT, CSS_DIR, f), "utf8");
  return n + (src.match(/!important/g) || []).length;
}, 0);

console.log(`\n!important totales: ${impCount}`);
console.log(`Reglas con alguna característica no soportada por Chromium <=53: ${blockers}`);

if (process.argv.includes("--fail") && blockers > 0) {
  console.error(`\nFALLA: ${blockers} reglas no se aplicarán en televisores webOS <=5.`);
  process.exit(1);
}
