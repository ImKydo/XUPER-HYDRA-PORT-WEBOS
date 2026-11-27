#!/usr/bin/env node
// tests/e2e/smoke.mjs — prueba de humo real en Chromium sobre las 5 pantallas.
//
// Levanta el servicio de desarrollo, sirve la app, emula un televisor
// (1920x1080) y para cada pantalla comprueba tres cosas:
//   1. la pantalla queda activa (#screen-<x>.is-active)
//   2. tiene elementos enfocables
//   3. el mando enfoca algo al pulsar una flecha (.is-focused)
// Además falla si hay una excepción JS no capturada.
//
// El reproductor queda fuera a propósito: necesita un stream real y su
// verificación pertenece a las pruebas en televisor.
//
// Uso: node tests/e2e/smoke.mjs [--verbose]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, freePort, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = path.join(ROOT, "webos/fidelity");
const VERBOSE = process.argv.includes("--verbose");

const SCREENS = [
  // La bienvenida es una pantalla de arranque sin botones: no tiene foco, pero
  // sí muestra la versión, y esa versión alimenta el aviso de servicio viejo.
  { name: "welcome", q: "?screen=welcome", focus: false, version: true },
  { name: "home", q: "?screen=home&tab=0" },
  { name: "detail", q: "?screen=detail&vod=3" },
  { name: "search", q: "?screen=search&q=dragon" },
  { name: "settings", q: "?screen=settings" },
];

const APP_VER = JSON.parse(readFileSync(path.join(APP_DIR, "appinfo.json"), "utf8")).version;

const waitFor = async (browser, sid, expr, timeoutMs = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await browser.eval(sid, expr).catch(() => false)) return true;
    await sleep(150);
  }
  return false;
};

const startDevService = async () => {
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, "tools/dev_service.mjs"), String(port)], {
    cwd: ROOT,
    stdio: VERBOSE ? "inherit" : "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/ping`);
      if (r.ok) return { proc, url: `http://127.0.0.1:${port}` };
    } catch {
      /* aún arrancando */
    }
    await sleep(250);
  }
  proc.kill("SIGKILL");
  throw new Error("el servicio de desarrollo no respondió a /ping");
};

async function main() {
  const { server, port: httpPort } = await serve(APP_DIR);
  const dev = await startDevService().catch((e) => {
    console.error(`aviso: ${e.message} — se prueba con el catálogo empaquetado`);
    return null;
  });
  const chrome = await launchChromium({ width: 1920, height: 1080 });

  const rows = [];
  let failures = 0;
  try {
    for (const s of SCREENS) {
      const { sid, targetId } = await chrome.browser.newTvPage({ throttle: 1 });
      const errors = [];
      chrome.browser.on("Runtime.exceptionThrown", (p) => {
        errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "excepción");
      });

      const svc = dev ? `&service=${encodeURIComponent(dev.url)}` : "";
      await chrome.browser.goto(sid, `http://127.0.0.1:${httpPort}/index.html${s.q}${svc}`);

      const active = await waitFor(chrome.browser, sid, `!!document.querySelector('#screen-${s.name}.is-active')`);
      const inScreen = `document.querySelector('#screen-${s.name}')`;

      if (s.version) {
        const shown = await chrome.browser.eval(
          sid,
          `(document.querySelector('.welcome-version')||{}).textContent||''`
        );
        if (!String(shown).includes(APP_VER)) {
          errors.push(`la bienvenida muestra "${String(shown).trim()}" y la app es ${APP_VER}`);
        }
      }

      if (s.focus !== false) {
        await waitFor(chrome.browser, sid, `!!${inScreen} && ${inScreen}.querySelectorAll('.focusable').length > 0`, 8000);

        // Una flecha: el mando debe enfocar algo dentro de esta pantalla.
        await chrome.browser.eval(
          sid,
          `document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:39,which:39,key:'ArrowRight',bubbles:true,cancelable:true}))`
        );
        await sleep(250);
      }
      const info = await chrome.browser.eval(
        sid,
        `(() => { const s = ${inScreen}; return JSON.stringify({
           focusables: s ? s.querySelectorAll('.focusable').length : 0,
           focused: s ? s.querySelectorAll('.is-focused').length : 0
         }); })()`
      );
      const { focusables, focused } = JSON.parse(info);

      const ok =
        active &&
        errors.length === 0 &&
        (s.focus === false ? true : focusables > 0 && focused > 0);
      if (!ok) failures++;
      rows.push({ pantalla: s.name, activa: active, enfocables: focusables, conFoco: focused, errores: errors.length });
      if (errors.length && VERBOSE) console.error(`  ${s.name}: ${errors[0]}`);

      await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
    }
  } finally {
    chrome.close();
    if (dev) dev.proc.kill("SIGKILL");
    server.close();
  }

  console.log("\npantalla   activa  enfocables  con foco  excepciones");
  for (const r of rows) {
    console.log(
      `${r.pantalla.padEnd(10)} ${String(r.activa).padEnd(6)} ${String(r.enfocables).padEnd(11)} ${String(r.conFoco).padEnd(9)} ${r.errores}`
    );
  }
  console.log(`\n${rows.length - failures}/${rows.length} pantallas OK`);
  if (failures) {
    console.error("FALLA: alguna pantalla no quedó activa, sin foco o lanzó una excepción");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
