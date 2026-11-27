// Local HTTP harness for the webOS service modules (desktop verification only).
// Mirrors the Luna methods so the web app can be exercised in Chromium / TV browser.
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseQuery } from "./helpers/dev-service-query.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svcDir = path.resolve(__dirname, "..", "webos", "services", "com.webosflux.xuptertv.fidelity.service");
const magis = require(path.join(svcDir, "magis.js"));
const proxy = require(path.join(svcDir, "proxy.js"));
const dnsx = require(path.join(svcDir, "dnsx.js"));
const netdiag = require(path.join(svcDir, "netdiag.js"));
const tvplus = require(path.join(svcDir, "tvplus.js"));

const PORT = Number(process.argv[2] || 8910);

const json = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json;charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  // La app llama ?q=<json>; los curl del README usan query plano. Ambas valen.
  const Q = parseQuery(req.url);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    });
    res.end();
    return;
  }
  const done = (err, data) => (err ? json(res, 502, { returnValue: false, errorText: String(err.message || err), errorCode: err.portalCode || 1 }) : json(res, 200, { returnValue: true, ...data }));

  // `version` imita lo que devuelve el servicio del televisor (index.js:355).
  // SERVICE_VERSION permite simular un servicio viejo que responde "v3.1.86",
  // el caso que disparaba el falso "SERVICIO DESACTUALIZADO" (issue #22).
  const svcVersion = process.env.SERVICE_VERSION || require(path.join(svcDir, "package.json")).version;
  if (u.pathname === "/ping") return json(res, 200, { returnValue: true, port: PORT, proxy: proxy.port(), version: svcVersion });
  if (u.pathname === "/home") return magis.home(Q.root || "movies", done);
  if (u.pathname === "/search") return magis.search(Q.value || "", done);
  if (u.pathname === "/detail") {
    return magis.detail(Q.contentId || Q.id || "", done);
  }
  if (u.pathname === "/resolve") {
    const contentId = Q.contentId || Q.id || "";
    const seriesId = Q.seriesContentId || Q.series || "";
    return magis.resolve(contentId, seriesId, (err, stream) => {
      if (err) return done(err);
      proxy.start((perr) => {
        if (perr) return done(perr);
        const isTs = (stream.mime === 'video/mp2t' || /\.ts(?:\?|$)/i.test(stream.url));
        const token = proxy.add(stream.url, stream.headers, stream.duration);
        if (isTs) {
          stream.proxyPath = proxy.baseUrl() + '/media/' + token + '/stream.m3u8';
          stream.mime = 'application/vnd.apple.mpegurl';
          stream.isHls = true;
        } else {
          stream.proxyPath = proxy.baseUrl() + '/media/' + token + '/stream.mp4';
        }
        done(null, stream);
      });
    });
  }
  if (u.pathname === "/liveCategories") {
    return magis.getLiveCategories((err, categories) => done(err, { categories }));
  }
  if (u.pathname === "/liveChannels") {
    return magis.getLiveChannels(Q.columnId || null, (err, channels) => done(err, { channels }));
  }
  if (u.pathname === "/resolveLive") {
    const streamUrl = Q.streamUrl || "";
    const channelCode = Q.channelCode || "";
    // Igual que index.js: los canales "tvplus:" se resuelven por tvplus.js y se
    // sirven a través del proxy con IP fijada por DoH (no con el DNS del equipo).
    const tvCode = /^tvplus:/i.test(streamUrl)
      ? streamUrl.replace(/^tvplus:/i, "")
      : /^tvplus:/i.test(channelCode)
        ? channelCode.replace(/^tvplus:/i, "")
        : "";
    const serveLive = (stream) => {
      proxy.start((perr) => {
        if (perr) return done(perr);
        const host = String(stream.url || "").replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];
        const is247 = /24[\s\/-]?7/i.test(String(stream.name || channelCode || ""));
        const startWithIp = (ip) => {
          const token = proxy.add(stream.url, stream.headers || {}, 0, ip, null, true, is247);
          done(null, {
            url: stream.url,
            headers: stream.headers || {},
            proxyPath: proxy.baseUrl() + "/media/" + token + "/stream.m3u8",
            isHls: true,
          });
        };
        if (!host) return startWithIp("");
        dnsx.resolve(host, (der, dr) => startWithIp((dr && dr.ips && dr.ips[0]) || ""));
      });
    };
    if (tvCode) {
      return tvplus.resolve(tvCode, (err, tvRes) => {
        if (err || !tvRes || !tvRes.url) {
          if (channelCode && !/^tvplus:/i.test(channelCode)) {
            return magis.resolveLive(channelCode, (e2, s2) => (e2 ? done(e2) : serveLive(s2)));
          }
          return done(err || new Error("Señal TvPlus no disponible: " + tvCode));
        }
        serveLive(tvRes);
      }, { force: Q.force === "1" });
    }
    if (streamUrl) {
      // La URL directa del portal se deja tal cual en el arnés de escritorio
      // (Chrome no reproduce MPEG-TS a través del proxy, la TV sí).
      return done(null, { url: streamUrl, proxyPath: streamUrl, isHls: true });
    }
    return magis.resolveLive(channelCode, (err, stream) => (err ? done(err) : serveLive(stream)));
  }
  if (u.pathname === "/netdiag") {
    const hosts = (magis.constants.HOSTS || []).slice(0);
    dnsx.summary().forEach((entry) => {
      if (entry && entry.host && hosts.indexOf(entry.host) === -1) hosts.push(entry.host);
    });
    const screenW = Number(Q.screenW || 0);
    const screenH = Number(Q.screenH || 0);
    const screen = (screenW > 0 && screenH > 0)
      ? {
          w: screenW,
          h: screenH,
          scale: Number(Q.screenScale || 0),
          panelW: Number(Q.panelW || 0),
          panelH: Number(Q.panelH || 0)
        }
      : null;
    // Mirrors the Luna route in index.js so the desktop harness exercises the
    // same layer probes (portal/session/live/VOD) and codec rows.
    const jsonParam = (name) => {
      if (Q[name] && typeof Q[name] === "object") return Q[name];
      try { return JSON.parse(Q[name] || "{}") || {}; } catch { return {}; }
    };
    const portalHost = (magis.constants.HOSTS || [])[0] || "";
    const sess = magis.session || {};
    const layerOpts = {
      portalUrl: portalHost ? `https://${portalHost}/api/portalCore/v8/active` : "",
      session: { userId: sess.userId || "", userToken: sess.userToken || "", ready: !!sess.ready },
      liveUrl: Q.liveUrl || "",
      liveHeaders: jsonParam("liveHeaders"),
      vodUrl: Q.vodUrl || "",
      vodHeaders: jsonParam("vodHeaders"),
    };
    return netdiag.run({ hosts, screen }, (err, report) => {
      if (err) return done(err);
      netdiag.runLayers(layerOpts, (lerr, layers) => {
        report.layers = layers || {};
        /* El servicio del televisor adjunta su versión al informe (index.js);
           aquí se replica para poder probar la comparación del diagnóstico. */
        report.version = svcVersion;
        report.codec = {
          h264: Q.codecH264 || "",
          hevc: Q.codecHEVC || "",
          hls: Q.codecHLS || "",
        };
        done(null, report);
      });
    });
  }
  json(res, 404, { returnValue: false, errorText: "not found" });
});

proxy.start((err, p) => {
  if (err) { console.error("proxy error", err); process.exit(1); }
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`dev service running on http://127.0.0.1:${PORT} (media proxy on ${p})`);
  });
});
