import { readFileSync } from "node:fs";

const runner = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install-persistent-home-gateway.mjs", import.meta.url), "utf8");

for (const required of ["GAN_BATUACH_GATEWAY_DISCOVERY", "crypto.randomBytes(32)", "await waitForGateway();"]) {
  if (!runner.includes(required)) throw new Error(`Missing health-only gateway control: ${required}`);
}
if (!installer.includes('GAN_BATUACH_GATEWAY_DISCOVERY</key><string>0')) {
  throw new Error("Persistent Gateway must default to health-only mode");
}
if (runner.indexOf("await waitForGateway();") > runner.indexOf('await discoverWithRetry("initial")')) {
  throw new Error("Gateway discovery must not run before health readiness");
}

console.log("Persistent Gateway health-only QA PASS");
