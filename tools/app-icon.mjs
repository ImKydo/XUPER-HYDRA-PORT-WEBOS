#!/usr/bin/env node
// tools/app-icon.mjs — rasteriza el isotipo y el fondo del icono de app con
// Chromium (ImageMagick no entiende el feDropShadow del SVG).
//   node tools/app-icon.mjs              -> icono de lanzador, fondo oscuro
//   node tools/app-icon.mjs --transparent -> isotipo suelto, sin fondo
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launchChromium, sleep } from "./perf/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transparent = process.argv.includes("--transparent");
const svg = readFileSync(path.join(ROOT, "webos/fidelity/images/zephyr-mark.svg"), "utf8");
const sized = svg.replace('width="100%" height="100%"', `width="${transparent ? 392 : 400}" height="${transparent ? 392 : 400}"`);
const bg = transparent
  ? "transparent"
  : "linear-gradient(160deg, #0d1a26 0%, #05070d 72%)";

const html =
  `<!doctype html><html><body style="margin:0;background:${transparent ? "transparent" : "#05070d"}">` +
  `<div style="width:512px;height:512px;background:${bg};display:flex;align-items:center;justify-content:center">` +
  sized +
  `</div></body></html>`;

const { server } = await serve(path.join(ROOT, "webos/fidelity"));
const chrome = await launchChromium();
const { sid } = await chrome.browser.newTvPage({ throttle: 1, width: 512, height: 512 });
await chrome.browser.send(
  "Emulation.setDeviceMetricsOverride",
  { width: 512, height: 512, deviceScaleFactor: 1, mobile: false },
  sid
);
await chrome.browser.goto(sid, `data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
await sleep(1200);
const shot = await chrome.browser.send(
  "Page.captureScreenshot",
  { format: "png", clip: { x: 0, y: 0, width: 512, height: 512, scale: 1 }, omitBackground: transparent },
  sid
);
const out = path.join(ROOT, "webos/fidelity/images", transparent ? "zephyr-mark-512.png" : "zephyr-icon-large.png");
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
chrome.close();
server.close();
console.log(`${path.relative(ROOT, out)} 512x512${transparent ? " (sin fondo)" : " (fondo oscuro)"}`);
