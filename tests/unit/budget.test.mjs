// El presupuesto es el contrato de rendimiento: si una fase empeora el arranque
// o el foco, `node tools/perf/budget.mjs` debe fallar y decirlo con números.
import test from "node:test";
import assert from "node:assert/strict";
import { compareBudget } from "../../tools/perf/budget.mjs";

const BUDGET = {
  dcl_ms: 1600,
  fcp_ms: 800,
  dom_nodes: 1200,
  script_kb: 1400,
  focus_p95_ms: 40,
  leak_growth_mb: 8,
  long_task_ms: 3000,
};

const sample = (over = {}) => ({
  scenes: {
    boot: { nav: { dcl: 900, fcp: 300, domNodes: 700, scriptKB: 1000 }, longTasks: [180, 500], ...over.boot },
    focus: { nav: { dcl: 900, fcp: 300, domNodes: 700, scriptKB: 1000 }, longTasks: [], focus: { p95Ms: 12 }, ...over.focus },
    leak: { nav: { dcl: 900, fcp: 300, domNodes: 700, scriptKB: 1000 }, longTasks: [], leak: { growthMB: 0.6 }, ...over.leak },
  },
});

test("todo dentro del presupuesto pasa", () => {
  const r = compareBudget(sample(), BUDGET);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 7);
  assert.equal(r.overflow.length, 0);
});

test("un arranque lento falla y reporta la métrica", () => {
  const r = compareBudget(sample({ boot: { nav: { dcl: 2000, fcp: 300, domNodes: 700, scriptKB: 1000 } } }), BUDGET);
  assert.equal(r.ok, false);
  assert.deepEqual(r.overflow.map((x) => x.metric), ["dcl_ms"]);
  assert.equal(r.overflow[0].value, 2000);
});

test("usa el peor valor entre escenas, no el primero", () => {
  const r = compareBudget(sample({ leak: { nav: { dcl: 900, fcp: 999, domNodes: 700, scriptKB: 1000 } } }), BUDGET);
  assert.equal(r.ok, false);
  assert.equal(r.overflow[0].metric, "fcp_ms");
});

test("ignora métricas de escenas que no las midieron", () => {
  const m = { scenes: { boot: { nav: { dcl: 900 } } } };
  const r = compareBudget(m, BUDGET);
  assert.equal(r.ok, true);
  assert.equal(r.rows.filter((x) => x.value !== null).length, 1);
});

test("una tarea larga por encima del límite falla", () => {
  const r = compareBudget(sample({ boot: { longTasks: [4000] } }), BUDGET);
  assert.equal(r.ok, false);
  assert.equal(r.overflow[0].metric, "long_task_ms");
});

test("tolera mediciones antiguas con longTasks como texto", () => {
  const r = compareBudget(sample({ boot: { longTasks: "[900, 5000]" } }), BUDGET);
  assert.equal(r.ok, false);
  assert.equal(r.overflow[0].metric, "long_task_ms");
  assert.equal(r.overflow[0].value, 5000);
});
