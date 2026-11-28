import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createQaPilotCoordinator } from "./qa-pilot-budget.mjs";

const mediaPath = /^\/qa\/([A-Za-z0-9_-]{1,80})\/(general|ch1)\/([A-Za-z0-9_-]{1,80})\/(index\.m3u8|segment-[0-9]{1,12}\.ts)$/;
const segment = /^(?:\/ch1\/)?(segment-[0-9]{1,12}\.ts)$/;
const mediaTag = /^(?:#EXTM3U|#EXT-X-(?:VERSION|TARGETDURATION|MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE):\d+|#EXT-X-(?:ENDLIST|DISCONTINUITY|INDEPENDENT-SEGMENTS)|#EXTINF:\d+(?:\.\d+)?,)$/;
const receiptQuery = /^r=([A-Za-z0-9_-]{43})$/;
const receiptMs = 30_000;
const commitPattern = /^[a-f0-9]{40}$/;
const opaqueId = /^[A-Za-z0-9_-]{1,80}$/;

function rewritePlaylist(body, segmentUrl) {
  if (body.length > 64 * 1024) throw new Error("QA_PLAYLIST_DENIED");
  const lines = body.toString("utf8").split(/\r?\n/).filter(Boolean);
  if (lines[0] !== "#EXTM3U" || !lines.some(line => segment.test(line))) throw new Error("QA_PLAYLIST_DENIED");
  return Buffer.from(lines.map(line => {
    const match = segment.exec(line);
    if (match) return segmentUrl(match[1]);
    if (mediaTag.test(line)) return line;
    throw new Error("QA_PLAYLIST_DENIED");
  }).join("\n") + "\n");
}

// The trusted operator authenticates and issues manifests out of band.
// A player needs only the resulting short-lived URL. No origin redirects.
export function createQaPilotServer(options) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("QA_PILOT_PRODUCTION_DENIED");
  }
  const { candidateSha, registry } = options ?? {};
  if (!commitPattern.test(candidateSha ?? "") || !Array.isArray(registry) || registry.length !== 11) {
    throw new Error("QA_PILOT_REGISTRY_REQUIRED");
  }
  const bindings = new Map(registry.map(({ sourceId, siteId, gatewayId, streamId, profile, route }) => {
    if (![sourceId, siteId, gatewayId, streamId].every(value => typeof value === "string" && opaqueId.test(value)) ||
        !["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(profile) || !["general", "ch1"].includes(route) ||
        (route === "ch1" && profile !== "PHYSICAL_GATEWAY")) throw new Error("QA_PILOT_REGISTRY_INVALID");
    return [sourceId, Object.freeze({ sourceId, siteId, gatewayId, streamId, profile, route })];
  }));
  if (bindings.size !== 11 || new Set([...bindings.values()].map(x => x.siteId)).size !== 1 ||
      [...bindings.values()].filter(x => x.route === "ch1").length !== 1 ||
      [...bindings.values()].filter(x => x.profile === "SOFTWARE_CONNECTOR").length !== 1) {
    throw new Error("QA_PILOT_REGISTRY_INVALID");
  }
  const coordinator = createQaPilotCoordinator({
    ...options,
    async verifyApproval(credential) {
      const approval = await options.verifyApproval(credential);
      if (approval?.candidateSha !== candidateSha || !Array.isArray(approval.sources) ||
          approval.sources.length !== bindings.size || approval.sources.some(sourceId => {
            const row = bindings.get(sourceId);
            return !row || row.siteId !== approval.siteId || (row.route === "ch1") !== (approval.ch1 === sourceId);
          })) return null;
      return approval;
    },
    readGeneral(input) { return options.readGeneral({ ...input, binding: bindings.get(input.sourceId) }); },
    readCh1(input) { return options.readCh1({ ...input, binding: bindings.get(input.sourceId) }); }
  });
  const secret = randomBytes(32);
  const now = options?.now ?? Date.now;
  let run;
  let activeReceipt;
  const fail = (response, status) => {
    if (!response.headersSent) response.writeHead(status, { "cache-control": "no-store" }).end();
    else response.destroy();
  };
  function sign(path, receipt) {
    return createHmac("sha256", secret).update(receipt.nonce + "\n" + receipt.exp + "\n" + path).digest("base64url");
  }
  function href(path, receipt) { return `${path}?r=${sign(path, receipt)}`; }
  const server = createServer(async (request, response) => {
    const [pathname, search, extra] = (request.url || "").split("?");
    const match = mediaPath.exec(pathname);
    const token = receiptQuery.exec(search || "");
    const receipt = activeReceipt;
    if (!run || !receipt || !match || !token || extra !== undefined || request.method !== "GET" ||
        request.headers.range || now() < receipt.issued || now() >= receipt.exp ||
        !pathname.startsWith(receipt.prefix) ||
        !timingSafeEqual(Buffer.from(sign(pathname, receipt)), Buffer.from(token[1]))) {
      fail(response, 404);
      return;
    }
    const [, runId, path, sourceId, object] = match;
    try {
      await run.playback({ session: receipt.session, runId, path, sourceId, object,
        prepare: object === "index.m3u8" ? body => rewritePlaylist(body,
          filename => href(receipt.prefix + filename, receipt)) : undefined,
        deliver: async (body, { signal }) => {
          signal.throwIfAborted();
          if (receipt !== activeReceipt || now() >= receipt.exp) throw new Error("QA_RECEIPT_EXPIRED");
          response.writeHead(200, {
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "x-observer-qa-build": candidateSha,
            "content-length": body.length,
            "content-type": object === "index.m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t"
          });
          await pipeline(Readable.from([body]), response, { signal: AbortSignal.any([signal, receipt.controller.signal]) });
        }
      });
    } catch { fail(response, 404); }
  });
  function revokeReceipt() {
    if (!activeReceipt) return;
    clearTimeout(activeReceipt.timer);
    activeReceipt.controller.abort();
    activeReceipt = undefined;
  }
  function stop() { revokeReceipt(); run?.stop(); }
  server.on("close", stop);
  return Object.freeze({
    workerId: coordinator.workerId,
    async authorize(credential) { run = await coordinator.open(credential); },
    async issueManifest({ session, runId, sourceId, path, expectedSha } = {}) {
      if (!run || expectedSha !== candidateSha) throw new Error("QA_PILOT_DENIED");
      await run.permit({ session, runId, sourceId, path });
      const issued = now();
      const prefix = `/qa/${runId}/${path}/${sourceId}/`;
      revokeReceipt();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), receiptMs);
      timer.unref();
      activeReceipt = { session, issued, exp: issued + receiptMs, prefix,
        nonce: randomBytes(16).toString("hex"), controller, timer };
      return href(prefix + "index.m3u8", activeReceipt);
    },
    listen(port = 0) { return server.listen(port, "127.0.0.1"); },
    close() { stop(); server.close(); server.closeAllConnections(); }
  });
}
