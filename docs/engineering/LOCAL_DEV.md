# Probar la app en el PC

Dos procesos y una URL.

```bash
node tools/serve.mjs          # http://127.0.0.1:8899  (app, sin caché)
node tools/dev_service.mjs    # http://127.0.0.1:8910  (servicio, portal real)
```

Abrir en Chromium:

```
http://127.0.0.1:8899/index.html?screen=home&service=http%3A%2F%2F127.0.0.1%3A8910
```

El parámetro `service=` sobreescribe `devServiceUrl` y hace que la app use la
API HTTP local en vez de Luna. Sin servicio, la app arranca pero el catálogo
sale del `data/catalog.js` empaquetado y las pantallas se ven vacías.

## Cómo elige la app su transporte

| Entorno | Camino |
|---|---|
| Televisor webOS | Luna (`PalmServiceBridge`) → servicio en el TV |
| Luna responde `denied` | reintento único a `http://127.0.0.1:8910/<metodo>?q=<json>` |
| Navegador sin puente | `devServiceUrl` / `?service=` → mismo HTTP local |

El servicio del televisor escucha ese puerto igual que el de desarrollo
(`index.js`, `httpApiStarted`), así que el mismo `?q=` funciona en ambos.

## Consultas sueltas

```bash
curl -s 'http://127.0.0.1:8910/ping'
curl -s 'http://127.0.0.1:8910/home?q=%7B%22root%22%3A%22movies%22%7D' | head -c 300
curl -s 'http://127.0.0.1:8910/search?value=dragon' | head -c 300
```

Las dos formas (`?q=<json>` y query plano) valen: el arnés normaliza ambas con
`tools/helpers/dev-service-query.mjs`.

## Medir

```bash
node tools/perf/measure.mjs --throttle=4 --out=docs/perf/latest.json
node tools/perf/budget.mjs docs/perf/latest.json
```

`--throttle=4` simula una TV lenta multiplicando la CPU por 4. El presupuesto
(`tools/perf/budget.mjs`) falla si el arranque, el foco o la memoria se salen
de los umbrales acordados en el plan v2.
