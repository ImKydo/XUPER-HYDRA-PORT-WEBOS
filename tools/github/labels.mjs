#!/usr/bin/env node
// tools/github/labels.mjs — crea las etiquetas del proyecto en un repositorio.
//
// Necesita permiso de escritura (push) sobre el repo. Con `cristianco7/...`
// devuelve 403: requiere fork propio o acceso del mantenedor.
//
// Uso:
//   node tools/github/labels.mjs --repo=<owner/repo> [--dry-run]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoArg = (process.argv.find((a) => a.startsWith("--repo=")) || "").split("=")[1];
const dry = process.argv.includes("--dry-run");

if (!repoArg) {
  console.error("uso: node tools/github/labels.mjs --repo=owner/name [--dry-run]");
  process.exit(2);
}

const { labels } = JSON.parse(readFileSync(path.join(ROOT, ".github/labels.json"), "utf8"));

let created = 0;
let existing = 0;
let failed = 0;
for (const l of labels) {
  const args = ["label", "create", l.name, "-R", repoArg, "--color", l.color, "--description", l.description];
  if (dry) {
    console.log("[dry-run]", "gh", args.join(" "));
    continue;
  }
  try {
    execFileSync("gh", args, { stdio: "pipe" });
    created++;
  } catch (e) {
    const msg = String((e.stderr && e.stderr.toString()) || e.message);
    if (/already exists|already been taken/i.test(msg)) {
      existing++;
    } else {
      failed++;
      console.error(`  ${l.name}: ${msg.split("\n")[0]}`);
    }
  }
}

if (!dry) {
  console.log(`etiquetas: ${created} creadas, ${existing} ya existían, ${failed} fallaron (${repoArg})`);
  if (failed) {
    console.error("\nSin permiso de escritura no se pueden crear etiquetas: usa un fork o pide acceso.");
    process.exit(1);
  }
}
