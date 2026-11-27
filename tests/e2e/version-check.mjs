#!/usr/bin/env node
// tests/e2e/version-check.mjs — Diagnóstico comparaba `v3.1.86` con `3.1.86` y
// marcaba "SERVICIO DESACTUALIZADO" para siempre (issue #22).
//
// Dos escenarios, porque silenciar el aviso siempre sería peor que el bug:
//   1. servicio v3.1.86  -> NO debe avisar
//   2. servicio v3.0.0   -> SÍ debe avisar (la app es 3.1.86)
//
// Uso: node tests/e2e/version-check.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, freePort, sleep } from "../../tools/perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = path.join(ROOT, "webos/fidelity");

const waitFor = async (browser, sid, expr, timeoutMs = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await browser.eval(sid, expr).catch(() => false)) return true;
    await sleep(200);
  }
  return false;
};

const startService = async (version) => {
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, "tools/dev_service.mjs"), String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, SERVICE_VERSION: version },
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/ping`)).ok) break;
    } catch {
      /* arrancando */
    }
    await sleep(250);
  }
  return { proc, port };
};

async function main() {
  const { server, port } = await serve(APP_DIR);
  const chrome = await launchChromium({ width: 1920, height: 1080 });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
    if (!ok) failures++;
  };

  const medir = async (version) => {
    const svc = await startService(version);
    const { sid, targetId } = await chrome.browser.newTvPage({ throttle: 1 });
    try {
      await chrome.browser.goto(
        sid,
        `http://127.0.0.1:${port}/index.html?screen=settings&panel=7&service=${encodeURIComponent(
          `http://127.0.0.1:${svc.port}`
        )}`
      );
      await waitFor(
        chrome.browser,
        sid,
        `!!document.querySelector('.dg-env') && document.querySelector('.dg-env').textContent.length > 0`
      );
      // textContent y no innerText: el panel no siempre está visible y los
      // elementos ocultos no aparecen en innerText.
      return await chrome.browser.eval(
        sid,
        `(document.querySelector('.dg-env') || {}).textContent || ""`
      );
    } finally {
      await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
      svc.proc.kill("SIGKILL");
    }
  };

  try {
    const igual = await medir("v3.1.86");
    check(!/DESACTUALIZADO/i.test(igual), 'misma versión con prefijo "v": no avisa');
    check(/versión\s+v?3\.1\.86/i.test(igual), "muestra la versión del servicio");

    const distinta = await medir("v3.0.0");
    check(/DESACTUALIZADO/i.test(distinta), "versión distinta de verdad: sí avisa");
  } finally {
    chrome.close();
    server.close();
  }

  if (failures) {
    console.error(`\n${failures} comprobación(es) fallaron`);
    process.exit(1);
  }
  console.log("\nversion-check OK");
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
