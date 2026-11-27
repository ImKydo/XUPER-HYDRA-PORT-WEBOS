#!/usr/bin/env node
// tools/build-ipk.mjs — empaqueta el IPK en Linux/macOS, sin PowerShell.
//
// Receta verificada contra el IPK v3.1.86 publicado:
//   1. node tools/build.mjs --write      (app.js legible desde src/)
//   2. ares-package <app> <service> -o dist -e "*.md"
//   3. python3 tools/fix_ipk_modes.py <ipk>   (bit 0755 de ffmpeg)
//
// IMPORTANTE: ares-package YA minifica (usa terser por dentro). Comprobado:
// empaquetar el app.js legible de 501.782 B produce exactamente el mismo
// sha256 que el app.js del IPK oficial (95663359...). Por eso aquí NO se
// pre-minifica: hacerlo produce una doble minificación distinta (263.786 B
// frente a 263.885 B). El flag --pre-minify queda solo para depurar.
//
// No toca el árbol de trabajo: copia a dist/stage y empaqueta desde ahí.
//
// Uso:
//   node tools/build-ipk.mjs
//   node tools/build-ipk.mjs --pre-minify     (solo para comparar)
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = "webos/fidelity";
const SVC = "webos/services/com.webosflux.xuptertv.fidelity.service";
const STAGE = path.join(ROOT, "dist/stage");
const OUT = path.join(ROOT, "dist");
const PRE_MINIFY = process.argv.includes("--pre-minify");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });

const step = (msg) => console.log(`\n== ${msg}`);

/* ---------- 1. artefacto desde src/ ---------- */
step("1/5 generar app.js desde src/");
run("node", ["tools/build.mjs", "--write"]);

/* ---------- 2. staging ---------- */
step("2/5 preparar staging");
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(path.join(STAGE, "app"), { recursive: true });
mkdirSync(path.join(STAGE, "service"), { recursive: true });
cpSync(path.join(ROOT, APP), path.join(STAGE, "app"), { recursive: true });
cpSync(path.join(ROOT, SVC), path.join(STAGE, "service"), { recursive: true });

/* ---------- 3. minificado ---------- */
if (PRE_MINIFY) {
  step("3/5 minificar a mano (--pre-minify): NO usar para releases");
  const terser = (file) => run("npx", ["terser", file, "-c", "-m", "-o", file]);
  terser(path.join(STAGE, "app/js/app.js"));
  const svcDir = path.join(STAGE, "service");
  for (const f of readdirSync(svcDir).filter((f) => f.endsWith(".js"))) {
    terser(path.join(svcDir, f));
  }
} else {
  step("3/5 minificado: lo hace ares-package");
}

/* ---------- 4. empaquetar ---------- */
step("4/5 empaquetar con ares-package");
const version = JSON.parse(readFileSync(path.join(ROOT, APP, "appinfo.json"), "utf8")).version;
run("ares-package", [
  path.join(STAGE, "app"),
  path.join(STAGE, "service"),
  "-o",
  OUT,
  "-e",
  "*.md",
]);

const ipk = path.join(OUT, `com.webosflux.xuptertv.fidelity_${version}_all.ipk`);
if (!existsSync(ipk)) {
  console.error(`\nERROR: ares-package no generó ${ipk}`);
  process.exit(1);
}

/* ---------- 5. permisos y hash ---------- */
step("5/5 restaurar 0755 de ffmpeg y calcular sha256");
run("python3", ["tools/fix_ipk_modes.py", ipk]);

const buf = readFileSync(ipk);
const sha = createHash("sha256").update(buf).digest("hex");
console.log(`\nIPK:    ${path.relative(ROOT, ipk)}`);
console.log(`Bytes:  ${statSync(ipk).size}`);
console.log(`SHA256: ${sha}`);
console.log(`\nSiguiente: node tools/check/ipk-diff.mjs ${path.relative(ROOT, ipk)} <ipk-de-referencia>`);
