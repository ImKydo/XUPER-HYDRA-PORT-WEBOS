# Gestión del repositorio en GitHub

## Permisos reales (2026-11-26)

```bash
gh api repos/cristianco7/XUPER-HYDRA-PORT-WEBOS --jq .permissions
# {"admin":false,"maintain":false,"pull":true,"push":false,"triage":false}
```

No hay permiso de escritura sobre el upstream y no existe un fork propio. Todo
lo de esta página que toca el remoto **requiere** una de estas dos cosas:

1. un fork (`gh repo fork cristianco7/XUPER-HYDRA-PORT-WEBOS --clone=false`), o
2. acceso del mantenedor.

Mientras tanto, las plantillas y el script de etiquetas viven en el repo y se
activan solos en cuanto se publique en un fork.

## Etiquetas

`.github/labels.json` define 11 etiquetas. Para crearlas:

```bash
node tools/github/labels.mjs --repo=<owner/repo> --dry-run   # ver qué haría
node tools/github/labels.mjs --repo=<owner/repo>             # crear
```

Salida esperada con permiso: `etiquetas: 11 creadas, 0 ya existían, 0 fallaron`.
Sin permiso: `11 fallaron` y salida 1.

Criterio de triaje:

| Situación | Etiqueta |
|---|---|
| Falla algo que antes funcionaba | `bug` |
| Solo en un modelo o firmware concreto | `bug` + `webos-3` / `webos-4-5` |
| Vídeo, Modo Fluido o TV en vivo | `reproduccion` (zona protegida: no tocar sin autorización) |
| Foco, navegación, textos | `interfaz` |
| `ping` falla, `denied`, "el servicio no arrancó" | `servicio` |
| Depende del portal o del CDN | `bloqueado-externo` |
| Sin modelo de TV o sin diagnóstico | `no-reproducible` |

## Ramas muertas

18 de las 19 ramas son `feature/*` o `release/*` ya fusionadas. Cuando haya
permiso de escritura, borrarlas deja el repo en `main` + `seeds`:

```bash
git fetch --prune origin
for b in $(git branch -r --merged origin/main \
           | grep -vE 'origin/(main|seeds|HEAD)' \
           | sed 's|origin/||'); do
  echo "borrando $b"
  git push origin --delete "$b"
done
```

Verificación: `gh api repos/<owner>/<repo>/branches --jq 'length'` → `2`.

## Releases

Regla del proyecto (AGENTS.md §6): el `.ipk` se entrega **antes** de etiquetar y
la Release solo se crea con confirmación explícita del usuario. El
`version.json` debe llevar versión, `ipkUrl`, `sha256` y changelog, y el sha256
debe coincidir con el artefacto construido (`node tools/build-ipk.mjs`).
