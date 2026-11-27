#!/usr/bin/env node
// tools/progress.mjs — trazabilidad del plan: qué está hecho, con qué commit y
// con qué evidencia.
//
// La fuente de verdad es el plan (.hermes/plans/*.md): `--sync` importa las
// tareas que falten sin pisar el estado de las existentes. `--check` verifica
// que cada tarea marcada como hecha apunte a un commit que EXISTE en el repo,
// así el tablero no se puede "adornar" a mano.
//
// Uso:
//   node tools/progress.mjs --sync
//   node tools/progress.mjs --set T0.1 --status=done --commit=abc1234 --evidence="..."
//   node tools/progress.mjs --render
//   node tools/progress.mjs --next
//   node tools/progress.mjs --check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = path.join(ROOT, "docs/progress/progress.json");
const OUT = path.join(ROOT, "PROGRESS.md");
const PLAN = ".hermes/plans/2026-11-26_224922-xupertv-v2-reconstruccion-verificada.md";

const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  const eq = hit.indexOf("=");
  return eq < 0 ? true : hit.slice(eq + 1);
};

const STATUSES = ["pending", "doing", "done", "blocked", "dropped"];
const ICON = { pending: "·", doing: "▸", done: "✔", blocked: "✖", dropped: "—" };

/* ---------- estado ---------- */
function load() {
  if (!existsSync(STATE)) return { plan: PLAN, updatedAt: null, tasks: [] };
  return JSON.parse(readFileSync(STATE, "utf8"));
}
function save(state) {
  mkdirSync(path.dirname(STATE), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
}

/* ---------- importar tareas del plan ---------- */
function parsePlan() {
  const file = path.join(ROOT, PLAN);
  if (!existsSync(file)) {
    console.error(`progress: no encuentro el plan en ${PLAN}`);
    process.exit(2);
  }
  const lines = readFileSync(file, "utf8").split("\n");
  const tasks = [];
  let phase = null;
  let phaseTitle = null;
  for (const line of lines) {
    const p = /^### FASE (\d+) — (.+)$/.exec(line);
    if (p) {
      phase = `F${p[1]}`;
      phaseTitle = p[2].replace(/\s*\(\d.*\)\s*$/, "").trim();
      continue;
    }
    const t = /^#### (T\d+\.\d+) — (.+)$/.exec(line);
    if (t) {
      tasks.push({ id: t[1], phase, title: t[2].trim(), status: "pending", commit: null, evidence: "", date: null });
    }
  }
  return { tasks, phases: [...new Set(tasks.map((t) => t.phase))] };
}

/* ---------- comandos ---------- */
function cmdSync() {
  const state = load();
  const { tasks } = parsePlan();
  const known = new Set(state.tasks.map((t) => t.id));
  let added = 0;
  for (const t of tasks) {
    if (!known.has(t.id)) {
      state.tasks.push(t);
      added++;
    }
  }
  // conservar el orden del plan
  const order = new Map(tasks.map((t, i) => [t.id, i]));
  state.tasks.sort((a, b) => (order.get(a.id) ?? 9e9) - (order.get(b.id) ?? 9e9));
  state.plan = PLAN;
  save(state);
  console.log(`sync: ${tasks.length} tareas en el plan, ${added} nuevas, ${state.tasks.length} en el registro`);
}

function cmdSet() {
  const id = argv.find((a) => /^T\d+\.\d+$/.test(a));
  const status = flag("status");
  if (!id || !status) {
    console.error("uso: --set T0.1 --status=done [--commit=abc1234] [--evidence=\"...\"]");
    process.exit(2);
  }
  if (!STATUSES.includes(status)) {
    console.error(`estado inválido: ${status} (válidos: ${STATUSES.join(", ")})`);
    process.exit(2);
  }
  const state = load();
  const task = state.tasks.find((t) => t.id === id);
  if (!task) {
    console.error(`no existe la tarea ${id}: ejecuta --sync`);
    process.exit(2);
  }
  task.status = status;
  if (flag("commit")) task.commit = flag("commit");
  if (flag("evidence")) task.evidence = flag("evidence");
  if (status === "done") task.date = new Date().toISOString().slice(0, 10);
  save(state);
  console.log(`${id} -> ${status}${task.commit ? ` (${task.commit})` : ""}`);
}

function cmdNext() {
  const state = load();
  const next = state.tasks.find((t) => t.status !== "done" && t.status !== "dropped");
  if (!next) {
    console.log("No queda nada pendiente.");
    return;
  }
  const phase = state.tasks.filter((t) => t.phase === next.phase);
  const done = phase.filter((t) => t.status === "done").length;
  console.log(`Siguiente: ${next.id} — ${next.title}`);
  console.log(`Fase ${next.phase}: ${done}/${phase.length} completadas`);
  if (next.status === "blocked") console.log(`(bloqueada: ${next.evidence || "sin motivo anotado"})`);
}

function cmdRender() {
  const state = load();
  const phases = [...new Set(state.tasks.map((t) => t.phase))];
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.status === "done").length;
  const pct = total ? Math.round((100 * done) / total) : 0;

  const out = [];
  out.push("# Progreso — XuperTV webOS");
  out.push("");
  out.push(`Plan: \`${state.plan}\``);
  out.push(`Actualizado: ${state.updatedAt || "—"}`);
  out.push("");
  out.push(`**Avance global: ${done}/${total} tareas (${pct} %)**`);
  out.push("");
  out.push("| Fase | Hechas | Total |");
  out.push("|---|---|---|");
  for (const p of phases) {
    const list = state.tasks.filter((t) => t.phase === p);
    out.push(`| ${p} | ${list.filter((t) => t.status === "done").length} | ${list.length} |`);
  }
  out.push("");

  for (const p of phases) {
    const list = state.tasks.filter((t) => t.phase === p);
    out.push(`## ${p}`);
    out.push("");
    out.push("| | ID | Tarea | Estado | Commit | Evidencia | Fecha |");
    out.push("|---|---|---|---|---|---|---|");
    for (const t of list) {
      const c = t.commit ? `\`${t.commit}\`` : "";
      const ev = (t.evidence || "").replace(/\|/g, "\\|");
      out.push(`| ${ICON[t.status]} | ${t.id} | ${t.title} | ${t.status} | ${c} | ${ev} | ${t.date || ""} |`);
    }
    out.push("");
  }
  out.push("_Generado por `node tools/progress.mjs --render`. No editar a mano._");
  out.push("");

  writeFileSync(OUT, out.join("\n"));
  console.log(`render: PROGRESS.md (${done}/${total}, ${pct} %)`);
}

