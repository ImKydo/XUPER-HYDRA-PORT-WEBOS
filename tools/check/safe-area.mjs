#!/usr/bin/env node
// tools/check/safe-area.mjs — qué queda dentro de la banda de overscan.
//
// Muchos televisores recortan hasta un 5 % del borde (overscan). Este script
// arranca la app en Chromium y mide qué elementos interactivos o de texto caen
// dentro de esa banda. Es informativo por defecto: el layout de la app usa
// márgenes del 2,5 % a propósito y moverlo sin medir en el televisor rompería
// la geometría de las nueve pantallas.
//
// Uso:
//   node tools/check/safe-area.mjs            # informe
//   node tools/check/safe-area.mjs --strict   # falla si hay TEXTO en la banda
import { serve, launchChromium, sleep } from "../perf/cdp.mjs";

const STRICT = process.argv.includes("--strict");
const MARGIN = 96; // 5 % de 1920 y de 1080
const SCREENS = [
  ["home", "?screen=home&tab=0"],
  ["tv", "?screen=home&tab=1"],
  ["detail", "?screen=detail&vod=3"],
  ["settings", "?screen=settings"],
  ["player", "?screen=player&channels=1"],
];

const { server, port } = await serve(new URL("../..", import.meta.url).pathname + "webos/fidelity");
const chrome = await launchChromium();
let textoEnBanda = 0;

for (const [name, q] of SCREENS) {
  const { sid } = await chrome.browser.newTvPage({ throttle: 1 });
  await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html${q}`);
  await sleep(4500);
  const out = JSON.parse(
    await chrome.browser.eval(
      sid,
      `(() => {
    const M = ${MARGIN}, out = [];
    const scr = [...document.querySelectorAll('.screen')].find((s) => s.classList.contains('is-active'));
    if (!scr) return "[]";
    for (const el of scr.querySelectorAll('.focusable, .kids-subtitle, .hero-title, .detail-title, .p-title')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // El escenario del reproductor es a sangre por diseño.
      if (el.classList.contains('player-stage')) continue;
      const izq = r.x < M, der = r.x + r.width > 1920 - M;
      const arr = r.y < M, aba = r.y + r.height > 1080 - M;
      if (!(izq || der || arr || aba)) continue;
      out.push({
        cls: (el.className || '').toString().split(' ')[0],
        texto: (el.textContent || '').trim().slice(0, 24),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        bordes: [izq ? 'izq' : '', der ? 'der' : '', arr ? 'arr' : '', aba ? 'aba' : ''].filter(Boolean).join('+'),
      });
    }
    return JSON.stringify(out);
  })()`
    )
  );
  const conTexto = out.filter((o) => o.texto);
  textoEnBanda += conTexto.length;
  console.log(`${name.padEnd(9)} ${String(out.length).padStart(3)} elementos en la banda · ${conTexto.length} con texto`);
  for (const o of conTexto.slice(0, 3)) console.log(`          ${o.cls} "${o.texto}" (${o.bordes}) ${o.w}x${o.h}`);
}

console.log(`\nbanda: ${MARGIN} px (5 % de 1920x1080)`);
console.log(`elementos con texto dentro de la banda: ${textoEnBanda}`);
if (STRICT && textoEnBanda) {
  console.error("FALLA: hay texto que un televisor con overscan del 5 % recortaria.");
  process.exit(1);
}
chrome.close();
server.close();
