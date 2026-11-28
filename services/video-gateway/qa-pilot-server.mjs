import { createServer } from "node:http";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createQaPilotCoordinator } from "./qa-pilot-budget.mjs";

const mediaPath = /^\/qa\/([A-Za-z0-9_-]{1,80})\/(general|ch1)\/([A-Za-z0-9_-]{1,80})\/(index\.m3u8|segment-[0-9]{1,12}\.ts)$/;

// Intended only behind an authenticated QA transport. No default executable,
// production upstream, or HTTP endpoint that can create or approve a run.
export function createQaPilotServer(options) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("QA_PILOT_PRODUCTION_DENIED");
  }
  const coordinator = createQaPilotCoordinator(options);
  let run;
  const fail = (response, status) => {
    if (!response.headersSent) response.writeHead(status, { "cache-control": "no-store" }).end();
    else response.destroy();
  };
  const server = createServer(async (request, response) => {
    const match = mediaPath.exec(request.url || "");
    const authorization = request.headers.authorization;
    if (!run || request.method !== "GET" || !match || !authorization ||
        !/^Bearer [A-Za-z0-9_.~-]{1,2048}$/.test(authorization) || request.headers.range) {
      fail(response, 404);
      return;
    }
    const [, runId, path, sourceId, object] = match;
    try {
      await run.playback({ session: authorization.slice(7), runId, path, sourceId, object,
        deliver: async (body, { signal }) => {
          signal.throwIfAborted();
          response.writeHead(200, {
            "cache-control": "no-store",
            "content-length": body.length,
            "content-type": object === "index.m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t"
          });
          await pipeline(Readable.from([body]), response, { signal });
        }
      });
    } catch { fail(response, 404); }
  });
  server.on("close", () => run?.stop());
  return Object.freeze({
    workerId: coordinator.workerId,
    async authorize(credential) { run = await coordinator.open(credential); },
    listen(port = 0) { return server.listen(port, "127.0.0.1"); },
    close() { run?.stop(); server.close(); server.closeAllConnections(); }
  });
}
