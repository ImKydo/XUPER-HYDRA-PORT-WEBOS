#!/usr/bin/env node
// tools/check/protected.mjs — verifica el contrato de AGENTS.md sobre el árbol real.
// Uso: node tools/check/protected.mjs [--verbose]
import { read, exists, json, mode, parse, walk, checker, APP_FIDELITY, SVC_DIR, SERVICE_FILES } from "./lib.mjs";

const c = checker("protected-contract");

/* ---------- 1. App: camino de reproducción ---------- */
const app = read(`${APP_FIDELITY}/js/app.js`);

c.assert(
  "P01.resolveSmooth",
  "app.js invoca resolveSmooth (Modo Fluido)",
  /resolveSmooth/.test(app)
);
c.assert(
  "P02.forceRelay",
  "app.js define y usa forceRelay",
  /forceRelay/.test(app)
);
c.assert(
  "P03.relay-url",
  "app.js reconoce la URL local del relay :8787/s/",
  /:8787\/s\//.test(app)
);
c.assert(
  "P04.watchdog",
  "app.js tiene watchdog de arranque en vivo (clearLiveStallWatch)",
  /LiveStallWatch/.test(app),
  "AGENTS.md lo llama relayStartWatch; el nombre real es clearLiveStallWatch"
);
c.assert(
  "P05.live-recover",
  "app.js recupera errores de vivo sin hacer seek",
  /function liveRecoverFromError/.test(app)
);
c.assert(
  "P06.no-live-latency-guard",
  "liveLatencyGuard no altera currentTime (stub inocuo)",
  /function liveLatencyGuard\([^)]*\)\s*\{\s*return;\s*\}/.test(app)
);

/* ---------- 2. Servicio: rutas y relay ---------- */
const idx = read(`${SVC_DIR}/index.js`);
c.assert("P07.resolve-method", "index.js registra resolveSmooth", /resolveSmooth/.test(idx));
c.assert("P08.relay-register", "index.js llama relay.register", /relay\.register/.test(idx));

const proxy = read(`${SVC_DIR}/proxy.js`);
c.assert("P09.doh-first", "proxy.js resuelve IP por DoH antes de conectar", /resolveHostIp/.test(proxy));
c.assert("P10.sni-real", "proxy.js usa SNI real (servername)", /servername/.test(proxy));
c.assert("P11.cachefly", "proxy.js conserva camuflaje cachefly.net", /cachefly\.net/.test(proxy));
c.assert("P12.hls-seq", "proxy.js renumera EXT-X-MEDIA-SEQUENCE", /hlsSeqMap/.test(proxy));
c.assert("P13.hls-start", "proxy.js mantiene EXT-X-START en 24/7", /EXT-X-START/.test(proxy));

