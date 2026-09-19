import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { edgePlaybackOrigin, localPlaybackAllowed } from "../../lib/domain/digital-observer/edge-playback-origin.ts";
import { createPlaybackIngress, playbackIngressAllows } from "../../services/video-gateway/playback-ingress.mjs";

const gateway = "11111111-1111-4111-8111-111111111111";
const map = JSON.stringify({ [gateway]: "https://edge.example.test" });
assert.equal(edgePlaybackOrigin(gateway, map), "https://edge.example.test");
for (const invalid of ["http://edge.example.test", "https://127.0.0.1", "https://edge.example.test/other",
  "https://user:pass@edge.example.test", "https://edge.example.test:8443", "https://edge.example.test?x=1"])
  assert.equal(edgePlaybackOrigin(gateway, JSON.stringify({ [gateway]: invalid })), null);
assert.equal(edgePlaybackOrigin("22222222-2222-4222-8222-222222222222", map), null);
assert.equal(localPlaybackAllowed("https://ganbatuach.com/view", "development"), false);
assert.equal(localPlaybackAllowed("http://127.0.0.1:3100/view", "production"), false);
assert.equal(localPlaybackAllowed("http://127.0.0.1:3100/view", "development"), true);

const token = "a".repeat(32);
assert.equal(playbackIngressAllows("POST", "/playback/claim"), true);
assert.equal(playbackIngressAllows("GET", "/hls/stream/index.m3u8", `?token=${token}`), true);
for (const [method, path, search] of [["GET", "/", ""], ["GET", "/admin", ""],
  ["GET", "/api/video-gateway/edge-updates", ""], ["GET", "/hls/stream/index.m3u8", ""],
  ["GET", "/hls/stream/index.m3u8", `?token=${token}&next=/admin`], ["POST", "/hls/stream/index.m3u8", `?token=${token}`]])
  assert.equal(playbackIngressAllows(method, path, search), false);

const origin = createServer((request, response) => {
  if (request.url === "/playback/claim") response.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
  else response.writeHead(200, { "content-type": "video/mp2t" }).end("segment");
});
origin.listen(0, "127.0.0.1");
await once(origin, "listening");
const upstream = `http://127.0.0.1:${origin.address().port}`;
const ingress = createPlaybackIngress({ origin: upstream });
ingress.listen(0, "127.0.0.1");
await once(ingress, "listening");
try {
  const base = `http://127.0.0.1:${ingress.address().port}`;
  const claim = await fetch(`${base}/playback/claim`, { method: "POST", headers: { origin: "https://ganbatuach.com", "content-type": "application/json" }, body: '{"grant":"test"}' });
  assert.equal(claim.status, 200);
  assert.equal(claim.headers.get("cache-control"), "private, no-store");
  const media = await fetch(`${base}/hls/stream/segment-1.ts?token=${token}`);
  assert.equal(media.status, 200);
  assert.equal(await media.text(), "segment");
  assert.equal((await fetch(`${base}/admin`)).status, 404);
  assert.equal((await fetch(`${base}/hls/stream/segment-1.ts?token=${token}&x=1`)).status, 404);
} finally {
  ingress.close(); origin.close();
}
console.log("Remote playback boundary QA PASS (isolated; no live tunnel or device)");
