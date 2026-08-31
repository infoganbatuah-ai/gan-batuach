import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { runInNewContext } from "node:vm";

const code = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const payload = Buffer.alloc(256 * 1024, 0x47);
const streams = [];
const metrics = { hlsRequests: 0, hlsPlaylists: 0, hlsSegments: 0, hlsUnauthorized: 0, hlsRangeRequests: 0 };
const serve = runInNewContext(`${code.slice(code.indexOf("async function serveHls("), code.indexOf("async function cameraTest("))}; serveHls`, {
  URL, encodeURIComponent, normalize, join, extname,
  requestMetrics: metrics, validatePlaybackToken: () => true,
  relayDirectory: () => "/synthetic", existsSync: () => true, statSync: () => ({ size: payload.length }),
  browserHeaders: (_request, type) => ({ "content-type": type }),
  browserJson: (_request, response, status, body) => { response.writeHead(status); response.end(JSON.stringify(body)); },
  createReadStream: () => {
    const stream = Readable.from((async function* () {
      for (let i = 0; i < payload.length; i += 8192) { await delay(2); yield payload.subarray(i, i + 8192); }
    })());
    streams.push(stream);
    return stream;
  }
});
const server = http.createServer((request, response) => {
  // A fully consumed GET is not an aborted response, including middleware that
  // drains IncomingMessage before asynchronously producing its response body.
  if (request.headers["x-drain-request"] === "1") request.resume();
  void serve(request, response).catch(() => response.destroy());
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const read = ({ drain = false, abort = false } = {}) => new Promise((resolve) => {
  let bytes = 0, settled = false;
  const finish = (complete) => { if (!settled) { settled = true; resolve({ bytes, complete }); } };
  const request = http.get({ hostname: "127.0.0.1", port: server.address().port, path: "/hls/one/segment-1.ts?token=synthetic", headers: { "x-drain-request": drain ? "1" : "0" } }, (response) => {
    response.on("data", (chunk) => { bytes += chunk.length; if (abort) request.destroy(); });
    response.on("end", () => finish(response.complete));
    response.on("error", () => finish(false));
    response.on("close", () => finish(response.complete));
  });
  request.setTimeout(1200, () => request.destroy());
  request.on("error", () => finish(false));
  request.on("close", () => finish(false));
});
try {
  for (const drain of [false, true]) {
    const result = await read({ drain });
    assert.equal(result.complete, true, `Completed request drain=${drain} must not truncate HLS response`);
    assert.equal(result.bytes, payload.length);
  }
  const results = await Promise.all([read({ abort: true }), ...Array.from({ length: 10 }, () => read({ drain: true }))]);
  assert.equal(results[0].complete, false);
  assert.equal(results.slice(1).every((r) => r.complete && r.bytes === payload.length), true, "An abandoned segment must not interrupt other viewers");
  await delay(20);
  assert.equal(streams.every((stream) => stream.destroyed), true, "All completed/abandoned streams must release their readers");
  assert.equal(metrics.hlsSegments, 13);
  assert.equal(metrics.hlsUnauthorized, 0);
  assert.equal(Object.values(metrics).every(Number.isFinite), true);
  console.log("Actual HTTP HLS response lifetime, completed-request safety and abandoned-client isolation PASS");
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  for (const stream of streams) stream.destroy();
}
