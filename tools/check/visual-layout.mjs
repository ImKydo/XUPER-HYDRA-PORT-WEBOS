#!/usr/bin/env node
// tools/check/visual-layout.mjs — regresión de maquetación (T6.7).
//
// Comparar píxeles aquí sería inútil: las carátulas llegan de una CDN y en un
// entorno sin red la mitad no carga. Lo que sí debe ser estable es la GEOMETRÍA:
// dónde cae la barra, la portada, el primer riel, los botones y el foco. Este
// script guarda esas cajas y falla si alguna se mueve más de la tolerancia.
//
// Uso:
//   node tools/check/visual-layout.mjs --update   # escribe la línea base
//   node tools/check/visual-layout.mjs            # compara
//   node tools/check/visual-layout.mjs --max=8    # tolerancia en px
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { serve, launchChromium, sleep } from "../perf/cdp.mjs";
import { ROOT } from "./lib.mjs";

const UPDATE = process.argv.includes("--update");
const MAX = Number((process.argv.find((a) => a.startsWith("--max=")) || "").split("=")[1] || 8);
const BASE = path.join(ROOT, "docs/perf/layout-baseline.json");

const SCREENS = [
  ["welcome", "?screen=welcome", 2500],
  ["home", "?screen=home&tab=0", 5500],
  ["tv", "?screen=home&tab=1", 5500],
  ["detail", "?screen=detail&vod=3", 4500],
  ["search", "?screen=search&q=dragon", 4500],
  ["settings", "?screen=settings", 4000],
  ["player", "?screen=player&channels=1", 5000],
];

// Selectores estables por pantalla: lo que define la maqueta, no el contenido.
const SELECTORS = [
  ".home-tabs",
  ".tabs-brand",
  ".tab-item",
  ".home-notify",
  ".hero",
  ".hero-title",
  ".hero-play",
  ".hero-dots",
  ".kids-subtitle",
  ".catalog-rail",
  ".poster",
  ".detail-title",
  ".detail-player",
  ".detail-btn",
  ".search-keyboard",
  ".search-grid",
  ".search-hot",
  ".kb-key",
  ".settings-menu",
  ".settings-right",
  ".settings-item",
  ".settings-panel",
  ".welcome-logo",
  ".welcome-name",
  ".welcome-loading",
  ".welcome-free",
  ".player-stage",
  ".pc-toolbar-btn",
];

const { server, port } = await serve(path.join(ROOT, "webos/fidelity"));
const chrome = await launchChromium();
const actual = {};

for (const [name, q, wait] of SCREENS) {
  const { sid } = await chrome.browser.newTvPage({ throttle: 1 });
  await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html${q}`);
  await sleep(wait);
  actual[name] = JSON.parse(
    await chrome.browser.eval(
      sid,
      `(() => {
    const out = {};
    for (const sel of ${JSON.stringify(SELECTORS)}) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      out[sel] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    return JSON.stringify(out);
  })()`
    )
  );
}
chrome.close();
server.close();

if (UPDATE) {
  mkdirSync(path.dirname(BASE), { recursive: true });
  writeFileSync(BASE, JSON.stringify(actual, null, 2) + "\n");
  console.log(`línea base escrita: ${path.relative(ROOT, BASE)} (${Object.keys(actual).length} pantallas)`);
  process.exit(0);
}

if (!existsSync(BASE)) {
  console.error("falta la línea base: node tools/check/visual-layout.mjs --update");
  process.exit(2);
}

const base = JSON.parse(readFileSync(BASE, "utf8"));
let fallos = 0;
for (const name of Object.keys(actual)) {
  const antes = base[name];
  if (!antes) {
    console.log(`NUEVA ${name.padEnd(9)} (sin línea base)`);
    continue;
  }
  const movidos = [];
  for (const sel of Object.keys(antes)) {
    const a = antes[sel];
    const b = actual[name][sel];
    if (!b) {
      movidos.push(`${sel}: desapareció`);
      continue;
    }
    const d = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    if (d > MAX) movidos.push(`${sel}: ${a.join(",")} -> ${b.join(",")} (${d} px)`);
  }
  const nuevos = Object.keys(actual[name]).filter((s) => !antes[s]);
  if (movidos.length) {
    fallos += movidos.length;
    console.log(`FALLA ${name}`);
    for (const m of movidos.slice(0, 5)) console.log(`        ${m}`);
  } else {
    console.log(`OK    ${name.padEnd(9)} ${Object.keys(antes).length} cajas${nuevos.length ? ` (+${nuevos.length} nuevas)` : ""}`);
  }
}

console.log(fallos ? `\n${fallos} cajas fuera de tolerancia (${MAX} px)` : `\nmaquetación estable (±${MAX} px)`);
process.exit(fallos ? 1 : 0);
