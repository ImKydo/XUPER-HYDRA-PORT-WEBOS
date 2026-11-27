#!/usr/bin/env node
// tools/check/compat.mjs — APIs que el motor más viejo soportado no tiene.
//
// La sintaxis ya la cubre es5.mjs (acorn --ecma5). Esto cubre lo otro: métodos
// y objetos que parsean bien pero no existen en Chromium 38 (webOS 3.0/3.5) o
// en Node 0.12 (servicio del televisor). Un `.flat()` no rompe la carga: rompe
// la pantalla cuando esa rama se ejecuta, y solo en los televisores viejos.
//
// Se excluyen las APIs que index.html ya polyfillea (includes, startsWith,
// endsWith, find, findIndex, Object.assign) y se acepta cualquier uso protegido
// con `typeof X` en la misma línea.
//
// Uso: node tools/check/compat.mjs [archivo...]
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = "webos/fidelity";
const SVC = "webos/services/com.webosflux.xuptertv.fidelity.service";

/* Reglas: [regex, motivo, identificador para comprobar guardas] */
const RULES = [
  [/\bObject\.(values|entries|fromEntries|hasOwn|getOwnPropertyDescriptors)\s*\(/, "Object.values/entries/fromEntries (ES2017)", null],
  [/\bPromise\.(allSettled|any)\s*\(/, "Promise.allSettled/any (ES2020)", null],
  [/\.(flat|flatMap|matchAll|replaceAll|trimStart|trimEnd|padStart|padEnd|at)\s*\(/, "método de Array/String ES2015+", null],
  [/\b(globalThis|queueMicrotask|structuredClone)\b/, "global ES2020", null],
  [/\b(ResizeObserver|WeakRef|IntersectionObserver)\b/, "API de navegador moderna", null],
  [/\bIntl\.(NumberFormat|DateTimeFormat)\s*\(/, "Intl (ausente en motores viejos)", null],
].map(([re, why]) => ({ re, why }));

/** Devuelve [{ line, fragment, why }] para un fuente dado. */
export function scanSource(code) {
  const out = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (!m) continue;
      const token = m[1] ? m[1] : m[0].replace(/[^\w.]/g, "");
      const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const before = line.slice(0, m.index);
      // Guardas aceptadas:
      //   - `typeof X` en cualquier punto de la línea (patrón `typeof X !== "undefined" && ...`);
      //   - una prueba de existencia ANTES de la llamada (`X ? ... : ...`, `X && ...`),
      //     que es lo que hace webOSTV.js con Object.getOwnPropertyDescriptors.
      // No vale un `X()` seguido de `&&`: ahí ya se llamó.
      const guarded =
        new RegExp(`typeof\\s+${esc}\\b`).test(line) ||
        new RegExp(`${esc}\\s*(\\?|&&|\\|\\|)`).test(before);
      if (guarded) continue;
      out.push({ line: i + 1, fragment: line.trim().slice(0, 90), why: rule.why });
      break; // una violación por línea basta
    }
  }
  return out;
}

/** Scripts inline de un HTML, saltando el bloque de polyfills. */
export function inlineScripts(html) {
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const body = m[1];
    if (!body.trim()) continue;
    // Los polyfills definen justo lo que aquí se prohíbe: se saltan.
    if (/prototype\.(includes|startsWith|endsWith|find)\s*=|prototype\.(includes|startsWith|endsWith|find)\s*=/.test(body)) continue;
    if (/Object\.assign\s*=/.test(body)) continue;
    scripts.push({ line: html.slice(0, m.index).split("\n").length, body });
  }
  return scripts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const extra = process.argv.slice(2);
  const targets = [];

  const jsDir = path.join(ROOT, APP, "js");
  for (const f of readdirSync(jsDir)) if (f.endsWith(".js")) targets.push(path.join(jsDir, f));
  const svcDir = path.join(ROOT, SVC);
  for (const f of readdirSync(svcDir)) if (f.endsWith(".js")) targets.push(path.join(svcDir, f));
  for (const f of extra) targets.push(path.resolve(ROOT, f));

  let total = 0;
  for (const file of targets) {
    const rel = path.relative(ROOT, file);
    const hits = scanSource(readFileSync(file, "utf8"));
    for (const h of hits) {
      total++;
      console.error(`${rel}:${h.line}  ${h.why}\n    ${h.fragment}`);
    }
  }

  // Scripts inline (los polyfills quedan fuera por inlineScripts()).
  const html = readFileSync(path.join(ROOT, APP, "index.html"), "utf8");
  for (const s of inlineScripts(html)) {
    for (const h of scanSource(s.body)) {
      total++;
      console.error(`webos/fidelity/index.html:~${s.line}  ${h.why}\n    ${h.fragment}`);
    }
  }

  if (total) {
    console.error(`\ncompat: ${total} uso(s) que webOS 3.0/3.5 (Chromium 38) no soporta`);
    process.exit(1);
  }
  console.log(`compat OK — ${targets.length} archivos + scripts inline sin APIs fuera del motor mínimo`);
}
