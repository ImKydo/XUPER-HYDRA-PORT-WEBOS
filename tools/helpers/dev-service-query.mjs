// Normaliza la query de una URL de servicio a un objeto plano.
//
// La app llama `GET http://127.0.0.1:8910/<metodo>?q=<json>` (función Ph de
// app.js), pero los ejemplos del README usan `?root=movies`. El servicio de
// desarrollo tiene que entender las dos formas o no hay manera de probar la
// app de punta a punta en el PC.
//
// Si `q` viene roto, se ignora y mandan los parámetros planos.

export function parseQuery(rawUrl) {
  const qs = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  const flat = {};

  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    if (i < 0) continue;
    flat[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
  }

  let merged = {};
  if (typeof flat.q === "string" && flat.q.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(flat.q);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) merged = parsed;
    } catch {
      /* q roto: mandan los planos */
    }
  }

  for (const k of Object.keys(flat)) {
    if (k !== "q") merged[k] = flat[k];
  }
  return merged;
}
