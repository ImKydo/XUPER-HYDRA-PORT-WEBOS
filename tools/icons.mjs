#!/usr/bin/env node
// tools/icons.mjs — vendoriza iconos de Lucide (ISC) y genera el módulo ES5.
//   node tools/icons.mjs --fetch   (una vez, necesita red)
//   node tools/icons.mjs --build   (siempre; sin red)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src/assets/icons");
const OUT = path.join(ROOT, "src/generated/icons.js");
const VERSION = "0.544.0";
const NAMES = ["house", "tv", "clapperboard", "layers", "layout-grid", "search", "user", "settings"];
const ATTRS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

async function fetchAll() {
  mkdirSync(SRC, { recursive: true });
  for (const n of NAMES) {
    const url = `https://unpkg.com/lucide-static@${VERSION}/icons/${n}.svg`;
    // curl en vez de fetch: el fetch de Node no respeta el proxy del sistema.
    writeFileSync(
      path.join(SRC, `${n}.svg`),
      execFileSync("curl", ["-sS", "--max-time", "25", url], { encoding: "utf8" }).trimEnd() + "\n"
    );
    console.log(`bajado ${n}.svg`);
  }
  writeFileSync(
    path.join(SRC, "LICENSE"),
    `Iconos: Lucide v${VERSION} (https://lucide.dev) — licencia ISC.\n` +
      "Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).\n"
  );
}

function build() {
  mkdirSync(path.dirname(OUT), { recursive: true });
  const out = NAMES.map((n) => {
    const file = path.join(SRC, `${n}.svg`);
    if (!existsSync(file)) throw new Error(`falta ${file}: corre --fetch`);
    const raw = readFileSync(file, "utf8");
    const inner = raw
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>[\s\S]*$/, "")
      .trim();
    return `    ${JSON.stringify(n)}: ${JSON.stringify(`<svg ${ATTRS}>${inner}</svg>`)}`;
  });
  writeFileSync(
    OUT,
    `/* GENERADO por tools/icons.mjs — no editar a mano.\n   Lucide v${VERSION} (ISC). Ver src/assets/icons/LICENSE. */\n` +
      `;(function () {\n  "use strict";\n  window.ZEPHYR_ICONS = {\n${out.join(",\n")}\n  };\n})();\n`
  );
  console.log(`icons: ${NAMES.length} iconos -> src/generated/icons.js`);
}

if (process.argv.includes("--fetch")) await fetchAll();
build();
