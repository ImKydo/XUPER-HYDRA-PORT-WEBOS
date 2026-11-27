// tools/perf/cdp.mjs — servidor estático, lanzador de Chromium y cliente CDP.
//
// Extraído de measure.mjs para que el smoke E2E use exactamente el mismo
// transporte (sin dependencias: WebSocket nativo de Node >= 22).
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

export const MIME = {
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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sirve `dir` en un puerto efímero. Devuelve { server, port }. */
export function serve(dir) {
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

export async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}

export class Browser {
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

  /** Crea una pestaña ya configurada como televisor (viewport + CPU). */
  async newTvPage({ width = 1920, height = 1080, throttle = 1 } = {}) {
    const page = await this.newPage();
    await this.send("Page.enable", {}, page.sid);
    await this.send("Runtime.enable", {}, page.sid);
    if (throttle > 1) {
      await this.send("Emulation.setCPUThrottlingRate", { rate: throttle }, page.sid);
    }
    await this.send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: false },
      page.sid
    );
    return page;
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

/** Lanza Chromium headless y devuelve { browser, proc, close }. */
export async function launchChromium({ width = 1920, height = 1080 } = {}) {
  const debugPort = await freePort();
  const proc = spawn(
    process.env.CHROMIUM || "chromium",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      `--remote-debugging-port=${debugPort}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const browser = new Browser(debugPort);
  const product = await browser.connect();
  return {
    browser,
    proc,
    product,
    close() {
      browser.close();
      try {
        proc.kill("SIGKILL");
      } catch {}
    },
  };
}
