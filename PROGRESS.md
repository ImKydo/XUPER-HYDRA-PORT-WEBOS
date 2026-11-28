# Progreso — XuperTV webOS

Plan: `.hermes/plans/2026-11-26_224922-xupertv-v2-reconstruccion-verificada.md`
Actualizado: 2026-11-27T06:49:10.518Z

**Avance global: 57/66 tareas (86 %)**

| Fase | Hechas | Total |
|---|---|---|
| F0 | 10 | 10 |
| F1 | 5 | 5 |
| F2 | 5 | 5 |
| F3 | 3 | 4 |
| F4 | 4 | 7 |
| F5 | 6 | 7 |
| F6 | 24 | 24 |
| F7 | 0 | 4 |

## F0

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T0.1 | Clonar y aislar | done | `df0e64d` | clon en df0e64d; rama chore/calidad-v2; legacy/ excluido | 2026-11-27 |
| ✔ | T0.2 | Herramientas verificadas y dependencias | done | `736488c` | 11 herramientas; acorn 8.19.0 + terser 5.51.4 | 2026-11-27 |
| ✔ | T0.3 | Restaurar FFmpeg (necesario para empaquetar) | done | `736488c` | ffmpeg ELF ARM 0755 desde vendor; P24 PASS (binario gitignored) | 2026-11-27 |
| ✔ | T0.4 | El contrato falla donde debe | done | `661239d` | 23/24 antes del fix; P22: index.html=3.1.37 vs APP_VERSION=3.1.86 | 2026-11-27 |
| ✔ | T0.5 | Artefacto generado y cache-buster | done | `661239d` | build --write deja sha256 757d9b80 identico; protected 24/24 | 2026-11-27 |
| ✔ | T0.6 | Recuperar los 3 archivos que solo existen en el IPK | done | `15b14a3` | logo-mark 256x256 carga (naturalWidth 256); logo-full y design-v4 recuperados | 2026-11-27 |
| ✔ | T0.7 | Empaquetador Linux y verificación de paridad con el IPK | done | `dfe24cd` | IPK 216 archivos; PARIDAD OK salvo index.html; ffmpeg 755 en ambos | 2026-11-27 |
| ✔ | T0.8 | Línea base y compatibilidad | done | `24b64ae` | dcl 961 fcp 288 dom 740 p95 12.5; CSS 22 bloqueos; ES5 26/26 | 2026-11-27 |
| ✔ | T0.9 | CI de calidad (incluye scripts inline) | done | `946d14d` | npm run check verde; 7 tests; inline-scripts detecta error inyectado | 2026-11-27 |
| ✔ | T0.10 | Higiene del proyecto en GitHub | done | `81f6505` | origin=ImKydo; 17 ramas borradas; 11 etiquetas; upstream no_push | 2026-11-27 |

## F1

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T1.1 | Servidor estático con `no-store` | done | `57eb122` | no-store verificado; 404 en traversal y rutas inexistentes | 2026-11-27 |
| ✔ | T1.2 | El servicio local entiende `?q=` | done | `730473d` | 5 tests; /home?q= devuelve items reales del portal | 2026-11-27 |
| ✔ | T1.3 | Fallback al servicio HTTP sin puente Luna | done | `6617e4a` | 12 llamadas a 127.0.0.1:8910; servicio del TV tambien acepta ?q= | 2026-11-27 |
| ✔ | T1.4 | Smoke E2E | done | `11fa655` | 5/5 pantallas con foco; 0 excepciones; hallazgo de version corregido en 9294bb7 | 2026-11-27 |
| ✔ | T1.5 | Presupuesto de rendimiento | done | `266a95d` | 24 tests; baseline dcl 961 foco p95 12.5; Presupuesto OK | 2026-11-27 |

## F2

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T2.1 | Inventario de las 313 funciones | done | `a260fbf` | 313 funciones; 34 de 1 letra, 172 de 2, 97 legibles | 2026-11-27 |
| ✔ | T2.2 | Pruebas del renombrador (antes de usarlo) | done | `a95b3c8` | 9 tests; 3 verificaciones (ambito, canonica, declaracion) | 2026-11-27 |
| ✔ | T2.3 | Lote 1: el núcleo (≈20 funciones) | done | `0644106` | 10 nombres, 405 apariciones; firstFocusable inexistente detectado y corregido | 2026-11-27 |
| ✔ | T2.4 | Lotes 2 a 6, por dominio | done | `0117509` | 6 lotes, 74 nombres, 0 de una letra; smoke 6/6 | 2026-11-27 |
| ✔ | T2.5 | Cierre de la reconstrucción | done | `459f8da` | legacy-map.md; 70% de lineas legibles; zona protegida documentada | 2026-11-27 |

