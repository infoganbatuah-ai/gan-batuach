import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = mkdtempSync(join(tmpdir(), "push38-media-ingress-"));
const gatewayHost = "gateway-media-homeqa.ganbatuach.com";
const connectorHost = "connector-media-homeqa.ganbatuach.com";
const keyPath = join(temporary, "key.pem"), certPath = join(temporary, "cert.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
  "-subj", "/CN=gateway-media-homeqa.ganbatuach.com",
  "-addext", `subjectAltName=DNS:${gatewayHost},DNS:${connectorHost}`, "-keyout", keyPath, "-out", certPath],
{ stdio: "ignore" });

const fake = label => createHttpServer((request, response) => {
  response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ label, path: request.url,
    private_source_hidden: true,
    playback: { hls_url: `http://127.0.0.1:${label === "gateway" ? gateway.address().port : connector.address().port}/hls/stream/index.m3u8?token=${"a".repeat(32)}` } }));
});
const gateway = fake("gateway"), connector = fake("connector");
for (const server of [gateway, connector]) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }
const reservation = createHttpServer();
reservation.listen(0, "::1");
await once(reservation, "listening");
const port = reservation.address().port;
reservation.close();
await once(reservation, "close");

const child = spawn(process.execPath, ["scripts/qa/start-push38-https-playback-ingress.mjs",
  `--gateway-host=${gatewayHost}`, `--connector-host=${connectorHost}`, `--port=${port}`,
  "--bind-address=::1",
  `--tls-key=${keyPath}`, `--tls-cert=${certPath}`,
  "--browser-origin=https://gateway.ganbatuach.com",
  `--gateway-origin=http://127.0.0.1:${gateway.address().port}`,
  `--connector-origin=http://127.0.0.1:${connector.address().port}`], { stdio: ["ignore", "pipe", "pipe"] });
const ready = await Promise.race([
  once(child.stdout, "data"),
  new Promise((_, reject) => setTimeout(() => reject(new Error("HTTPS_INGRESS_START_TIMEOUT")), 5_000))
]);
assert.match(String(ready[0]), /observer-push38-https-playback-ingress-v1/);
const request = (host, path, method = "GET", body = "") => new Promise((resolve, reject) => {
  const outgoing = httpsRequest({ hostname: "::1", port, servername: host, rejectUnauthorized: false,
    method, path, headers: { host: `${host}:${port}`, origin: "https://gateway.ganbatuach.com",
      ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}) } }, response => {
    const chunks = [];
    response.on("data", chunk => chunks.push(chunk));
    response.on("end", () => resolve({ status: response.statusCode,
      headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
  });
  outgoing.on("error", reject);
  if (body) outgoing.write(body);
  outgoing.end();
});
try {
  const gatewayClaim = await request(gatewayHost, "/playback/claim", "POST", '{"grant":"test"}');
  assert.equal(gatewayClaim.status, 200);
  assert.equal(gatewayClaim.headers["access-control-allow-origin"], "https://gateway.ganbatuach.com");
  assert.equal(JSON.parse(gatewayClaim.body).playback.hls_url,
    `https://${gatewayHost}:${port}/hls/stream/index.m3u8?token=${"a".repeat(32)}`);
  const connectorClaim = await request(connectorHost, "/playback/claim", "POST", '{"grant":"test"}');
  assert.equal(connectorClaim.status, 200);
  assert.equal(JSON.parse(connectorClaim.body).playback.hls_url,
    `https://${connectorHost}:${port}/hls/stream/index.m3u8?token=${"a".repeat(32)}`);
  assert.equal((await request(gatewayHost, "/admin")).status, 404);
  assert.equal((await request("foreign.ganbatuach.com", "/playback/claim", "POST", '{"grant":"test"}')).status, 404);
  assert.equal((await request(gatewayHost, "/hls/stream/index.m3u8")).status, 404);
  console.log("PUSH 38 HTTPS playback ingress QA PASS");
} finally {
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 2_000))]);
  gateway.close(); connector.close();
  rmSync(temporary, { recursive: true, force: true });
}
