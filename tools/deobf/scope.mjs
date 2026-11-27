// tools/deobf/scope.mjs — ámbitos ES5 mínimos para el bundle heredado.
//
// Lo usan el renombrador y el chequeo de llamadas inexistentes: ambos necesitan
// saber a qué declaración apunta cada identificador. Sin esto, renombrar `e`
// cambia también los cientos de parámetros que se llaman `e`, y una llamada a
// un nombre declarado en otra función pasa por válida.
//
// Reglas de ES5 que se modelan:
//   - `var` y las declaraciones de función se elevan al ámbito de la función.
//   - Los parámetros viven en el ámbito de su función.
//   - `catch (e)` crea su propio ámbito.
//   - Una expresión de función CON nombre enlaza ese nombre sólo dentro de sí
//     (no en el ámbito exterior). Confundirlo fue un bug real: el id se
//     renombraba y la recursión interna se quedaba con el nombre viejo.

export function buildScopes(ast) {
  const scopeOfNode = new Map();
  const makeScope = (parent, node) => ({ parent, node, names: new Set() });

  function collect(node, scope) {
    if (!node || typeof node.type !== "string") return;

    if (node.type === "FunctionDeclaration") {
      // La declaración se eleva al ámbito contenedor.
      if (node.id) scope.names.add(node.id.name);
      const inner = makeScope(scope, node);
      scopeOfNode.set(node, inner);
      for (const p of node.params) if (p.type === "Identifier") inner.names.add(p.name);
      for (const s of node.body.body) collect(s, inner);
      return;
    }
    if (node.type === "FunctionExpression") {
      const inner = makeScope(scope, node);
      scopeOfNode.set(node, inner);
      // El nombre de una expresión de función con nombre sólo existe dentro.
      if (node.id) inner.names.add(node.id.name);
      for (const p of node.params) if (p.type === "Identifier") inner.names.add(p.name);
      for (const s of node.body.body) collect(s, inner);
      return;
    }
    if (node.type === "VariableDeclarator") {
      if (node.id && node.id.type === "Identifier") scope.names.add(node.id.name);
      collect(node.init, scope);
      return;
    }
    if (node.type === "CatchClause") {
      const inner = makeScope(scope, node);
      scopeOfNode.set(node, inner);
      if (node.param && node.param.type === "Identifier") inner.names.add(node.param.name);
      collect(node.body, inner);
      return;
    }

    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) collect(c, scope);
      else if (v && typeof v.type === "string") collect(v, scope);
    }
  }

  const rootScope = makeScope(null, ast);
  for (const s of ast.body) collect(s, rootScope);

  // El "nivel superior" del bundle es el cuerpo del IIFE que lo envuelve.
  let topScope = rootScope;
  for (const s of scopeOfNode.values()) {
    if (s.parent === rootScope && s.names.size > topScope.names.size) topScope = s;
  }

  return {
    rootScope,
    scopeOfNode,
    topScope,
    /** Ámbito donde se declara `name` visto desde `scope`, o null. */
    resolve(scope, name) {
      for (let s = scope; s; s = s.parent) if (s.names.has(name)) return s;
      return null;
    },
    /** Recorre el AST llevando el ámbito actual de cada nodo. */
    walk(node, scope, visit, parent = null, key = null) {
      if (!node || typeof node.type !== "string") return;
      visit(node, scope, parent, key);

      if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
        const inner = scopeOfNode.get(node) || scope;
        // El id de una DECLARACIÓN pertenece al exterior; el de una EXPRESIÓN
        // con nombre pertenece al interior.
        if (node.id) {
          this.walk(node.id, node.type === "FunctionDeclaration" ? scope : inner, visit, node, "id");
        }
        for (const p of node.params) this.walk(p, inner, visit, node, "params");
        this.walk(node.body, inner, visit, node, "body");
        return;
      }
      if (node.type === "CatchClause") {
        const inner = scopeOfNode.get(node) || scope;
        if (node.param) this.walk(node.param, inner, visit, node, "param");
        this.walk(node.body, inner, visit, node, "body");
        return;
      }

      for (const k of Object.keys(node)) {
        if (k === "loc" || k === "range" || k === "start" || k === "end") continue;
        const v = node[k];
        if (Array.isArray(v)) for (const c of v) this.walk(c, scope, visit, node, k);
        else if (v && typeof v.type === "string") this.walk(v, scope, visit, node, k);
      }
    },
  };
}
