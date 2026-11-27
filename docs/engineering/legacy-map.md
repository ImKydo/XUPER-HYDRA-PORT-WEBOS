# Mapa del bundle heredado

`webos/fidelity/js/app.js` es un artefacto generado desde
`src/legacy/app.legacy.js` (14.025 líneas). Este documento explica cómo se
reconstruyó y qué queda pendiente.

## Estado

| Métrica | Antes | Ahora |
|---|---|---|
| Funciones de una letra | 34 | **0** |
| Funciones renombradas | — | 74 |
| Funciones con nombre legible (3+ caracteres) | 97 | 174 |
| Líneas en funciones legibles | — | 8.816 de 12.589 (70 %) |
| Líneas en la zona protegida | — | 1.306 (10 %) |

## Cómo se renombra

`tools/deobf/rename.mjs` aplica un mapeo `{ "nombreViejo": "nombreNuevo" }`
sobre `src/legacy/app.legacy.js` con tres garantías:

1. **Ámbito**: analiza scopes ES5 (`var` eleva a la función, `catch` tiene el
   suyo) y solo renombra el binding de nivel superior. Sin esto, renombrar `e`
   cambiaría también los cientos de parámetros que se llaman `e`.
2. **Forma canónica**: compara el AST antes y después deshaciendo el mapeo. Si
   difiere, no escribe.
3. **Declaración**: cada nombre nuevo debe quedar declarado en la salida. La
   verificación 2 no basta: si las llamadas se renombran y la declaración no,
   el mapeo inverso hace cuadrar el AST igual y la app rompe en ejecución.

Además rechaza: nombres de la zona protegida (`tools/deobf/protected-names.json`),
colisiones con cualquier identificador existente, nombres ausentes y palabras
reservadas.

```bash
node tools/deobf/rename.mjs --map=tools/deobf/batches/batch-1.json --target=src/legacy/app.legacy.js --write
node tools/build.mjs --write
node tools/check/protected.mjs && node tools/check/undefined-calls.mjs
node tests/e2e/smoke.mjs
```

## Lotes aplicados

Los mapeos viven en `tools/deobf/batches/`. Son la documentación exacta de la
transformación: 74 funciones.

### batch-1 — núcleo de foco, teclado y escalado

`rt`→`setFocus`, `ot`→`findFirstFocusable`, `ut`→`handleKeyDown`,
`oo`→`applyViewportScale`, `wt`→`schedulePosterLoad`, `Ph`→`serviceCallHttp`,
`ct`→`handleBackKey`, `ga`→`buildCatalogRail`, `Va`→`renderSettingsScreen`,
`Ca`→`renderDetailScreen`

### batch-2 — inicio, secciones y diagnóstico

`so`→`bootstrapApp`, `gt`→`renderHomeScreen`, `ya`→`renderSectionRows`,
`Ja`→`renderNetworkDiagnostics`, `Za`→`runDiagnostics`, `Zt`→`openUpdateDialog`,
`da`→`renderAddonPresets`

### batch-3 — panel de canales y reproductor

`Qt`→`renderLiveChannelRow`, `hr`→`renderLiveChannelList`,
`Gt`→`loadLiveCategory`, `pr`→`openPlayerCategoryPicker`,
`dr`→`renderPlayerCategories`, `Rn`→`renderPlayerEpisodes`,
`Ga`→`layerVerdictLabel`, `Qa`→`isLayerOk`

### batch-4 — utilidades del bundle

`e`→`createEl`, `t`→`byId`, `a`→`removeAllChildren`, `i`→`placeAbsolute`,
`n`→`closestMatch`, `r`→`pad2`, `o`→`normalizeText`, `m`→`toArray`,
`g`→`configUrl`, `y`→`readSession`, `b`→`hasSession`, `C`→`authParams`,
`w`→`isRemoteUrl`, `S`→`orDefault`, `x`→`isMovieItem`

### batch-5 — catálogo y almacenamiento

`L`→`mergeCatalogItems`, `T`→`normalizeCatalogItem`, `U`→`ensureDetailLoaded`,
`P`→`serviceCall`, `O`→`indexCatalogById`, `q`→`refreshCatalog`,
`V`→`loadCatalog`, `I`→`hasServiceBridge`, `c`→`seedDemoCatalog`,
`H`→`mergeItemFields`, `k`→`parseSeasonFromTitle`, `Z`→`toggleFavorite`,
`D`→`rememberLastStream`, `N`→`loadPortalSnapshot`, `J`→`readJsonStorage`,
`R`→`fallbackToBundledCatalog`, `K`→`writeJsonStorage`, `M`→`bundledCatalog`,
`Y`→`savePlaybackState`

### batch-6 — pantallas y paneles

`Wt`→`scheduleHomePreview`, `Pa`→`runSearch`, `jn`→`loadEpisodesPanel`,
`za`→`renderAccountPanel`, `ha`→`filterByCategory`, `ja`→`renderHistoryPanel`,
`st`→`ensureValidFocus`, `fa`→`renderBentoCard`, `ir`→`renderCodecToggle`,
`ca`→`loadAddonChannels`, `ao`→`renderPlayerInfoBar`, `Na`→`renderSearchResults`,
`Wa`→`renderAddonsPanel`, `Rr`→`scheduleSearch`, `bt`→`selectHomeTab`

## Lo que queda sin nombrar (a propósito)

**Zona protegida de reproducción.** AGENTS.md prohíbe tocar el camino de
reproducción sin autorización explícita. Estas funciones se dejan como están:

| Símbolo | Líneas | Qué hace |
|---|---|---|
| `Gr` | 441 | Arranque de TV en vivo y watchdog de Modo Fluido |
| `lr` | 348 | Montaje del reproductor (stage, infobar, paneles) |
| `Qr` | 153 | Resolución de título a stream (Normal / Modo Fluido) |
| `Bn` | 119 | Preparación del ítem VOD antes de reproducir |
| `Qn` | 83 | Fin de reproducción VOD y avance de episodio |
| `to` | 83 | Reconexión de señal en vivo |
| `zr` | 79 | Cierre del reproductor y aborto del stream |

**Resto.** 132 funciones de dos letras (~20 % de las líneas) sin evidencia
suficiente en el inventario para nombrarlas sin inventar. Se pueden abordar por
demanda: cuando haya que tocar una, se añade a un `batch-7.json` y se aplica el
mismo ciclo.

### Deuda conocida dentro de la zona protegida

Detectada al revisar temporizadores (F4). No se toca sin la frase
**"modificar reproducción"**:

- `lr()` monta un `setInterval(..., 2000)` que vigila el arranque del
  reproductor. No se guarda en ninguna variable ni se limpia: cada entrada al
  reproductor dejaba uno vivo. Con una reproducción por sesión no se nota;
  tras cambiar de título veinte veces, sí.
- `xe.onplay` reasigna `ni = setInterval(...)` sin limpiar el anterior, mismo
  patrón para el avance del VOD.

Ambos son acumulativos, no bloqueantes: el sistema sigue funcionando, pero la
memoria y el número de callbacks por segundo crecen con el uso.

## Regenerar el inventario

```bash
node tools/deobf/analyze.mjs > docs/engineering/legacy-inventory.json
node tools/deobf/analyze.mjs --top=20
```

El inventario trae, por función: línea, tamaño, llamadas internas, selectores,
cadenas de UI y un fragmento. Es la evidencia para nombrar la siguiente.
