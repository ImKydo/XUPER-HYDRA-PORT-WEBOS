#!/usr/bin/env node
// tests/e2e/dual-bus.mjs — webOS 3 rechaza `luna://` para el servicio del
// propio paquete (issue #22). La app debe reintentar por `palm://` antes de
// caer al HTTP local.
//
// Se prueba en Chromium con un puente simulado porque `serviceCall` vive dentro
// del IIFE del bundle: no se puede importar desde un test unitario.
//
// Uso: node tests/e2e/dual-bus.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = path.join(ROOT, "webos/fidelity");
const TITULO = "Prueba Dual Bus";

// Se inyecta antes de app.js. `js/webOSTV.js` construye su propia capa sobre
// `PalmServiceBridge`, así que se emula ese objeto y no `window.webOS`.
// luna:// siempre falla con "denied"; palm:// responde. Todas las llamadas
// quedan registradas en window.__busCalls.
const BRIDGE = `
window.__busCalls = [];
window.PalmServiceBridge = function () {
  var self = this;
  self.call = function (url, params) {
    window.__busCalls.push(url);
    var reply;
    if (url.indexOf("palm://") === 0) {
      reply = url.indexOf("/home") >= 0
        ? { returnValue: true, root: "movies", pageNum: 1,
            items: [{ id: "DUALBUS1", title: ${JSON.stringify(TITULO)}, category: "pelicula" }] }
        : { returnValue: true };
    } else {
      reply = { returnValue: false, errorText: "denied", errorCode: -1 };
    }
    setTimeout(function () { self.onservicecallback(JSON.stringify(reply)); }, 0);
  };
};
`;

const waitFor = async (browser, sid, expr, timeoutMs = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await browser.eval(sid, expr).catch(() => false)) return true;
    await sleep(150);
  }
  return false;
};

async function main() {
  const { server, port } = await serve(APP_DIR);
  const chrome = await launchChromium({ width: 1920, height: 1080 });
  const { sid, targetId } = await chrome.browser.newTvPage({ throttle: 1 });

  let failures = 0;
  try {
    await chrome.browser.send("Page.addScriptToEvaluateOnNewDocument", { source: BRIDGE }, sid);
    await chrome.browser.goto(
      sid,
      `http://127.0.0.1:${port}/index.html?screen=home&tab=0`
    );

    const sawPalm = await waitFor(
      chrome.browser,
      sid,
      `(window.__busCalls || []).some(function (u) { return u.indexOf("palm://") === 0; })`,
      8000
    );
    const rendered = await waitFor(
      chrome.browser,
      sid,
      // El título vive en un atributo del póster, no en innerText.
      `(document.body.innerHTML || "").indexOf(${JSON.stringify(TITULO)}) >= 0`,
      8000
    );

    const calls = await chrome.browser.eval(sid, `JSON.stringify(window.__busCalls || [])`);

    const check = (ok, msg) => {
      console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
      if (!ok) failures++;
    };
    check(sawPalm, "la app reintenta por palm:// cuando luna:// responde denied");
    check(rendered, `el catálogo devuelto por palm:// llega a la pantalla ("${TITULO}")`);
    console.log(`\nllamadas: ${calls}`);
  } finally {
    await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
    chrome.close();
    server.close();
  }

  if (failures) {
    console.error(`\n${failures} comprobación(es) fallaron`);
    process.exit(1);
  }
  console.log("\ndual-bus OK");
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
