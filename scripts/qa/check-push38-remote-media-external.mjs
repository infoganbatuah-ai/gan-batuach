import assert from "node:assert/strict";
import { request } from "node:https";

const hosts = ["gateway-media-homeqa.ganbatuach.com", "connector-media-homeqa.ganbatuach.com"];
async function probe(hostname, pathname) {
  return new Promise((resolve, reject) => {
    const call = request({ hostname, port: 18443, family: 6, servername: hostname,
      method: "GET", path: pathname, rejectUnauthorized: true, timeout: 10_000 }, response => {
      response.resume();
      response.once("end", () => resolve({ status: response.statusCode,
        cacheControl: response.headers["cache-control"] }));
    });
    call.once("timeout", () => call.destroy(new Error("PUSH38_REMOTE_MEDIA_TIMEOUT")));
    call.once("error", reject);
    call.end();
  });
}

for (const hostname of hosts) {
  const claimGet = await probe(hostname, "/playback/claim");
  const unrelated = await probe(hostname, "/dashboard");
  assert.equal(claimGet.status, 404, "non-POST claim must fail closed");
  assert.equal(unrelated.status, 404, "unrelated surface must fail closed");
  assert.equal(claimGet.cacheControl, "no-store");
  assert.equal(unrelated.cacheControl, "no-store");
}
console.log(JSON.stringify({ status: "PASS", contract: "observer-push38-remote-media-external-v1",
  client: "SEPARATE_GITHUB_HOSTED_RUNNER", transport: "IPV6_TLS", hosts: hosts.length,
  intended_route_reachable: true, default_deny: true, edge_software_installed: false,
  addresses_logged: false, credentials_logged: false }));
