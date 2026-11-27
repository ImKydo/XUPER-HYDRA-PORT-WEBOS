// tools/css-parse.mjs — parser CSS mínimo pero correcto.
//
// Por qué no una regex: `@keyframes` y los comentarios contienen llaves, y una
// regex ingenua desalinea los bloques (bug real detectado al generar nogap.css:
// se contaban 26 reglas con `gap` pero todas parecían `gap: 0`).
//
// Este escáner recorre carácter a carácter, ignora comentarios y cadenas, y
// devuelve reglas planas {selector, decls:[{prop,value}], line}.

export function parseRules(source, file) {
  const rules = [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  let i = 0;
  let line = 1;
  let depth = 0;
  let buf = "";
  let current = null;
  let quote = null;

  const pushDecl = (text) => {
    const idx = text.indexOf(":");
    if (idx < 0 || !current) return;
    const prop = text.slice(0, idx).trim().toLowerCase();
    const value = text.slice(idx + 1).replace(/!important/g, "").trim();
    if (!/^[-a-z]+$/.test(prop)) return;
    current.decls.push({ prop, value });
  };

  while (i < clean.length) {
    const ch = clean[i];
    if (ch === "\n") line++;

    if (quote) {
      buf += ch;
      if (ch === quote && clean[i - 1] !== "\\") quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      i++;
      continue;
    }

    if (depth === 0) {
      if (ch === "{") {
        const selector = buf.trim();
        buf = "";
        if (selector.startsWith("@")) {
          depth++;
          i++;
          continue;
        }
        current = { selector, decls: [], line, file };
        rules.push(current);
        depth++;
        i++;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      if (buf.trim()) pushDecl(buf.trim());
      buf = "";
      depth--;
      if (depth === 0) current = null;
      i++;
      continue;
    }
    if (ch === ";") {
      if (buf.trim()) pushDecl(buf.trim());
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }

  for (const r of rules) {
    const d = r.decls.find((x) => x.prop === "display");
    r.display = d ? d.value : "";
  }
  return rules;
}

export const isZeroLength = (v) => /^0(px|rem|em|%)?$/.test(v);

/** "12px 20px" -> {row:"12px", col:"20px"}; "12px" -> ambos. */
export function gapPair(value) {
  const p = value.trim().split(/\s+/);
  return p.length === 1 ? { row: p[0], col: p[0] } : { row: p[0], col: p[1] };
}

/** Reglas con display:flex y un gap distinto de cero.
 *
 * Ojo: en este CSS el `display:flex` y el `gap` suelen estar en reglas
 * distintas del mismo selector (style.css y clean.css). Por eso se agrupan
 * las declaraciones por selector respetando el orden de cascada, y recién
 * entonces se decide. Mirar un solo bloque daría falsos negativos.
 */
export function flexGapRules(rules) {
  const bySelector = new Map();
  for (const r of rules) {
    const key = r.selector.replace(/\s+/g, " ").trim();
    if (!key) continue;
    if (!bySelector.has(key)) bySelector.set(key, { selector: key, decls: [], line: r.line });
    const merged = bySelector.get(key);
    for (const d of r.decls) merged.decls.push(d);
  }

  const out = [];
  for (const merged of bySelector.values()) {
    // Gana la última declaración de cada propiedad (cascada).
    const last = new Map();
    for (const d of merged.decls) last.set(d.prop, d.value);
    const display = last.get("display") || "";
    if (!/flex/.test(display)) continue;
    if (!last.has("gap")) continue;
    const { row, col } = gapPair(last.get("gap"));
    if (isZeroLength(row) && isZeroLength(col)) continue;
    out.push({
      rule: { selector: merged.selector, line: merged.line },
      row,
      col,
      column: /column/.test(last.get("flex-direction") || ""),
    });
  }
  return out;
}
