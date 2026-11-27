import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";
import { probeLocalHealth } from "./soak-health-probe.mjs";

const devices = [
  { name: "recorder", port: 18082, type: "PHYSICAL_GATEWAY", expected: 10 },
  { name: "standalone", port: 18083, type: "SOFTWARE_CONNECTOR", expected: 1 }
];

function qaListener() {
  return new Promise(resolve => {
    const socket = createConnection({ host: "127.0.0.1", port: 3101 });
    const finish = status => { socket.destroy(); resolve(status); };
    socket.once("connect", () => finish("listening"));
    socket.once("error", error => finish(error.code === "ECONNREFUSED" ? "refused" : "unknown"));
    socket.setTimeout(2000, () => finish("unknown"));
  });
}

export async function observeHomeReporting({
  probe = port => probeLocalHealth(port, {
    fetchImpl: (url, options) => fetch(url, { ...options, redirect: "error" })
  }),
  listener = qaListener, now = Date.now
} = {}) {
  const [listenerStatus, ...samples] = await Promise.all([listener(), ...devices.map(d => probe(d.port))]);
  const at = now();
  const blockers = [];
  if (listenerStatus !== "listening") blockers.push("qa_listener_" + listenerStatus);
  const components = devices.map(({ name, type, expected }, i) => {
    const { http_status, body } = samples[i];
    const valid = http_status === 200 && body?.contract === "observer-edge-health-v1"
      && body.edgeRuntime?.device_type === type && Math.abs(at - Date.parse(body.observed_at)) <= 15000;
    if (!valid) {
      blockers.push(name + "_missing_fresh_health");
      return { name, health: "unverified" };
    }
    const authorization = ["ready", "unavailable", "approval_required"].includes(body.deviceAuthorization?.status)
      ? body.deviceAuthorization.status : "unknown";
    const count = body.mediaHeartbeat?.progressingRelays;
    const progressing = Number.isSafeInteger(count) && count >= 0 ? count : null;
    if (authorization !== "ready") blockers.push(name + "_authorization_" + authorization);
    if (progressing !== expected || body.ok !== true) blockers.push(name + "_local_health_incomplete");
    return { name, authorization, progressing, expected };
  });
  // Even a good local sample proves neither a successful server-side write nor remote playback.
  return { observed_at: new Date(at).toISOString(), qa_control_listener: listenerStatus,
    components, blockers, product_source_update: "not_observed", iphone_playback: "not_observed" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await observeHomeReporting();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.blockers.length ? 1 : 0;
}
