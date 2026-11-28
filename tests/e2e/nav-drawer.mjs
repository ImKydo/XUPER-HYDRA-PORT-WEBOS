#!/usr/bin/env node
// tests/e2e/nav-drawer.mjs — cajón lateral con foco exclusivo.
//
// Describe el comportamiento pedido: el menú no existe en pantalla hasta que
// se pulsa izquierda en el borde izquierdo del catálogo; mientras está abierto
// el foco vive solo dentro, y al cerrar vuelve al elemento que lo abrió.
//
// Uso: node tests/e2e/nav-drawer.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { server, port } = await serve(path.join(ROOT, "webos/fidelity"));
const chrome = await launchChromium();
const { sid } = await chrome.browser.newTvPage({ throttle: 1 });
await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html?screen=home&tab=0`);
await sleep(6000);

const key = async (k, code, espera = 500) => {
  await chrome.browser.send("Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k }, sid);
  await chrome.browser.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k }, sid);
  await sleep(espera);
};
const estado = async () =>
  JSON.parse(await chrome.browser.eval(sid, `(() => {
    const panel = document.getElementById('home-tabs');
    const pages = document.getElementById('home-pages');
    const scrim = document.querySelector('.home-sidebar-bg');
    const r = panel.getBoundingClientRect();
    const p = pages.getBoundingClientRect();
    const f = document.querySelector('.is-focused');
    const b = f ? f.getBoundingClientRect() : { x: 0, y: 0 };
    return JSON.stringify({
      abierto: panel.classList.contains('is-open'),
      x: Math.round(r.x),
      ancho: Math.round(r.width),
      contenidoX: Math.round(p.x),
      velo: Number(getComputedStyle(scrim).opacity),
      foco: f ? f.className.replace('focusable','').trim() : 'ninguno',
      fx: Math.round(b.x)
    });
  })()`));

// Centro del icono de Inicio: debe caer a 48 px del borde en ambos estados,
// para que el icono no salte cuando el raíl se expande.
const icono = async () =>
  JSON.parse(await chrome.browser.eval(sid, `(() => {
    const it = [...document.querySelectorAll('.tab-item')].filter((el) => el.textContent.trim() === 'Inicio')[0];
    const ic = it.querySelector('.tab-icon');
    const r = ic.getBoundingClientRect();
    const b = it.getBoundingClientRect();
    return JSON.stringify({ centro: Math.round(r.left + r.width / 2), ancho: Math.round(r.width), itemX: Math.round(b.x), itemAncho: Math.round(b.width) });
  })()`));

const fallos = [];
const check = (n, ok, det) => {
  console.log(`${ok ? "OK  " : "FALLA"} ${n}${det ? "  " + det : ""}`);
  if (!ok) fallos.push(n);
};

let e = await estado();
check("raíl colapsado visible", !e.abierto && e.x === 0 && e.ancho === 96, JSON.stringify(e));
check("contenido desplazado por el raíl", Math.abs(e.contenidoX - 96) <= 2, String(e.contenidoX));
check("foco inicial en contenido", e.foco.indexOf("hero-") !== -1, e.foco);
const ic0 = await icono();
check("icono centrado con el raíl colapsado", Math.abs(ic0.centro - 48) <= 1, JSON.stringify(ic0));

await key("ArrowDown", 40);
e = await estado();
check("abajo entra a la primera fila", e.foco.indexOf("poster") !== -1, e.foco);

await key("ArrowLeft", 37);
e = await estado();
check("izquierda abre el cajón", e.abierto && e.x === 0, JSON.stringify(e));
check("el foco entra al cajón", e.foco.startsWith("tab-item"), e.foco);
check("el catálogo se empuja", Math.abs(e.contenidoX - 320) <= 4, String(e.contenidoX));
check("el velo oscurece", e.velo > 0.35, String(e.velo));
await sleep(400);
const ic1 = await icono();
check("el icono no se mueve al abrir", Math.abs(ic1.centro - 48) <= 1, JSON.stringify(ic1));
const contraste = JSON.parse(await chrome.browser.eval(sid, `(() => {
  const it = document.querySelector('.tab-item.is-focused');
  const path = it.querySelector('.tab-icon svg path, .tab-icon svg circle, .tab-icon svg rect');
  const rgb = (v) => String(v).split('(')[1].split(')')[0].split(',').map(Number).slice(0, 3);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const f = rgb(getComputedStyle(it).backgroundColor);
  const t = path ? rgb(getComputedStyle(path).stroke) : [0, 0, 0];
  return JSON.stringify({ fondo: f, trazo: t, delta: Math.round(Math.abs(lum(f) - lum(t))) });
})()`));
check("el icono no se camufla", contraste.delta > 120, JSON.stringify(contraste));

await key("ArrowDown", 40);
e = await estado();
check("abajo dentro del cajón", e.abierto && e.foco.startsWith("tab-item"), e.foco);

await key("ArrowRight", 39);
e = await estado();
check("derecha cierra", !e.abierto, JSON.stringify(e));
check("el catálogo vuelve al raíl", Math.abs(e.contenidoX - 96) <= 4, String(e.contenidoX));
check("el foco vuelve a la tarjeta", e.foco.indexOf("poster") !== -1, e.foco);

await key("ArrowLeft", 37);
await key("Backspace", 461, 600);
e = await estado();
check("Back cierra", !e.abierto && e.foco.indexOf("poster") !== -1, JSON.stringify(e));

chrome.close();
server.close();
console.log(fallos.length ? `\n${fallos.length} comprobaciones fallan` : "\ncajón lateral OK");
process.exit(fallos.length ? 1 : 0);
