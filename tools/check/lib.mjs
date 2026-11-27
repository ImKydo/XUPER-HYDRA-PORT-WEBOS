// tools/check/lib.mjs — utilidades compartidas por los verificadores.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const APP_FIDELITY = "webos/fidelity";
export const SVC_DIR = "webos/services/com.webosflux.xuptertv.fidelity.service";

export const SERVICE_FILES = [
  "index.js",
  "proxy.js",
  "magis.js",
  "dnsx.js",
  "ffmpeg-relay.js",
  "ts-indexer.js",
  "upstream.js",
  "netdiag.js",
  "updater.js",
  "tvplus.js",
  "moviezone.js",
  "devmode.js",
];

export function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

export function exists(rel) {
  try {
    return statSync(path.join(ROOT, rel)).isFile();
  } catch {
    return false;
  }
}

export function json(rel) {
  return JSON.parse(read(rel));
}

/** Modo de permiso del archivo (p. ej. 0o755), o -1 si no existe. */
export function mode(rel) {
  try {
    return statSync(path.join(ROOT, rel)).mode;
  } catch {
    return -1;
  }
}

/** Recorre un AST de acorn visitando cada nodo con su padre. */
export function walk(node, visit, parent = null, parentKey = null) {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent, parentKey);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, node, key);
    } else if (value && typeof value.type === "string") {
      walk(value, visit, node, key);
    }
  }
}

export function parse(source, rel) {
  try {
    return acorn.parse(source, { ecmaVersion: 5, locations: true, sourceType: "script" });
  } catch (err) {
    const where = err.loc ? ` en ${rel}:${err.loc.line}:${err.loc.column}` : ` en ${rel}`;
    throw new Error(`No parsea como ES5${where}: ${err.message}`);
  }
}

/** Lista los .js de un directorio (sin recursión). */
export function jsFiles(relDir) {
  const abs = path.join(ROOT, relDir);
  return readdirSync(abs)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.posix.join(relDir, f));
}

export function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === "\n") line++;
  return line;
}

/* ---------- mini framework de reporte ---------- */

export function checker(name) {
  const results = [];
  return {
    ok(id, desc, detail = "") {
      results.push({ id, desc, ok: true, detail });
    },
    fail(id, desc, detail = "") {
      results.push({ id, desc, ok: false, detail });
    },
    warn(id, desc, detail = "") {
      results.push({ id, desc, ok: true, warn: true, detail });
    },
    assert(id, desc, condition, detail = "") {
      condition ? this.ok(id, desc, detail) : this.fail(id, desc, detail);
      return !!condition;
    },
    report() {
      const pad = (s, n) => (s.length >= n ? s : s + " ".repeat(n - s.length));
      for (const r of results) {
        console.log(`${r.warn ? "WARN" : r.ok ? "PASS" : "FAIL"}  ${pad(r.id, 30)} ${r.desc}`);
        if (r.detail) console.log(`      ${r.detail}`);
      }
      const failed = results.filter((r) => !r.ok);
      const warned = results.filter((r) => r.warn);
      console.log(
        `\n${name}: ${results.length - failed.length}/${results.length} OK` +
          (warned.length ? ` (${warned.length} avisos)` : "") +
          (failed.length ? ` — ${failed.length} FALLAN` : "")
      );
      return failed.length === 0 ? 0 : 1;
    },
  };
}