function cmdCheck() {
  const state = load();
  const plan = parsePlan();
  const problems = [];

  const planIds = new Set(plan.tasks.map((t) => t.id));
  for (const t of state.tasks) if (!planIds.has(t.id)) problems.push(`${t.id} está en el registro pero ya no en el plan`);

  const stateIds = new Set(state.tasks.map((t) => t.id));
  for (const t of plan.tasks) if (!stateIds.has(t.id)) problems.push(`${t.id} está en el plan pero falta en el registro (--sync)`);

  for (const t of state.tasks) {
    if (t.status !== "done") continue;
    if (!t.commit) {
      problems.push(`${t.id} está marcada como hecha sin commit`);
      continue;
    }
    try {
      execFileSync("git", ["cat-file", "-e", `${t.commit}^{commit}`], { cwd: ROOT, stdio: "ignore" });
    } catch {
      problems.push(`${t.id} apunta a un commit inexistente: ${t.commit}`);
    }
    if (!t.evidence) problems.push(`${t.id} está hecha sin evidencia anotada`);
  }

  if (problems.length) {
    console.error("progress --check FALLA:");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  const done = state.tasks.filter((t) => t.status === "done").length;
  console.log(`progress --check OK — ${done}/${state.tasks.length} hechas, todas con commit y evidencia`);
}

/* ---------- main ---------- */
if (flag("sync")) cmdSync();
if (flag("set")) cmdSet();
if (flag("next")) cmdNext();
if (flag("render")) cmdRender();
if (flag("check")) cmdCheck();
if (!argv.length) {
  console.log("uso: --sync | --set T0.1 --status=done | --render | --next | --check");
}
