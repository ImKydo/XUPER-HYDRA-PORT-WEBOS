#!/usr/bin/env node
// tools/perf/measure.mjs — mide arranque, navegación con mando y memoria de la app.
//
// Sin dependencias: usa Chromium por CDP con WebSocket nativo (Node >= 22).
// Emula un televisor con --throttle (multiplicador de CPU) y viewport 1920x1080.
//
// Uso:
//   node tools/perf/measure.mjs                      # todas las escenas, CPU x4
//   node tools/perf/measure.mjs --throttle=1         # sin emulación de TV
//   node tools/perf/measure.mjs --out=docs/perf/baseline.json
//   node tools/perf/measure.mjs --url='?screen=detail&vod=1'
//
// Salida: JSON por stdout (y archivo si --out). Código de salida 0 siempre,
// salvo error de infraestructura: este script MIDE, no aprueba ni reprueba.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = path.join(ROOT, "webos/fidelity");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

const THROTTLE = Number(args.throttle || 4);
const OUT = args.out;
const URL_PATH = args.url || "?screen=home&tab=1";
const SCENES = String(args.scenes || "boot,focus,leak").split(",");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

/* ---------------- servidor estático ---------------- */
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      const abs = path.join(dir, rel);
      if (!abs.startsWith(dir)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      try {
        await readFile(abs);
      } catch {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(abs).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ---------------- cliente CDP mínimo ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}

class Browser {
  constructor(port) {
    this.port = port;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    let info = null;
    for (let i = 0; i < 60; i++) {
      try {
        info = await (await fetch(`http://127.0.0.1:${this.port}/json/version`)).json();
        break;
      } catch {
        await sleep(200);
      }
    }
    if (!info) throw new Error("Chromium no respondió en el puerto de depuración");

    this.ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", rej, { once: true });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
        return;
      }
      const list = this.events.get(msg.method) || [];
      for (const fn of list) fn(msg.params);
    });
    return info.Browser;
  }

  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }

  send(method, params = {}, sessionId) {
    return new Promise((res) => {
      const id = ++this.id;
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  async newPage() {
    const { result } = await this.send("Target.createTarget", { url: "about:blank" });
    const { result: att } = await this.send("Target.attachToTarget", {
      targetId: result.targetId,
      flatten: true,
    });
    return { sid: att.sessionId, targetId: result.targetId };
  }

  async eval(sid, expression) {
    const { result } = await this.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sid
    );
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }

  async goto(sid, url) {
    const loaded = new Promise((r) => this.on("Page.loadEventFired", r));
    await this.send("Page.navigate", { url }, sid);
    await Promise.race([loaded, sleep(15000)]);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

/* ---------------- escenas ---------------- */
const READ_NAV = `(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  const paint = performance.getEntriesByType('paint') || [];
  const fcp = (paint.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
  const res = performance.getEntriesByType('resource');
  const mm = performance.memory || {};
  return {
    dcl: Math.round(n.domContentLoadedEventEnd || 0),
    load: Math.round(n.loadEventEnd || 0),
    fcp: Math.round(fcp),
    domNodes: document.querySelectorAll('*').length,
    imgs: document.images.length,
    imgsLoaded: Array.from(document.images).filter(i => i.complete && i.naturalWidth > 0).length,
    heapMB: mm.usedJSHeapSize ? +(mm.usedJSHeapSize / 1048576).toFixed(1) : null,
    cssRules: Array.from(document.styleSheets).reduce((a, s) => { try { return a + s.cssRules.length } catch(e) { return a } }, 0),
    scriptKB: Math.round(res.filter(r => r.initiatorType === 'script').reduce((a, r) => a + (r.transferSize||0), 0) / 1024),
    posters: document.querySelectorAll('.poster').length,
    rails: document.querySelectorAll('.catalog-rail').length,
    screen: (document.querySelector('.screen.is-active')||{}).id || null
  };
})()`;

const FOCUS_PROBE = `(async () => {
  const fire = (code, key) => {
    const e = new KeyboardEvent('keydown', { keyCode: code, which: code, key, bubbles: true, cancelable: true });
    document.dispatchEvent(e);
  };
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  fire(39, 'ArrowRight'); await raf();
  const times = [];
  for (let i = 0; i < 24; i++) {
    const t0 = performance.now();
    fire(i % 2 === 0 ? 39 : 37, i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    document.body.offsetHeight;      // fuerza layout: incluye el coste real
    times.push(+(performance.now() - t0).toFixed(2));
    await raf();
  }
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  return JSON.stringify({
    moves: times.length,
    avgMs: +(sum / times.length).toFixed(2),
    medianMs: times[Math.floor(times.length / 2)],
    p95Ms: times[Math.floor(times.length * 0.95)],
    maxMs: times[times.length - 1],
    over33: times.filter(t => t > 33).length
  });
})()`;

const LEAK_PROBE = `(async () => {
  const fire = (code, key) => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, which: code, key, bubbles: true, cancelable: true }));
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  const before = heap();
  for (let i = 0; i < 120; i++) {
    fire(i % 2 === 0 ? 39 : 37, i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    await raf();
  }
  await new Promise(r => setTimeout(r, 1200));
  const after = heap();
  return JSON.stringify({
    heapBeforeMB: +(before / 1048576).toFixed(1),
    heapAfterMB: +(after / 1048576).toFixed(1),
    growthMB: +((after - before) / 1048576).toFixed(1),
    domNodes: document.querySelectorAll('*').length
  });
})()`;

/* ---------------- main ---------------- */
async function main() {
  const { server, port: httpPort } = await serve(APP_DIR);
  const base = `http://127.0.0.1:${httpPort}/index.html${URL_PATH}`;

  const debugPort = await freePort();
  const chrome = spawn(
    process.env.CHROMIUM || "chromium",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      `--remote-debugging-port=${debugPort}`,
      "--window-size=1920,1080",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const result = {
    generatedAt: new Date().toISOString(),
    target: { url: URL_PATH, throttle: THROTTLE, chromium: null },
    scenes: {},
  };

  const browser = new Browser(debugPort);
  try {
    result.target.chromium = await browser.connect();
    for (const scene of SCENES) {
      const { sid, targetId } = await browser.newPage();
      await browser.send("Page.enable", {}, sid);
      await browser.send("Runtime.enable", {}, sid);
      if (THROTTLE > 1) await browser.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE }, sid);
      await browser.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
        sid
      );

      // Debe registrarse antes de navegar: si no, la navegación lo borra.
      await browser.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source: `window.__lt = []; if (window.PerformanceObserver) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__lt.push(Math.round(e.duration)); }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {} }`,
        },
        sid
      );

      await browser.goto(sid, base);
      await sleep(THROTTLE >= 4 ? 5000 : 2500);

      const nav = await browser.eval(sid, READ_NAV);
      const settleMs = await sleepAndSettle(browser, sid);

      const sceneResult = { nav, settleMs };
      if (scene === "focus") sceneResult.focus = JSON.parse(await browser.eval(sid, FOCUS_PROBE));
      if (scene === "leak") sceneResult.leak = JSON.parse(await browser.eval(sid, LEAK_PROBE));
      sceneResult.longTasks = await browser.eval(sid, `JSON.stringify(window.__lt || [])`);

      result.scenes[scene] = sceneResult;
      await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    }
  } finally {
    browser.close();
    chrome.kill("SIGKILL");
    server.close();
  }

  const json = JSON.stringify(result, null, 2);
  console.log(json);
  if (OUT) {
    await mkdir(path.dirname(path.resolve(ROOT, OUT)), { recursive: true });
    await writeFile(path.resolve(ROOT, OUT), json + "\n");
    console.error(`\nGuardado en ${OUT}`);
  }
}

/** Espera a que el DOM se asiente (sin mutaciones durante 600 ms). */
async function sleepAndSettle(browser, sid) {
  const expr = `new Promise(r => {
    let t = null;
    const done = () => { obs.disconnect(); r(1); };
    const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 600); });
    obs.observe(document.body, { childList: true, subtree: true });
    t = setTimeout(done, 6000);
  })`;
  const t0 = Date.now();
  await browser.eval(sid, expr);
  return Date.now() - t0;
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
