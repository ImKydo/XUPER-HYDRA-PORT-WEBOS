#!/usr/bin/env node
// tools/serve.mjs — sirve webos/fidelity en local para probar la app en Chromium.
//
// `Cache-Control: no-store` es obligatorio: si el navegador cachea app.js
// mientras se edita, se depura el archivo anterior y se pierden horas.
//
// Uso:
//   node tools/serve.mjs            # http://127.0.0.1:8899
//   PORT=9000 node tools/serve.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../webos/fidelity");
const PORT = Number(process.env.PORT || 8899);

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

createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const abs = path.join(ROOT, rel);

  if (!abs.startsWith(ROOT)) {
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
}).listen(PORT, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${PORT}/index.html?screen=home`);
});
