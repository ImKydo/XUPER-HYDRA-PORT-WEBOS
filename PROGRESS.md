# Progreso — XuperTV webOS

Plan: `.hermes/plans/2026-11-26_224922-xupertv-v2-reconstruccion-verificada.md`
Actualizado: 2026-11-27T02:39:53.877Z

**Avance global: 9/49 tareas (18 %)**

| Fase | Hechas | Total |
|---|---|---|
| F0 | 9 | 10 |
| F1 | 0 | 5 |
| F2 | 0 | 5 |
| F3 | 0 | 4 |
| F4 | 0 | 7 |
| F5 | 0 | 7 |
| F6 | 0 | 7 |
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
| ✖ | T0.10 | Higiene del proyecto en GitHub | blocked | `827f3b0` | local hecho; remoto bloqueado: push=false y sin fork |  |

## F1

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T1.1 | Servidor estático con `no-store` | pending |  |  |  |
| · | T1.2 | El servicio local entiende `?q=` | pending |  |  |  |
| · | T1.3 | Fallback al servicio HTTP sin puente Luna | pending |  |  |  |
| · | T1.4 | Smoke E2E | pending |  |  |  |
| · | T1.5 | Presupuesto de rendimiento | pending |  |  |  |

## F2

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T2.1 | Inventario de las 313 funciones | pending |  |  |  |
| · | T2.2 | Pruebas del renombrador (antes de usarlo) | pending |  |  |  |
| · | T2.3 | Lote 1: el núcleo (≈20 funciones) | pending |  |  |  |
| · | T2.4 | Lotes 2 a 6, por dominio | pending |  |  |  |
| · | T2.5 | Cierre de la reconstrucción | pending |  |  |  |

## F3

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T3.1 | Dual-bus `palm://` (issue #22) | pending |  |  |  |
| · | T3.2 | Diagnóstico de la escala en webOS 3.4 (issue #18) | pending |  |  |  |
| · | T3.3 | Comparación de versión ("SERVICIO DESACTUALIZADO") | pending |  |  |  |
| · | T3.4 | Matriz de compatibilidad en CI (patrón TiviBro) | pending |  |  |  |

## F4

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T4.1 | Recortar el payload del catálogo (274 KB → ≤ 100 KB) | pending |  |  |  |
| · | T4.2 | Imágenes con placeholder y dimensiones | pending |  |  |  |
| · | T4.3 | Culling por frame, no por temporizador | pending |  |  |  |
| · | T4.4 | Temporizadores y cachés sin límite (ideas del PR #24) | pending |  |  |  |
| · | T4.5 | Sacar `portal.js` (507 KB) del camino crítico | pending |  |  |  |
| · | T4.6 | Rangos sin acumular en memoria | pending |  |  |  |
| · | T4.7 | Scroll sin escrituras redundantes | pending |  |  |  |

## F5

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T5.1 | Tokens | pending |  |  |  |
| · | T5.2 | Consolidar 3 capas en `app.css` | pending |  |  |  |
| · | T5.3 | Capa `.nogap` generada (patrón TiviBro) | pending |  |  |  |
| · | T5.4 | `backdrop-filter` → fondo sólido | pending |  |  |  |
| · | T5.5 | CSS muerto | pending |  |  |  |
| · | T5.6 | `!important` a cero | pending |  |  |  |
| · | T5.7 | Cerrar la puerta | pending |  |  |  |

## F6

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T6.1 | Tipografía y truncado | pending |  |  |  |
| · | T6.2 | Un solo lenguaje de foco | pending |  |  |  |
| · | T6.3 | Safe area (overscan 5 %) | pending |  |  |  |
| · | T6.4 | Estados de carga, error y vacío | pending |  |  |  |
| · | T6.5 | Carrusel de 7 + asomo | pending |  |  |  |
| · | T6.6 | Issue #83: retomar, favoritos y Back | pending |  |  |  |
| · | T6.7 | Regresión visual | pending |  |  |  |

## F7

| | ID | Tarea | Estado | Commit | Evidencia | Fecha |
|---|---|---|---|---|---|---|
| · | T7.1 | Geometría pura + pruebas | pending |  |  |  |
| · | T7.2 | Conectar a Ajustes | pending |  |  |  |
| · | T7.3 | Migrar Búsqueda, Sección, Detalle, Inicio | pending |  |  |  |
| · | T7.4 | Reproductor intocable | pending |  |  |  |

_Generado por `node tools/progress.mjs --render`. No editar a mano._
