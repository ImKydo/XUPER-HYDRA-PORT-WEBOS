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

## Menú lateral (cajón)

No hay barra de navegación permanente. El menú vive fuera de pantalla y entra
solo cuando se pulsa `izquierda` con el foco en el borde izquierdo del
catálogo: la primera tarjeta de una fila o la portada.

- Panel de 320 px, oculto con `translateX(-100%)`; `.is-open` lo trae a 0 en
  260 ms. **El catálogo se empuja**: `#home-pages` pasa a `+320px` con la misma
  curva (`.is-pushed`), así que el panel no tapa, desplaza. Se animan solo
  `transform` y `opacity`; `will-change` se pone durante 340 ms y se retira.
- El velo (`.home-sidebar-bg`) sube en 160 ms, antes que el desplazamiento, con
  un degradado más denso junto al menú (0,72 → 0,34).
- **El foco es exclusivo.** Mientras está abierto, todos los `_onMove` del
  cajón devuelven `true`: el manejador global no recurre a la búsqueda
  geométrica y el foco no puede escaparse al contenido. Es el equivalente al
  foco atrapado de un drawer de Android.
- `derecha` cierra y devuelve el foco al elemento que abrió el cajón
  (`X.navReturn`). `Back` hace lo mismo y se evalúa antes que cualquier otra
  capa.
- `Enter` en una sección cierra el cajón y enfoca la portada de esa sección.
- Las acciones (buscar y cuenta) están al pie del cajón, y solo son visibles
  mientras está abierto.

Sin barra, el catálogo ocupa la pantalla completa: `#home-pages` pasa a
`top:0; height:1080`. La página de TV en vivo conserva su encuadre original con
`.home-page:first-child { top:86px; height:994px }`.

Prueba: `node tests/e2e/nav-drawer.mjs` (o `npm run test:e2e:drawer`).

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
