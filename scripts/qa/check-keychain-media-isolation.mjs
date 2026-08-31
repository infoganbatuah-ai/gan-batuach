import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";
import { refreshDeviceCredentials } from "../../services/video-gateway/device-refresh.mjs";

const callbacks = [];
const store = createKeychainStore({ service: "synthetic", execute(command, args, options, callback) {
  assert.equal(command, "/usr/bin/security");
  assert.ok(options.timeout > 0 && options.timeout <= 5000);
  assert.ok(options.maxBuffer <= 65536);
  callbacks.push(callback);
} });
const pending = Array.from({ length: 10 }, () => store.read("device_cloud_base_url"));
assert.equal(callbacks.length, 1, "Concurrent claims must share an in-flight Keychain read");
const server = http.createServer((_req, res) => res.end("healthy"));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`, { signal: AbortSignal.timeout(2000) });
  assert.equal(await response.text(), "healthy", "Health must respond while Keychain is unresolved");
  callbacks.shift()(null, "synthetic-value");
  assert.deepEqual(await Promise.all(pending), Array(10).fill("synthetic-value"));
  const absent = store.read("absent"); callbacks.shift()({ code: 44 }, ""); assert.equal(await absent, "");
  const failed = store.read("blocked"); callbacks.shift()({ code: "ETIMEDOUT", message: "sensitive internal output" });
  await assert.rejects(failed, error => error.message === "Gateway Keychain operation unavailable");
  const secrets = new Map([["device_refresh_token", "a".repeat(43)]]);
  let durable = false;
  await refreshDeviceCredentials({
    gatewayId: "synthetic-gateway", cloudBaseUrl: "https://synthetic.invalid",
    readSecret: async key => secrets.get(key) || "",
    writeSecret: async (key, value) => { await new Promise(resolve => setTimeout(resolve, 5)); secrets.set(key, value); durable = true; },
    removeSecret: async key => { secrets.delete(key); },
    fetcher: async (_url, init) => {
      assert.ok(durable && secrets.has("device_refresh_pending"), "Persist recovery before issuing rotation");
      const payload = JSON.parse(init.body);
      return Response.json({ data: { rotation_protocol: 2, refresh_token: payload.next_refresh_token, access_token: "synthetic-access" } });
    }
  });
  assert.ok(!secrets.has("device_refresh_pending"));
  const implementation = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(implementation, /spawnSync|execFileSync/);
  for (const line of implementation.split("\n").filter(line => line.includes("keychainSecret("))) assert.ok(line.includes("await"), "Every Keychain read must be awaited asynchronously");
  const helper = readFileSync(new URL("../../services/video-gateway/keychain-store.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /node:fs|writeFile|console\./);
  console.log("Keychain media isolation PASS: real HTTP health during delayed reads, single-flight, bounded timeout, redacted failures and awaited durable refresh");
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
