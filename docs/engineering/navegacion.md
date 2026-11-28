# Navegación y marca

## Estructura principal

```
ZEPHYRTV   Cine, series y TV en vivo
INICIO · TV · PELÍCULAS · SERIES · CATEGORÍAS        [buscar] [cuenta]
```

Cinco pestañas, una sola fila, sin etiquetas de grupo ni iconos duplicados.

| Pestaña | Qué muestra | Origen |
|---|---|---|
| INICIO | Seguir viendo, destacados, rieles por categoría | sección `Destacados` del portal |
| TV | Canales en vivo con su panel de acciones | lista de canales |
| PELÍCULAS | Catálogo de películas | raíz `movies` |
| SERIES | Catálogo de series | raíz `series` |
| CATEGORÍAS | Panel de filtros: tipo y género | `openCatalogFilter()` |

**Por qué desaparecieron Kids, Anime, Novelas e Historial.** Cada pestaña extra
costaba una pulsación del mando y ensanchaba la barra hasta chocar con el
reloj. Kids, Anime y Novelas son filtros del mismo catálogo: viven dentro de
Categorías, que abre el panel de tipos y géneros y pinta el resultado en la
pantalla de sección. Historial es un dato de la cuenta: vive en
Ajustes → Mi lista, junto a favoritos.

**Seguir viendo** es el primer riel de Inicio y sólo aparece si hay progreso
real (`position >= 5` o `duration > 0`), no con sólo abrir un título.

## Portada (hero)

Inicio, Películas y Series abren con una portada a sangre: imagen del título
(690 px de alto dentro del lienzo), degradado a la izquierda para el texto y
otro abajo para fundir con el catálogo.

- Etiqueta, título, géneros · año · duración, sinopsis recortada en palabra
  completa y dos acciones: **Ver ahora** (abre la ficha, donde el foco queda en
  Reproducir) y **Mi lista** (añade o quita el título y lo confirma con un
  aviso).
- Flechas circulares a los lados y barras de posición abajo a la izquierda.
- Rotación cada 9 s sólo si la portada no tiene el foco y su pestaña está
  visible: nunca cambia la ficha bajo los dedos.
- Si el título no tiene backdrop, se prueban `landscape` y `poster` en orden;
  si los tres fallan queda un degradado, no un hueco negro.

**Foco:** desde la barra, `abajo` entra en la portada; `abajo` otra vez va a la
primera fila; `arriba` desde la primera fila vuelve a la portada; `derecha` e
`izquierda` recorren Ver ahora / Mi lista y las flechas.

La rejilla anterior de seis paneles (2 grandes + 4 pequeños con puntos) sigue
existiendo para Infantil/Anime/Novelas, pero Inicio, Películas y Series ya no la
usan.

## Menú lateral (raíl colapsable)

El raíl está **siempre visible** con 96 px y solo iconos. Al entrar en él se
expande a 320 px y empuja el catálogo, como YouTube TV.

Orden de arriba abajo: marca, **Mi cuenta**, **Buscar**, y después Inicio, TV,
Películas, Series y Categorías. **Configuración** va al final, pegada al fondo
(`margin-top: auto`) y separada del contenido. El foco por defecto es **Inicio**;
las acciones viven arriba pero no son el punto de entrada.

**Mi cuenta** abre Ajustes en el panel de cuenta; **Configuración** abre Ajustes
en "Configuración global".

- Ancho 96 ↔ 320 con `transition: width .24s`. Los rótulos y la marca completa
  se muestran solo con `.is-open`.
- El contenido va desplazado con `transform`: `translateX(96px)` en reposo y
  `translateX(320px)` con `.is-pushed`. Nunca se anima `width` del contenido.
- El velo (`.home-sidebar-bg`) sube en 160 ms, antes que el desplazamiento
  (260 ms), con degradado de 0,86 a 0,55.
- **Foco exclusivo**: todos los `_onMove` del raíl devuelven `true`, así el
  manejador global no recurre a la búsqueda geométrica y el foco no se escapa.
  `derecha` cierra y devuelve el foco al elemento que abrió el raíl.
- `Enter` en una sección cierra el raíl y enfoca la portada de esa sección.
- La página de TV conserva su encuadre: se compensa con
  `.home-page:first-child { left:-96px; width:1920px }`.

Prueba: `node tests/e2e/nav-drawer.mjs` (o `npm run test:e2e:drawer`), 13
comprobaciones con teclas reales.

## Cabecera

- Marca a la izquierda: icono, `ZEPHYRTV` y lema.
- A la derecha, dos acciones: buscar y cuenta.
- **Sin reloj y sin indicador de wifi**: el televisor ya los dibuja en su
  propia barra y aquí sólo competían por el espacio.

La búsqueda es la primera acción de la cabecera. Desde el último elemento de
una fila, `arriba` lleva a la barra y `derecha` al grupo de acciones; desde la
primera pestaña, `izquierda` también llega a buscar.

## Marca

| Pieza | Valor |
|---|---|
| Nombre visible | ZephyrTV |
| Lema | Cine, series y TV en vivo |
| Icono | `images/zephyr-icon.png` (256), `zephyr-icon-large.png` (512) |
| Marca de la barra y del arranque | `images/logo-mark.png` (144) |
| Color de marca | `#e11d2e` |
| `appinfo.json` `title` | ZephyrTV |

El identificador del paquete (`com.webosflux.xuptertv.fidelity`) **no cambia**:
si cambiara, el televisor instalaría otra aplicación en paralelo y se perderían
la sesión del portal, los favoritos y el historial de quien ya la tiene.

## Créditos

En Ajustes → Sobre nosotros:

> Basado en el código base de XuperTV (cristianco7), reutilizado como punto de
> partida con su licencia. Interfaz, mantenimiento y evolución: ZephyrTV.

El nombre del autor original no aparece como autor de esta aplicación ni en la
cabecera, ni en el arranque, ni en el panel de compartir. Se conserva el crédito
al código base, que es lo que corresponde.

## Qué NO se tocó

La zona protegida de reproducción sigue intacta (`streamMode`, `forceRelay`,
`resolveSmooth`, `playUrl`, seek, cambio de episodio y el relay FFmpeg). Este
trabajo es de navegación, cabecera y marca.

## Marca y paleta

El isotipo sale de `images/zephyr-mark.svg` (dos aspas de viento: teal arriba,
azul abajo). En colapsado se muestra solo, centrado y con 26 px de aire debajo;
en abierto comparte fila con el wordmark **Zephyr** + **TV** en teal.

Paleta tomada del isotipo: acento `#00D2BE`, acento claro `#4FE3D4`, azul
`#0B2F9F`/`#051B63`, fondo `#05070D`, superficie `#080D14`, línea `#16212B`,
texto `#EAF3F5`, apagado `#8FA2AD`. Sustituye al rojo anterior en toda la
interfaz. Los iconos de app (`zephyr-icon.png`, 512/256) se rasterizan del SVG
con Chromium: ImageMagick no entiende el `feDropShadow` del archivo.
