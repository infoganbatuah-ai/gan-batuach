import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import https from "node:https";
import { X509Certificate } from "node:crypto";
import { inspectBundle, privateDirectory, privateFile, renewBundle, sha256 } from "./pilot-loopback-tls.mjs";

const options = Object.fromEntries(process.argv.slice(3).map(value => {
  const split = value.indexOf("=");
  if (!value.startsWith("--") || split < 3) throw new Error("TLS_SERVICE_ARGUMENT_INVALID");
  return [value.slice(2, split), value.slice(split + 1)];
}));
const root = privateDirectory(options.root || ".");
const config = JSON.parse(privateFile(join(root, "service.json")));
if (config.contract !== "observer-loopback-tls-service-v1" ||
  config.ingressLabel !== "com.ganbatuach.push38.remote-ingress" ||
  !/^[a-f0-9]{64}$/.test(config.ingressModuleSha256) ||
  !config.ingressModule.startsWith(`${root}/ingress-source/`) ||
  !Array.isArray(config.sourceFiles) || config.sourceFiles.length !== 5)
  throw new Error("TLS_SERVICE_CONFIG_INVALID");

function status(data) {
  const path = join(root, "status.json"), temporary = `${path}.${process.pid}.staging`;
  writeFileSync(temporary, JSON.stringify({ at: new Date().toISOString(), ...data }) + "\n",
    { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}

async function probe() {
  const expected = inspectBundle(root);
  return new Promise((resolveProbe, reject) => {
    const req = https.get({ hostname: "127.0.0.1", port: 3101,
      path: "/api/video-gateway/event-manifest", ca: privateFile(join(root, "issuer.crt")),
      rejectUnauthorized: true, agent: false, timeout: 5_000 }, response => {
      const peer = response.socket.getPeerCertificate();
      const cert = new X509Certificate(peer.raw);
      const file = new X509Certificate(privateFile(join(root, "server.crt")));
      response.resume();
      if (cert.fingerprint256 !== file.fingerprint256 || ![401, 403].includes(response.statusCode))
        reject(new Error("TLS_LIVE_PEER_OR_AUTH_BOUNDARY_INVALID"));
      else resolveProbe({ ...expected, liveStatus: response.statusCode, tlsVerified: true });
    });
    req.on("timeout", () => req.destroy(new Error("TLS_LIVE_PROBE_TIMEOUT")));
    req.on("error", reject);
  });
}

if (process.argv[2] === "serve") {
  // A sleeping host may miss every renewal window. Recover locally before
  // binding the HTTPS socket, without requiring an already-running ingress.
  renewBundle(root);
  inspectBundle(root);
  // Prevent booting with an unexpectedly changed QA ingress implementation.
  if (sha256(readFileSync(config.ingressModule)) !== config.ingressModuleSha256)
    throw new Error("TLS_INGRESS_SOURCE_CHANGED");
  for (const file of config.sourceFiles) {
    if (!file.path.startsWith(`${root}/ingress-source/`) || !/^[a-f0-9]{64}$/.test(file.sha256) ||
      sha256(privateFile(file.path)) !== file.sha256) throw new Error("TLS_INGRESS_DEPENDENCY_CHANGED");
  }
  const { createPush38tIngress } = await import(pathToFileURL(resolve(config.ingressModule)).href);
  // Existing control contracts are retained; no remote-phone session is issued.
  const server = createPush38tIngress({ tls: {
    keyPath: join(root, "server.key"), certPath: join(root, "server.crt") },
    onAudit: event => {
      if (event.status >= 500) process.stderr.write("QA_UPSTREAM_UNAVAILABLE\n");
    } });
  // The owner's incident authorization permits certificate recovery on the
  // current signed releases, not selecting or downloading another release.
  // Preserve the original update records while holding delivery locally.
  if (config.updateDeliveryHold !== true) throw new Error("TLS_UPDATE_HOLD_REQUIRED");
  const originalHandlers = server.listeners("request");
  server.removeAllListeners("request");
  server.on("request", (request, response) => {
    const path = new URL(request.url || "/", "https://127.0.0.1").pathname;
    if ((request.method === "GET" && path === "/api/video-gateway/edge-updates") ||
      path === "/api/video-gateway/edge-updates/download" ||
      path === "/api/video-gateway/home-qa-legacy-download") {
      request.resume();
      response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" })
        .end('{"error":"QA_UPDATE_MAINTENANCE_HOLD"}');
      return;
    }
    for (const handler of originalHandlers) handler.call(server, request, response);
  });
  process.on("SIGHUP", () => {
    try {
      const current = inspectBundle(root);
      server.setSecureContext({ key: privateFile(join(root, "server.key")),
        cert: privateFile(join(root, "server.crt")) });
      process.stdout.write(JSON.stringify({ event: "QA_TLS_CONTEXT_RELOADED", leafSha256: current.leafSha256 }) + "\n");
    } catch { process.stderr.write("QA_TLS_RELOAD_REJECTED\n"); }
  });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
  server.listen(3101, "127.0.0.1", () => process.stdout.write("QA_TLS_LOOPBACK_READY\n"));
} else if (process.argv[2] === "renew") {
  try {
    const reload = () => {
      const info = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${config.ingressLabel}`],
        { timeout: 5_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const pid = Number(/\bpid = (\d+)/.exec(info)?.[1]);
      if (!Number.isInteger(pid) || pid < 2) throw new Error("TLS_INGRESS_NOT_RUNNING");
      process.kill(pid, "SIGHUP");
    };
    const result = renewBundle(root, { reload });
    // Reconcile an earlier missed reload too, even when on-disk dates are fresh.
    if (!result.renewed) reload();
    // A host waking after certificate expiry renews before probing. Verify the
    // served peer and anonymous authorization boundary, not only on-disk dates.
    let live, last;
    for (let attempt = 0; attempt < 5; attempt++) {
      try { live = await probe(); break; } catch (error) { last = error; }
      await new Promise(done => setTimeout(done, 200));
    }
    if (!live) throw last;
    status({ state: "HEALTHY", renewed: result.renewed, ...live });
    process.stdout.write(JSON.stringify({ state: "HEALTHY", renewed: result.renewed,
      leafExpiresAt: result.leafExpiresAt }) + "\n");
  } catch (error) {
    const code = /^TLS_[A-Z_]+$/.test(error.message) ? error.message : "TLS_MAINTENANCE_FAILED";
    status({ state: "ACTION_REQUIRED", code });
    process.stderr.write(`${code}\n`); process.exitCode = 1;
  }
} else throw new Error("TLS_SERVICE_MODE_INVALID");