const dnsx = read(`${SVC_DIR}/dnsx.js`);
// dnsx.js se conecta por IP con SNI (no por hostname), así que los proveedores
// se cuentan por su campo sni:.
const dohHosts = new Set((dnsx.match(/sni:\s*"([^"]+)"/g) || []).map((s) => s.replace(/sni:\s*"|"/g, "")));
c.assert(
  "P14.doh-pool",
  `dnsx.js mantiene >=4 resolutores DoH independientes (hay ${dohHosts.size})`,
  dohHosts.size >= 4,
  [...dohHosts].join(", ")
);

const relay = read(`${SVC_DIR}/ffmpeg-relay.js`);
c.assert(
  "P15.ffmpeg-deferred",
  "autotest de ffmpeg diferido con setTimeout (no bloquea el primer ping)",
  /setTimeout\(\s*function\s*\([^)]*\)\s*\{\s*ensureExecutable\(/.test(relay)
);

const magis = read(`${SVC_DIR}/magis.js`);
c.assert("P16.seed-rescue", "magis.js conserva rescate de semillas (portal100024)", /portal100024/.test(magis));
c.assert("P17.seed-pool", "magis.js cachea pool de semillas en /tmp", /xuper-seeds\.json/.test(magis));

/* ---------- 3. services.json ---------- */
const svc = json(`${SVC_DIR}/services.json`);
const cmds = svc.services.flatMap((s) => s.commands || []);
const publics = cmds.filter((x) => x.public !== false);
c.assert(
  "P18.cmds-private",
  `services.json declara ${cmds.length} comandos, todos public:false`,
  cmds.length > 0 && publics.length === 0,
  publics.map((x) => x.name).join(", ")
);

/* ---------- 4. Compatibilidad ES5 del servicio ---------- */
const es5Files = SERVICE_FILES.filter((f) => exists(`${SVC_DIR}/${f}`));
const es5Errors = [];
const blockFns = [];
for (const f of es5Files) {
  try {
    const ast = parse(read(`${SVC_DIR}/${f}`), f);
    // FunctionDeclaration sólo es válida en ES5 si cuelga del Program o del
    // cuerpo (body) de otra función. V8 3.28 rechaza el resto.
    const fnBodies = new Set();
    walk(ast, (node) => {
      if (
        (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
        node.body
      ) {
        fnBodies.add(node.body);
      }
    });
    walk(ast, (node, parent) => {
      if (node.type !== "FunctionDeclaration") return;
      if (parent && parent.type === "Program") return;
      if (parent && parent.type === "BlockStatement" && fnBodies.has(parent)) return;
      blockFns.push(`${f}:${node.loc.start.line} ${node.id ? node.id.name : "(anónima)"}`);
    });
  } catch (err) {
    es5Errors.push(err.message);
  }
}
c.assert(
  "P19.es5",
  `los ${es5Files.length} .js del servicio parsean como ES5`,
  es5Errors.length === 0,
  es5Errors.join(" | ")
);
c.assert(
  "P20.no-block-fn",
  "sin declaraciones function dentro de bloques (V8 3.28)",
  blockFns.length === 0,
  blockFns.slice(0, 8).join(" | ")
);

/* ---------- 5. Paridad de versión ---------- */
const appinfo = json(`${APP_FIDELITY}/appinfo.json`);
const pkg = json(`${SVC_DIR}/package.json`);
const appVer = (app.match(/var APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
const html = read(`${APP_FIDELITY}/index.html`);
const htmlVer = (html.match(/js\/app\.js\?v=([\w.-]+)/) || [])[1];

c.assert(
  "P21.version-parity",
  "appinfo == package.json == APP_VERSION",
  appinfo.version === pkg.version && pkg.version === appVer,
  `${appinfo.version} / ${pkg.version} / ${appVer}`
);
c.assert(
  "P22.cache-buster",
  "index.html carga app.js con ?v= igual a APP_VERSION",
  htmlVer === appVer,
  `index.html=${htmlVer} APP_VERSION=${appVer}`
);

/* ---------- 6. Empaquetado ---------- */
const loads = (html.match(/src="js\/app\.js/g) || []).length;
c.assert("P23.single-app-js", "index.html carga app.js exactamente una vez", loads === 1, `${loads}`);
const RELEASE = process.argv.includes("--release");
const ffmpegOk = exists(`${SVC_DIR}/ffmpeg`) && (mode(`${SVC_DIR}/ffmpeg`) & 0o111) !== 0;
if (RELEASE) {
  c.assert(
    "P24.ffmpeg-bit",
    "ffmpeg presente y ejecutable (obligatorio para empaquetar)",
    ffmpegOk,
    "restaurar con tools/setup-ffmpeg antes de compilar el IPK"
  );
} else {
  ffmpegOk
    ? c.ok("P24.ffmpeg-bit", "ffmpeg presente y ejecutable")
    : c.warn(
        "P24.ffmpeg-bit",
        "ffmpeg ausente en este clon (normal: está gitignored)",
        "el IPK lo restaura con tools/setup-ffmpeg"
      );
}

process.exit(c.report());
