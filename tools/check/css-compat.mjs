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
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT, APP_FIDELITY } from "./lib.mjs";
import { parseRules, flexGapRules } from "../css-parse.mjs";

const CSS_DIR = path.posix.join(APP_FIDELITY, "css");
const ALL = readdirSync(path.join(ROOT, CSS_DIR)).filter((f) => f.endsWith(".css"));
// Se analiza TODO lo que el televisor carga de verdad. Tras la consolidación
// son app.css + tokens.generated.css + nogap.css, PERO legacy.css sigue
// sirviéndose debajo: dejarla fuera del análisis ocultaba sus backdrop-filter.
const SERVED = ["app.css", "tokens.generated.css", "nogap.css", "legacy.css"];
const files = ALL.some((f) => f === "app.css")
  ? ALL.filter((f) => SERVED.includes(f))
  : ALL.filter((f) => ["style.css", "ui-refresh.css", "clean.css"].includes(f));

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

// La capa nogap compensa el gap con márgenes en los televisores viejos. Una
// regla con gap sólo es bloqueante si NO tiene su equivalente en nogap.css.
const nogapPath = path.join(ROOT, CSS_DIR, "nogap.css");
const nogapSelectors = new Set();
if (existsSync(nogapPath)) {
  // Los comentarios mencionan `.nogap` y rompen el recorte del selector.
  const src = readFileSync(nogapPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of src.matchAll(/\.nogap\s+([^{]+?)\s*>\s*\*\s*\+\s*\*/g)) {
    for (const part of m[1].split(",")) nogapSelectors.add(part.trim());
  }
}
const uncovered = gapRules.filter((g) => {
  const sels = g.rule.selector.split(",").map((x) => x.trim());
  return !sels.every((sel) => nogapSelectors.has(sel));
});

let blockers = uncovered.length;
if (gapRules.length) {
  const covered = gapRules.length - uncovered.length;
  if (covered) {
    console.log(
      `COMP  ${"flex-gap".padEnd(16)} ${String(covered).padStart(4)} reglas  compensadas por css/nogap.css (márgenes en webOS < 22)`
    );
  }
  if (uncovered.length) {
    console.log(
      `BLOQ  ${"flex-gap".padEnd(16)} ${String(uncovered.length).padStart(4)} reglas  (Chromium 84+) — sin compensar: los elementos quedan pegados`
    );
    for (const g of uncovered.slice(0, 3)) console.log(`        ${g.rule.selector.slice(0, 70)}`);
  }
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
  // Sin comentarios: app.css explica en su cabecera que no usa ninguno.
  const src = readFileSync(path.join(ROOT, CSS_DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return n + (src.match(/!important/g) || []).length;
}, 0);

console.log(`\n!important totales: ${impCount}`);
console.log(`Reglas con alguna característica no soportada por Chromium <=53: ${blockers}`);

if (process.argv.includes("--fail") && blockers > 0) {
  console.error(`\nFALLA: ${blockers} reglas no se aplicarán en televisores webOS <=5.`);
  process.exit(1);
}
