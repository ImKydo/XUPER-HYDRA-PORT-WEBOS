#!/usr/bin/env node
// tools/perf/budget.mjs — compara una medición con el presupuesto de rendimiento.
//
// La medición la produce tools/perf/measure.mjs. Los umbrales viven en
// docs/perf/budget.json para poder ajustarlos sin tocar código.
//
// Uso:
//   node tools/perf/budget.mjs                        # latest vs budget
//   node tools/perf/budget.mjs docs/perf/baseline.json
//   node tools/perf/budget.mjs medicion.json presupuesto.json
//
// Sale con 1 si algo se pasa del presupuesto.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Máximo de `pick(scene)` entre todas las escenas; null si ninguna lo mide. */
const worst = (scenes, pick) => {
  let max = null;
  for (const s of Object.values(scenes || {})) {
    const v = pick(s);
    if (typeof v === "number" && Number.isFinite(v) && (max === null || v > max)) max = v;
  }
  return max;
};

export function compareBudget(measurements, budget) {
  const scenes = (measurements && measurements.scenes) || {};

  const defs = [
    { metric: "dcl_ms", limit: budget.dcl_ms, pick: (s) => s.nav && s.nav.dcl },
    { metric: "fcp_ms", limit: budget.fcp_ms, pick: (s) => s.nav && s.nav.fcp },
    { metric: "dom_nodes", limit: budget.dom_nodes, pick: (s) => s.nav && s.nav.domNodes },
    { metric: "script_kb", limit: budget.script_kb, pick: (s) => s.nav && s.nav.scriptKB },
    { metric: "focus_p95_ms", limit: budget.focus_p95_ms, pick: (s) => s.focus && s.focus.p95Ms },
    { metric: "leak_growth_mb", limit: budget.leak_growth_mb, pick: (s) => s.leak && s.leak.growthMB },
    {
      metric: "long_task_ms",
      limit: budget.long_task_ms,
      pick: (s) => {
        // Las mediciones antiguas guardaban la lista como texto JSON.
        let list = s.longTasks;
        if (typeof list === "string") {
          try {
            list = JSON.parse(list);
          } catch {
            list = [];
          }
        }
        return Array.isArray(list) && list.length ? Math.max(...list.map(Number)) : undefined;
      },
    },
  ];

  const rows = defs.map((d) => {
    const value = worst(scenes, d.pick);
    return {
      metric: d.metric,
      value,
      limit: d.limit,
      ok: value === null || typeof d.limit !== "number" ? true : value <= d.limit,
    };
  });

  return { ok: rows.every((r) => r.ok), rows, overflow: rows.filter((r) => !r.ok) };
}

/* ------------------------------- CLI ------------------------------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const [measureArg, budgetArg] = process.argv.slice(2);
  const measurePath = path.resolve(ROOT, measureArg || "docs/perf/latest.json");
  const budgetPath = path.resolve(ROOT, budgetArg || "docs/perf/budget.json");

  for (const [p, what] of [
    [measurePath, "medición"],
    [budgetPath, "presupuesto"],
  ]) {
    if (!existsSync(p)) {
      console.error(`falta el archivo de ${what}: ${p}`);
      console.error("genera la medición con: node tools/perf/measure.mjs --throttle=4 --out=docs/perf/latest.json");
      process.exit(2);
    }
  }

  const measurements = JSON.parse(readFileSync(measurePath, "utf8"));
  const { budget } = JSON.parse(readFileSync(budgetPath, "utf8"));
  const result = compareBudget(measurements, budget);

  console.log(`medición: ${path.relative(ROOT, measurePath)}\n`);
  console.log("métrica            valor    límite   veredicto");
  for (const r of result.rows) {
    const value = r.value === null ? "—" : String(r.value);
    console.log(`${r.metric.padEnd(18)} ${value.padEnd(8)} ${String(r.limit).padEnd(8)} ${r.ok ? "OK" : "EXCEDE"}`);
  }

  if (!result.ok) {
    console.error(
      `\nFALLA: ${result.overflow.length} métrica(s) fuera de presupuesto: ` +
        result.overflow.map((r) => `${r.metric} ${r.value} > ${r.limit}`).join(", ")
    );
    process.exit(1);
  }
  console.log("\nPresupuesto OK");
}
