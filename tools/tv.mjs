#!/usr/bin/env node
// tools/tv.mjs — inspeccionar la app en un televisor real por CDP.
//
// Requiere el túnel abierto en otra terminal:
//   ares-novacom -d zephyr -f -p 9998:9998
//
// Uso:
//   node tools/tv.mjs info                 # métricas de pantalla y app
//   node tools/tv.mjs shot docs/tv.png     # captura PNG
//   node tools/tv.mjs eval "document.title"
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.TV_CDP_PORT || 9998);
const [, , cmd, arg] = process.argv;

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) {
  console.error("no hay página inspeccionable en el televisor");
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", rej);
});
const send = (method, params) =>
  new Promise((res) => {
    const n = ++id;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });

if (cmd === "info") {
  const { result } = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const s = (sel) => document.querySelector(sel);
      const r = (sel) => { const e = s(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
      return {
        url: location.href,
        pantalla: [window.innerWidth, window.innerHeight, window.devicePixelRatio],
        version: window.APP_VERSION || null,
        raiz: document.documentElement.className,
        tabs: [...document.querySelectorAll('.tab-item .tab-title')].map((t) => t.textContent),
        barra: r('.home-tabs'),
        hero: r('.hero'),
        heroTitulo: (s('.hero-title') || {}).textContent || null,
        primerRiel: r('.catalog-rail'),
        tarjetas: document.querySelectorAll('.poster').length,
        enfocables: document.querySelectorAll('.focusable').length,
        foco: (s('.is-focused') || {}).className || null,
        pantallaActiva: [...document.querySelectorAll('.screen')].filter((x) => x.classList.contains('is-active')).map((x) => x.id),
      };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
} else if (cmd === "shot") {
  const out = arg || "docs/screenshots/tv.png";
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(result.data, "base64"));
  console.log(out);
} else if (cmd === "keys") {
  // node tools/tv.mjs keys down,down,right,enter,back
  const MAP = {
    down: ["ArrowDown", 40],
    up: ["ArrowUp", 38],
    left: ["ArrowLeft", 37],
    right: ["ArrowRight", 39],
    enter: ["Enter", 13],
    back: ["Backspace", 461],
  };
  const pasos = String(arg || "").split(",").filter(Boolean);
  const foco = async () => {
    const { result } = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => { const e = document.querySelector('.is-focused'); if (!e) return 'ninguno'; const r = e.getBoundingClientRect(); return e.className.replace('focusable', '').trim() + ' @' + Math.round(r.x) + ',' + Math.round(r.y) + ' "' + (e.textContent || '').trim().slice(0, 24) + '"'; })()`,
    });
    return result.result.value;
  };
  console.log("inicio:", await foco());
  for (const paso of pasos) {
    const k = MAP[paso.trim()];
    if (!k) {
      console.log("  ?", paso);
      continue;
    }
    await send("Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: k[1], nativeVirtualKeyCode: k[1], key: k[0], code: k[0] });
    await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: k[1], nativeVirtualKeyCode: k[1], key: k[0], code: k[0] });
    await new Promise((r) => setTimeout(r, 450));
    console.log(`  ${paso.padEnd(6)} ->`, await foco());
  }
} else if (cmd === "eval") {
  const { result } = await send("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression: arg });
  console.log(JSON.stringify(result.result.value, null, 2));
} else {
  console.error("uso: node tools/tv.mjs info|shot <ruta>|eval \"<expr>\"");
  process.exit(2);
}
ws.close();
