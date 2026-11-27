# Sistema visual

## Capas y orden de carga

```
css/tokens.generated.css   ← generado desde src/design/tokens.json
css/legacy.css             ← las tres capas históricas, juntas y sin !important
css/app.css                ← el skin propio (este es el archivo que se edita)
css/nogap.css              ← generado; sólo actúa con la clase .nogap
```

`legacy.css` se mantiene debajo a propósito: describe geometría fina de siete
pantallas construidas con posiciones absolutas desde el JS. Reescribir eso a
ciegas rompe el layout. Lo que se hace es **pintar por encima** en `app.css`,
que gana por orden de cascada al no haber ningún `!important` en juego.

Cuando una pantalla se migre del todo, sus reglas se borran de `legacy.css`.
No al revés.

## Reglas del proyecto

- **Cero `!important`.** Lo comprueba `tools/check/css-compat.mjs`. Si una regla
  nueva no gana, el problema es la especificidad, no la falta de `!important`.
- **Cero `var()`.** Chromium 38 (webOS 3) no las soporta. Los valores del JSON
  se escriben literales en `app.css`; `css-tokens.mjs` genera las utilidades.
- **Nada de `gap` en flex, `grid`, `backdrop-filter` ni `filter`.** ya no queda
  ninguno en lo que se sirve; si aparece, el check falla.
- **No se toca `position/left/top/width/height`** de lo que coloca el JS. El
  skin sólo cambia color, borde, radio, sombra, tipografía y estado.

## Foco

Un único lenguaje para toda la app:

```css
.is-focused { box-shadow: 0 0 0 3px #ffffff, 0 10px 30px rgba(0,0,0,.65); }
```

Antes cada pantalla inventaba el suyo (outline, borde, sombra, o nada) y desde
el sofá no se distinguía qué estaba seleccionado. Componentes con superficie
propia (`.poster`, `.bento`, `.live-row`, `.settings-item`…) añaden su variante
de fondo o escala.

## Tipografía y paleta

Salen de `src/design/tokens.json`:

| Token | Valor | Uso |
|---|---|---|
| `color.bg` | `#07070b` | fondo de la app |
| `color.surface` | `#12121b` | tarjetas, paneles |
| `color.line` | `#262633` | bordes de 1 px |
| `color.text` | `#f4f5f8` | texto principal |
| `color.muted` | `#98a0ae` | secundario |
| `color.accent` | `#e11d2e` | marca, EN VIVO, activo |
| `font.hero` | `64px` | título de detalle |
| `font.title` | `36px` | títulos de sección |
| `font.body` | `24px` | texto general |

## Estado de la migración

| Pantalla | Estado |
|---|---|
| Inicio (pestañas, bento, rieles) | reskin aplicado |
| TV en vivo (panel, lista, acciones) | reskin aplicado |
| Detalle | reskin aplicado |
| Búsqueda y teclado | reskin aplicado |
| Ajustes y diagnóstico | reskin aplicado |
| Reproductor (canalera, categorías) | reskin aplicado |
| Diálogos y avisos | reskin aplicado |

Pendiente para fases siguientes: sustituir `legacy.css` por reglas propias
pantalla a pantalla (empezando por inicio), y con ello bajar las ~1.700 reglas
heredadas. Mientras tanto, cualquier regla nueva va en `app.css`.

## Herramientas

```bash
node tools/css-tokens.mjs --write      # tokens.json -> tokens.generated.css
node tools/gen-nogap.mjs --write       # margenes para gap en webOS < 22
node tools/check/css-compat.mjs        # !important, gap, backdrop-filter, grid...
node tools/check/dead-css.mjs          # clases sin uso (informativo)
node tools/shots.mjs --service         # capturas de las 9 pantallas
```

## Por qué 1080p

`appinfo.json` declaraba `resolution: "1280x720"`. Eso hacía que webOS diera al
webview una superficie de 720p y la app dibujara el lienzo de 1920 escalado a
0,667: el televisor reescalaba esa superficie y la interfaz se veía borrosa,
mientras el vídeo (que se decodifica a resolución nativa) se veía bien. Ahora
declara 1920x1080 y la escala es 1:1.

Consecuencia: el modo "Compatibilidad HD" (que reducía la interfaz a 2/3) ya no
se aplica en paneles de 1080p o más; sólo sigue activo entre 1280 y 1920.

## Safe area (overscan)

`node tools/check/safe-area.mjs` mide qué elementos caen dentro del 5 % del
borde que algunos televisores recortan. Medición actual: 47 elementos con texto
en esa banda, casi todos a 32-80 px del borde izquierdo.

**Decisión:** no se mueve el layout. Las posiciones son absolutas y están
calculadas en JavaScript para nueve pantallas; desplazarlas a ciegas rompe la
composición en las que ya están bien, y el recorte solo ocurre si el televisor
tiene overscan activo. La app usa márgenes del 2,5 % (48 px) desde el origen.

Qué hacer si en un televisor concreto aparece contenido cortado:

1. Ajustes de imagen del televisor → relación de aspecto → **16:9 / Solo
   escaneo** (desactiva el overscan).
2. Si aun así se corta, `node tools/check/safe-area.mjs --strict` lista los
   elementos con texto dentro de la banda para decidir cuáles mover.

## Regresión de maquetación

`node tools/check/visual-layout.mjs` guarda las cajas de 30 elementos estables
en `docs/perf/layout-baseline.json` y falla si alguna se mueve más de 8 px.

Se compara geometría y no píxeles a propósito: las carátulas llegan de una CDN
y en un entorno sin red la mitad no carga, así que un diff de imagen daría
falsos positivos constantes. Después de un cambio visual deliberado:

```bash
node tools/check/visual-layout.mjs --update   # nueva línea base
```

La comprobación corre en CI después de los chequeos de CSS.
