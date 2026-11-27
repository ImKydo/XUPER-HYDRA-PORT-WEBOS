#!/usr/bin/env node
// tests/e2e/img-fallback.mjs — con el CDN de imágenes caído, las tarjetas
// quedaban negras: la app ocultaba la imagen al fallar (complete: true,
// naturalWidth: 0). Ahora debe pintar un placeholder.
//
// Se bloquean las imágenes del catálogo empaquetado y se comprueba que los
// pósters acaban apuntando al placeholder y siguen visibles.
//
// Uso: node tests/e2e/img-fallback.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = path.join(ROOT, "webos/fidelity");

const waitFor = async (browser, sid, expr, timeoutMs = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await browser.eval(sid, expr).catch(() => false)) return true;
    await sleep(200);
  }
  return false;
};

async function main() {
  const { server, port } = await serve(APP_DIR);
  const chrome = await launchChromium({ width: 1920, height: 1080 });
  const { sid, targetId } = await chrome.browser.newTvPage({ throttle: 1 });

  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
    if (!ok) failures++;
  };

  try {
    // El placeholder debe seguir cargando: solo se bloquea el catálogo.
    await chrome.browser.send("Network.enable", {}, sid);
    await chrome.browser.send(
      "Network.setBlockedURLs",
      { urls: ["*assets/catalog/*", "*9np35rfp*", "*.jpg", "*.jpeg"] },
      sid
    );

    await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html?screen=home&tab=0`);
    await waitFor(chrome.browser, sid, `document.querySelectorAll('.poster img[data-poster-src]').length > 0`);

    // La carga es diferida y depende del foco real del mando, así que aquí se
    // asigna el src a mano: lo que se prueba es el manejador de error, no el
    // cargador (eso lo cubre el smoke).
    await chrome.browser.eval(
      sid,
      `Array.prototype.forEach.call(document.querySelectorAll('.poster img[data-poster-src]'), function (i) {
         i.src = i.getAttribute('data-poster-src');
       })`
    );
    await sleep(1200);

    const info = await chrome.browser.eval(
      sid,
      `(() => {
        const imgs = Array.prototype.slice.call(document.querySelectorAll('.poster img'));
        const conSrc = imgs.filter(i => i.getAttribute('src'));
        const placeholder = conSrc.filter(i => (i.getAttribute('src') || '').indexOf('placeholder.png') >= 0);
        const ocultas = imgs.filter(i => i.style.display === 'none');
        return JSON.stringify({
          total: imgs.length,
          conSrc: conSrc.length,
          placeholder: placeholder.length,
          ocultas: ocultas.length
        });
      })()`
    );
    const r = JSON.parse(info);
    console.log(`pósters: ${r.total}, con src: ${r.conSrc}, placeholder: ${r.placeholder}, ocultas: ${r.ocultas}`);

    check(r.conSrc > 0, "alguna imagen llegó a intentar cargar");
    check(r.placeholder === r.conSrc, "todas las imágenes fallidas acabaron en el placeholder");
    check(r.ocultas === 0, "ninguna imagen se oculta (antes quedaba el hueco negro)");

    const status = await chrome.browser.eval(
      sid,
      `fetch('assets/img/placeholder.png').then(r => r.status)`
    );
    check(status === 200, "el placeholder existe y se sirve (HTTP 200)");
  } finally {
    await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
    chrome.close();
    server.close();
  }

  if (failures) {
    console.error(`\n${failures} comprobación(es) fallaron`);
    process.exit(1);
  }
  console.log("\nimg-fallback OK");
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
