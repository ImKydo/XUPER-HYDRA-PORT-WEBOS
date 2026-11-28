#!/usr/bin/env node
// tests/e2e/welcome.mjs — pantalla de arranque: isotipo desnudo, anillo y
// versión discreta. Sin caja, sin nombre y sin lema.
// Uso: node tests/e2e/welcome.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { server, port } = await serve(path.join(ROOT, "webos/fidelity"));
const chrome = await launchChromium();
const { sid } = await chrome.browser.newTvPage({ throttle: 1 });
await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html`);
await sleep(1400);

const d = JSON.parse(await chrome.browser.eval(sid, `(() => {
  const mark = document.querySelector('.welcome-mark');
  const ring = document.querySelector('.welcome-ring');
  const ver  = document.querySelector('.welcome-version');
  const mr = mark ? mark.getBoundingClientRect() : { width: 0 };
  const vr = ver ? ver.getBoundingClientRect() : { left: 0, top: 0 };
  return JSON.stringify({
    nombre: !!document.querySelector('.welcome-name'),
    lema: !!document.querySelector('.welcome-free'),
    caja: !!document.querySelector('.welcome-logo'),
    marca: Math.round(mr.width),
    anillo: ring ? getComputedStyle(ring).animationName : null,
    vx: Math.round(vr.left),
    vy: Math.round(vr.top),
    fondo: mark ? getComputedStyle(mark).backgroundColor : null,
    radio: mark ? getComputedStyle(mark).borderTopLeftRadius : null,
  });
})()`));

const checks = [
  ["sin nombre sobre el isotipo", d.nombre === false],
  ["sin lema", d.lema === false],
  ["sin caja redondeada", d.caja === false && d.fondo === "rgba(0, 0, 0, 0)" && d.radio === "0px"],
  ["isotipo de 188 px", Math.abs(d.marca - 188) <= 1],
  ["anillo girando", d.anillo === "zephyr-spin"],
  ["versión en la esquina inferior derecha", d.vx > 1700 && d.vy > 1000],
];

let fallos = 0;
for (const [nombre, ok] of checks) {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}`);
  if (!ok) fallos++;
}
console.log(JSON.stringify(d));
chrome.close();
server.close();
console.log(fallos ? `\n${fallos} comprobaciones fallan` : "\narranque OK");
process.exit(fallos ? 1 : 0);
