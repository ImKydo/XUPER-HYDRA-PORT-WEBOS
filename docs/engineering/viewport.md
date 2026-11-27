# Escala de pantalla y webOS 3 (issue #18)

## Cómo se calcula hoy

`applyViewportScale()` en `src/legacy/app.legacy.js`:

1. Toma `innerWidth`/`innerHeight` (la superficie que webOS concede al webview).
2. `scale = min(ancho / 1920, alto / 1080)`.
3. Si el usuario eligió **Compatibilidad HD** (`Q.uiScaleMode === "hd"`) y el
   ancho es mayor que 1280, multiplica por `2/3`.
4. Centra el lienzo con `left`/`top` y aplica `transform: scale()`.
5. Publica `window.__xuperViewport = { w, h, scale, uiScaleMode, panelW, panelH }`.

El panel físico (`screen.width/height`) se usa **solo como dato**: escalar con
él rompería televisores 4K que reportan dpr 2 (el lienzo se dibujaría a
3840×2160 y quedaría recortado).

## El dato que probablemente explica el issue #18

`webos/fidelity/appinfo.json` declara:

```json
"resolution": "1280x720"
```

Es decir, la app **pide** una superficie de 1280×720. Sobre ella dibuja un
lienzo de 1920×1080 con `scale = 1280/1920 = 0.6667`. En un televisor que
reescala esa superficie a su panel, el resultado se ve correcto y con menos
memoria (importante en TVs de 1 GB, ver PR #24). En un televisor que **no** la
reescala —el caso reportado en el issue #18, LG 55LH6000 con webOS 3.4— la app
aparece ocupando 2/3 de la pantalla con negro alrededor.

Conclusión: el síntoma "2/3" no es un bug de JavaScript, es la combinación de
`resolution: 1280x720` y un compositor que no reescala. Cambiarlo a
`"1920x1080"` daría un lienzo nativo en paneles FHD, a cambio de más memoria y
más trabajo de GPU en los televisores más lentos. **No se cambia a ciegas.**

## Cómo diagnosticarlo con datos

Ajustes → Diagnóstico muestra ahora una fila **Pantalla**:

```
Pantalla    1920x1080 · panel 1920x1080    escala 0.6667    modo auto
```

Con esos cuatro números la decisión es determinista:

| `inner` vs `panel` | Diagnóstico | Arreglo |
|---|---|---|
| `inner=1280`, `panel=1920` | webOS da 720p y no la reescala | Declarar `resolution: "1920x1080"` en `appinfo.json`, o asumir 720p |
| `inner=1920`, `panel=1920`, `escala=0.6667` | El modo HD está activo | Desactivarlo en Ajustes → Pantalla |
| `inner=1920`, `panel=1920`, `escala=1` | El lienzo ya es 1:1 | Es CSS: `#app` mal centrado |
| `inner=1280`, `panel=1280` | El panel reporta 720p | No es la app |

## Estado

- Instrumentación: **hecha** (fila en Diagnóstico, verificada en Chromium).
- Decisión y cambio de `resolution`: **pendiente de datos de un TV webOS 3.4**.
  Sin una captura real, cambiar la resolución puede arreglar un televisor y
  empeorar el rendimiento de todos los demás.

## Cómo probar un cambio aquí

1. Instalar el IPK en el televisor afectado.
2. Abrir Ajustes → Diagnóstico y fotografiar la fila Pantalla.
3. Comparar con la tabla de arriba.
4. Si toca cambiar `resolution`, actualizar `appinfo.json`, recompilar
   (`node tools/build-ipk.mjs`) y repetir la medición en **ese** televisor y en
   uno moderno antes de publicar.
