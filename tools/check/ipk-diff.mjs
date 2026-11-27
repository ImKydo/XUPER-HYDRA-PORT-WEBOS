#!/usr/bin/env node
// tools/check/ipk-diff.mjs — compara el contenido de dos IPK.
//
// No compara bytes del .ipk (el tar cambia por fecha, orden y CRLF del build
// original en Windows). Compara lo que importa:
//   - lista de archivos
//   - sha256 de cada archivo, normalizando CRLF
//   - modo del binario ffmpeg
//
// Uso:
//   node tools/check/ipk-diff.mjs dist/mi.ipk /tmp/referencia.ipk
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
if (!a || !b) {
  console.error("uso: node tools/check/ipk-diff.mjs <ipk-nuevo> <ipk-referencia> [--allow=<ruta>]...");
  process.exit(2);
}
// Diferencias esperadas y deliberadas (p. ej. el ?v= corregido en index.html).
const allowed = new Set(
  process.argv
    .filter((x) => x.startsWith("--allow="))
    .map((x) => x.slice("--allow=".length))
);

/** Extrae un IPK y devuelve Map<rutaRelativa, {sha, mode}>. */
function extract(ipk) {
  const dir = mkdtempSync(path.join(tmpdir(), "ipkdiff-"));
  execFileSync("ar", ["x", path.resolve(ipk)], { cwd: dir, stdio: "pipe" });
  const data = path.join(dir, "data.tar.gz");
  if (!existsSync(data)) throw new Error(`sin data.tar.gz en ${ipk}`);
  execFileSync("tar", ["xzf", data, "-C", dir], { stdio: "pipe" });

  // Miembros del contenedor ar: no son parte del árbol de la app.
  const CONTAINER = new Set(["debian-binary", "control.tar.gz", "data.tar.gz"]);

  const files = new Map();
  const walk = (base, rel) => {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const abs = path.join(base, entry.name);
      const r = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walk(abs, r);
      else if (entry.isFile()) {
        if (!rel && CONTAINER.has(entry.name)) continue;
        const raw = readFileSync(abs);
        // Normaliza CRLF: el build original era Windows y el nuestro no.
        const norm = Buffer.from(raw.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
        files.set(r, {
          sha: createHash("sha256").update(norm).digest("hex"),
          mode: statSync(abs).mode & 0o777,
          bytes: raw.length,
        });
      }
    }
  };
  walk(dir, "");
  return files;
}

const A = extract(a);
const B = extract(b);

const onlyA = [...A.keys()].filter((k) => !B.has(k) && !allowed.has(k)).sort();
const onlyB = [...B.keys()].filter((k) => !A.has(k) && !allowed.has(k)).sort();
const expected = [...A.keys()].filter((k) => allowed.has(k) && (!B.has(k) || A.get(k).sha !== B.get(k).sha)).sort();
const different = [...A.keys()]
  .filter((k) => B.has(k) && A.get(k).sha !== B.get(k).sha && !allowed.has(k))
  .sort();

const show = (label, list) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const f of list.slice(0, 20)) console.log(`  ${f}`);
  if (list.length > 20) console.log(`  … y ${list.length - 20} más`);
};

console.log(`nuevo:       ${a}  (${A.size} archivos)`);
console.log(`referencia:  ${b}  (${B.size} archivos)`);
show("Solo en el build nuevo", onlyA);
show("Solo en la referencia", onlyB);
show("Contenido distinto (normalizado CRLF)", different);
show("Diferencias esperadas y aceptadas", expected);

// ffmpeg debe ser ejecutable en ambos
const ffmpeg = [...A.keys()].find((k) => k.endsWith("/ffmpeg"));
if (ffmpeg) {
  const modeA = A.get(ffmpeg).mode;
  const modeB = B.has(ffmpeg) ? B.get(ffmpeg).mode : null;
  console.log(`\nffmpeg: modo nuevo ${modeA.toString(8)}${modeB !== null ? `, referencia ${modeB.toString(8)}` : ""}`);
  if ((modeA & 0o111) === 0) {
    console.error("FALLA: ffmpeg no es ejecutable en el build nuevo");
    process.exit(1);
  }
}

const ok = onlyA.length === 0 && onlyB.length === 0 && different.length === 0;
console.log(ok ? "\nPARIDAD OK: mismo árbol de archivos y mismo contenido" : "\nDIFERENCIAS: revisar la lista de arriba");
process.exit(ok ? 0 : 1);
