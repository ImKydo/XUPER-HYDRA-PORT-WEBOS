# Gestión del repositorio

## Repositorios

| Remoto | URL | Uso |
|---|---|---|
| `origin` | `github.com/ImKydo/XUPER-HYDRA-PORT-WEBOS` | **Nuestro repo.** Push, releases y gestión |
| `upstream` | `github.com/cristianco7/XUPER-HYDRA-PORT-WEBOS` | Solo lectura, como referencia. Push deshabilitado (`no_push`) |

Este proyecto es una **variación independiente** basada en el código de
`cristianco7`. No se envían PRs al original ni se participa de su gestión: su
`main` se consulta para cotejar fixes, nada más.

```bash
git remote -v
# origin    .../ImKydo/XUPER-HYDRA-PORT-WEBOS.git (fetch/push)
# upstream  .../cristianco7/XUPER-HYDRA-PORT-WEBOS.git (fetch)
# upstream  no_push (push)
```

## Ramas

El fork se limpió de 17 ramas `feature/*` y `release/*` ya fusionadas. Quedan:

| Rama | Para qué |
|---|---|
| `main` | Versión estable |
| `chore/calidad-v2` | Trabajo del plan v2 (actual) |
| `seeds` | Pool de semillas que usa `.github/workflows/seeds.yml` |

Los workflows no se ejecutan en un fork hasta habilitarlos a mano, así que el
minero de semillas está inactivo por ahora. Si se activa, consume minutos de
Actions y escribe en la rama `seeds`.

## Etiquetas

`.github/labels.json` define 11 etiquetas; ya están creadas en `origin`.

```bash
node tools/github/labels.mjs --repo=ImKydo/XUPER-HYDRA-PORT-WEBOS --dry-run
node tools/github/labels.mjs --repo=ImKydo/XUPER-HYDRA-PORT-WEBOS
# esperado: 0 creadas, 11 ya existían, 0 fallaron
```

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

## Releases

Regla del proyecto (AGENTS.md §6): el `.ipk` se entrega **antes** de etiquetar y
la Release solo se crea con confirmación explícita. `version.json` debe llevar
versión, `ipkUrl`, `sha256` y changelog, y el sha256 debe coincidir con
`node tools/build-ipk.mjs`.

Al publicar, recordar que el paquete mantiene el `id`
`com.webosflux.xuptertv.fidelity`: cambiarlo instala una app nueva al lado y el
usuario pierde favoritos e historial.