## F3

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T3.1 | Dual-bus `palm://` (issue #22) | done | `d921cc1` | palm:// tras denied; dual-bus 2/2; pendiente TV webOS 3 real | 2026-11-27 |
| ✖ | T3.2 | Diagnóstico de la escala en webOS 3.4 (issue #18) | blocked | `3e7a8cf` | fila Pantalla en Diagnostico; decision requiere datos de TV webOS 3.4 |  |
| ✔ | T3.3 | Comparación de versión ("SERVICIO DESACTUALIZADO") | done | `331f4d8` | version-check 3/3: no avisa con v3.1.86, si avisa con v3.0.0 | 2026-11-27 |
| ✔ | T3.4 | Matriz de compatibilidad en CI (patrón TiviBro) | done | `39261b3` | 14 archivos + inline sin APIs fuera de Chromium 38; 7 tests | 2026-11-27 |

## F4

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T4.1 | Recortar el payload del catálogo (274 KB → ≤ 100 KB) | done | `274bf69` | movies 274.636 -> 129.972 B (-53%); 6 tests | 2026-11-27 |
| ✔ | T4.2 | Imágenes con placeholder y dimensiones | done | `637c5eb` | placeholder 830 B; img-fallback 4/4; 4 sitios centralizados | 2026-11-27 |
| — | T4.3 | Culling por frame, no por temporizador | dropped | `637c5eb` | medido: p95 15.4->14.7 dentro del ruido y long tasks iguales; no se acepta sin ganancia |  |
| ✔ | T4.4 | Temporizadores y cachés sin límite (ideas del PR #24) | done | `6bc2e66` | reloj y caches ya acotados; guarda en telemetria; fuga -0.2 MB | 2026-11-27 |
| — | T4.5 | Sacar `portal.js` (507 KB) del camino crítico | dropped | `a8463f7` | medido: dcl -2% y portada con 10 posters en vez de 110; revertido |  |
| ✖ | T4.6 | Rangos sin acumular en memoria | blocked | `a8463f7` | proxy readRange es zona protegida: requiere 'modificar reproduccion' |  |
| ✔ | T4.7 | Scroll sin escrituras redundantes | done | `a8463f7` | p95 15.4 -> 12.5 ms mediana; avg 8.71 -> 7.6; over33 0 | 2026-11-27 |

## F5

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T5.1 | Tokens | done | `9c1a271` | tokens.json -> 74 lineas; sin var() (Chromium 38) | 2026-11-27 |
| ✔ | T5.2 | Consolidar 3 capas en `app.css` | done | `9c1a271` | 3 capas -> legacy.css + app.css; diff pixel a pixel <=1.68% | 2026-11-27 |
| ✔ | T5.3 | Capa `.nogap` generada (patrón TiviBro) | done | `9c1a271` | 14 reglas nogap; Chrome 53 activa, Chrome 158 no | 2026-11-27 |
| ✔ | T5.4 | `backdrop-filter` → fondo sólido | done | `9c1a271` | 8 backdrop-filter fuera; css-compat 0 no soportadas | 2026-11-27 |
| ✖ | T5.5 | CSS muerto | blocked | `9c1a271` | dead-css.mjs lista 185 clases sin uso; borrarlas exige migrar pantalla a pantalla |  |
| ✔ | T5.6 | `!important` a cero | done | `9c1a271` | 3.609 -> 0 !important con diff visual <=1.68% | 2026-11-27 |
| ✔ | T5.7 | Cerrar la puerta | done | `9c1a271` | css-compat --fail EXIT 0; continue-on-error fuera de CI | 2026-11-27 |

## F6

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| ✔ | T6.1 | Tipografía y truncado | done | `f724c09` | auditoria de desbordes: 4 defectos corregidos; segunda pasada 0 | 2026-11-27 |
| ✔ | T6.2 | Un solo lenguaje de foco | done | `ab01bb3` | hover=foco unificado; anchos 107,74,155,118,172 identicos en 5 estados | 2026-11-27 |
| ✔ | T6.3 | Safe area (overscan 5 %) | done | `ee70956` | safe-area.mjs: 47 textos en banda del 5%; decision documentada (16:9 + --strict) | 2026-11-27 |
| ✔ | T6.4 | Estados de carga, error y vacío | done | `ee70956` | vacio de busqueda verificado; estado vacio de catalogo añadido; aviso de portal caido | 2026-11-27 |
| ✔ | T6.5 | Carrusel de 7 + asomo | done | `f724c09` | paso 254, tarjeta 234x346: 7 completas + 46 px de asomo | 2026-11-27 |
| ✔ | T6.6 | Issue #83: retomar, favoritos y Back | done | `ee70956` | favoritos guardan ficha (3/3 con ids fuera del catalogo); fila Mi lista; Back vuelve a la misma tarjeta | 2026-11-27 |
| ✔ | T6.7 | Regresión visual | done | `ee70956` | visual-layout.mjs: 7 pantallas, 30 cajas, tolerancia 8 px; en npm run layout y CI | 2026-11-27 |
| ✔ | T6.8 | Navegación de cinco pestañas con Categorías | done | `1e0ab60` | 8 pestañas -> 5; Kids/Anime/Novelas dentro de Categorías; panel abre con Kids/Anime/Novelas + géneros | 2026-11-27 |
| ✔ | T6.9 | Seguir viendo e Historial en Ajustes | done | `1e0ab60` | riel 'Seguir viendo' primero en Inicio sólo con progreso; Historial fuera de la barra, en Ajustes -> Mi lista | 2026-11-27 |
| ✔ | T6.10 | Cabecera sin reloj ni wifi y buscar accesible | done | `1e0ab60` | reloj y wifi fuera; acciones de cabecera reducidas a buscar y cuenta; sin icono de filtro duplicado | 2026-11-27 |
| ✔ | T6.11 | Marca ZephyrTV | done | `1e0ab60` | icono 256/512 + marca 144; nombre en appinfo/index/arranque/barra; textos y errores sin XuperTV; créditos al código base | 2026-11-27 |
| ✔ | T6.12 | Documentar la nueva navegación | done | `1e0ab60` | docs/engineering/navegacion.md con estructura, marca y por qué se retiraron las pestañas | 2026-11-27 |
| ✔ | T6.13 | Portada (hero) en Inicio, Películas y Series | done | `d7846d8` | hero a sangre con degradados, sinopsis recortada, respaldo backdrop->landscape->poster; foco con teclado real: abajo->fila, arriba->portada, Enter->ficha; smoke 6/6 home 111 enfocables | 2026-11-27 |
| ✔ | T6.14 | Instalación y validación en televisor real | done | `e46fd05` | LG 55UT7300PSA webOS 25: arranque 1920x1080 DPR2, dcl 1785 ms; 3 bugs de dispositivo corregidos (down desde Inicio, imagen del hero, versión del servicio) | 2026-11-27 |
| ✔ | T6.15 | Menú lateral deslizante con foco exclusivo | done | `7913b58` | cajón 320 px oculto (x=-320) que abre con izquierda; 9/9 e2e; foco atrapado; derecha y Back devuelven el foco a la tarjeta | 2026-11-27 |
| ✔ | T6.16 | El cajón empuja el catálogo con velo | done | `a7f4039` | 12/12 e2e: contenidoX 320 abierto y 0 cerrado; velo 160 ms con degradado .86->.55; will-change temporal 340 ms | 2026-11-27 |
| ✔ | T6.17 | Raíl colapsable de 96 px y arreglos del menú | done | `d4e3f42` | raíl 96<->320 empujando 96/320; acciones arriba con rótulo; icono enfocado con delta de luminancia 238; sin text-shadow | 2026-11-27 |
| ✔ | T6.18 | Title Case, iconos, Configuración y marca Zephyr | done | `71d58ee` | 6 opciones; Mi cuenta sobre Buscar; casa/claqueta/episodios/engranaje; isotipo centrado y paleta teal #00D2BE; Configuración al fondo abre Ajustes | 2026-11-27 |
| ✔ | T6.19 | Iconos Lucide vendorizados | done | `0f51506` | 8 SVG Lucide 0.544.0 en src/assets/icons; tools/icons.mjs genera window.ZEPHYR_ICONS; railIcon con respaldo | 2026-11-28 |
| ✔ | T6.20 | Columna de iconos fija a 48 px | done | `b43d67c` | icono a 48 px colapsado y 49 abierto; overflow-x hidden y scrollLeft a cero; 15 comprobaciones | 2026-11-28 |
| ✔ | T6.21 | Sin sombras de texto | done | `1cd449f` | 0 declaraciones text-shadow; tools/check/no-text-shadow.mjs en npm run check | 2026-11-28 |
| ✔ | T6.22 | Arranque minimalista con anillo | done | `010aada` | isotipo 188 px sin caja, anillo 240 girando, version en la esquina; welcome.mjs 6/6 | 2026-11-28 |
| ✔ | T6.23 | Icono de app con fondo oscuro | done | `72677ae` | 512/256 con fondo navy a sangre, sin esquinas; tools/app-icon.mjs | 2026-11-28 |
| ✔ | T6.24 | Alineación fina de iconos, marca e isotipo | done | `0aad90e` | 8 cajas 44x44 a x=26, svg 26 centrado, marca en la misma columna; isotipo viewBox 10 con centroide +0,1 px; 19 comprobaciones del cajón | 2026-11-28 |

## F7

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T7.1 | Geometría pura + pruebas | pending |  |  |  |
| · | T7.2 | Conectar a Ajustes | pending |  |  |  |
| · | T7.3 | Migrar Búsqueda, Sección, Detalle, Inicio | pending |  |  |  |
| · | T7.4 | Reproductor intocable | pending |  |  |  |

_Generado por `node tools/progress.mjs --render`. No editar a mano._
