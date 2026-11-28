import { createServer, request } from "node:http";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { createQaPilotServer } from "./qa-pilot-server.mjs";

const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
export const qaPilotMediaRoute = /^\/qa\/[A-Za-z0-9_-]{1,80}\/(general|ch1)\/[A-Za-z0-9_-]{1,80}\/(?:index\.m3u8|segment-[0-9]{1,12}\.ts)\?r=[A-Za-z0-9_-]{43}$/;
const safeHeaders = ["content-type", "content-length", "cache-control", "referrer-policy", "x-observer-qa-build"];

export function createQaPilotRuntime({ manifest, gateway, connector, audit, ...options } = {}) {
  if (options.enabled !== true || options.environment !== "isolated-qa" || !manifest ||
      manifest.kind !== "observer-qa-pilot-v1" || !sha.test(manifest.candidateSha || "") ||
      !Array.isArray(manifest.registry) || typeof audit !== "function") throw new Error("QA_RUNTIME_DISABLED");

  const candidateSha = manifest.candidateSha;
  const readers = Object.freeze({ PHYSICAL_GATEWAY: gateway, SOFTWARE_CONNECTOR: connector });
  const gatewayReads = new Map();
  for (const row of manifest.registry) {
    const reader = readers[row.profile];
    if (!reader || reader.environment !== "isolated-qa" || reader.gatewayId !== row.gatewayId ||
        !digest.test(row.releaseDigest || "") || reader.releaseDigest !== row.releaseDigest ||
        typeof reader.read !== "function" || (row.route === "ch1" && typeof reader.readCh1 !== "function")) {
      throw new Error("QA_RUNTIME_READER_MISMATCH");
    }
    gatewayReads.set(row.sourceId, Object.freeze({
      binding: Object.freeze({ ...row }),
      read: row.route === "ch1" ? reader.readCh1.bind(reader) : reader.read.bind(reader)
    }));
  }

  function readMedia(input, route) {
    const target = gatewayReads.get(input.sourceId);
    if (!target || target.binding.route !== route ||
        !["siteId", "gatewayId", "streamId", "profile"].every(key => input.binding[key] === target.binding[key])) {
      throw new Error("QA_RUNTIME_SOURCE_DENIED");
    }
    return target.read({ ...input, binding: target.binding });
  }
  const budget = createQaPilotServer({
    ...options, candidateSha, registry: manifest.registry,
    readGeneral: input => readMedia(input, "general"),
    readCh1: input => readMedia(input, "ch1")
  });

  let media;
  return Object.freeze({
    workerId: budget.workerId,
    authorize: budget.authorize,
    async listen({ issuerPort = 0, mediaPort = 0 } = {}) {
      if (media) throw new Error("QA_RUNTIME_ALREADY_STARTED");
      const internal = budget.listen(issuerPort);
      try {
        await once(internal, "listening");
        const internalPort = internal.address().port;
        media = createServer({ requestTimeout: 5_000, headersTimeout: 5_000 }, async (incoming, response) => {
          // Fixed event fields only: no URL, query, headers, source IDs or upstream error.
          let outcome = "denied";
          const fail = () => {
            if (response.headersSent) response.destroy();
            else response.writeHead(404, { "cache-control": "no-store" }).end();
          };
          try {
            if (incoming.method !== "GET" || incoming.headers.range || !qaPilotMediaRoute.test(incoming.url || "")) {
              fail();
              return;
            }
            const upstream = request({ host: "127.0.0.1", port: internalPort, path: incoming.url,
              method: "GET", timeout: 5_000 });
            upstream.on("timeout", () => upstream.destroy());
            response.once("close", () => upstream.destroy());
            const pending = once(upstream, "response");
            upstream.end();
            const [body] = await pending;
            if (body.statusCode !== 200 || body.headers["x-observer-qa-build"] !== candidateSha) {
              body.destroy();
              fail();
              return;
            }
            const headers = Object.fromEntries(safeHeaders.flatMap(key => body.headers[key] ? [[key, body.headers[key]]] : []));
            response.writeHead(200, headers);
            await pipeline(body, response);
            outcome = "served";
          } catch { fail(); }
          finally { try { audit({ event: "qa_media_response", outcome }); } catch { /* No sensitive fallback log. */ } }
        });
        media.listen(mediaPort, "127.0.0.1");
        await once(media, "listening");
        return { issuerPort: internalPort, mediaPort: media.address().port };
      } catch (error) {
        budget.close();
        media?.close();
        throw error;
      }
    },
    close() {
      budget.close();
      media?.close();
      media?.closeAllConnections();
    }
  });
}
