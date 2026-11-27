#!/usr/bin/env node
// tools/shots.mjs — captura las pantallas de la app para revisar la UI.
//
// Sirve para comparar antes/después de un cambio visual y para revisar que una
// pantalla no se rompió. Escribe PNG de 1920x1080 en docs/screenshots/.
//
// Uso:
//   node tools/shots.mjs                        # todas, sin servicio (catálogo empaquetado)
//   node tools/shots.mjs --service              # levanta dev_service y usa datos reales
//   node tools/shots.mjs --only=home,detail
//   node tools/shots.mjs --prefix=antes
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, freePort, sleep } from "./perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(ROOT, "webos/fidelity");
const OUT = path.join(ROOT, "docs/screenshots");

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const PREFIX = arg("prefix") || "shot";
const ONLY = (arg("only") || "").split(",").filter(Boolean);
const USE_SERVICE = process.argv.includes("--service");

const SCREENS = [
  { name: "welcome", q: "?screen=welcome", wait: 2500 },
  { name: "tv", q: "?screen=home&tab=0", wait: 5000 },
  { name: "home", q: "?screen=home&tab=1", wait: 5000 },
  { name: "pelicula", q: "?screen=home&tab=2", wait: 5000 },
  { name: "detail", q: "?screen=detail&vod=3", wait: 5000 },
  { name: "search", q: "?screen=search&q=dragon", wait: 4000 },
  { name: "settings", q: "?screen=settings", wait: 3500 },
  { name: "settings-diag", q: "?screen=settings&panel=7", wait: 6000 },
  { name: "player", q: "?screen=player&channels=1", wait: 5000 },
];

const list = ONLY.length ? SCREENS.filter((s) => ONLY.includes(s.name)) : SCREENS;

const startService = async () => {
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, "tools/dev_service.mjs"), String(port)], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/ping`)).ok) return { proc, url: `http://127.0.0.1:${port}` };
    } catch {
      /* arrancando */
    }
    await sleep(250);
  }
  proc.kill("SIGKILL");
  return null;
};

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const dev = USE_SERVICE ? await startService() : null;
  const { server, port } = await serve(APP_DIR);
  const chrome = await launchChromium({ width: 1920, height: 1080 });
  try {
    for (const s of list) {
      const { sid, targetId } = await chrome.browser.newTvPage({ throttle: 1 });
      const svc = dev ? `&service=${encodeURIComponent(dev.url)}` : "";
      await chrome.browser.goto(sid, `http://127.0.0.1:${port}/index.html${s.q}${svc}`);
      await sleep(s.wait);
      const shot = await chrome.browser.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        sid
      );
      const file = path.join(OUT, `${PREFIX}-${s.name}.png`);
      writeFileSync(file, Buffer.from(shot.result.data, "base64"));
      console.log(`${path.relative(ROOT, file)}`);
      await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
    }
  } finally {
    chrome.close();
    server.close();
    if (dev) dev.proc.kill("SIGKILL");
  }
};

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
