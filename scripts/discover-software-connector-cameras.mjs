import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { connectorCloudRequest, softwareConnectorSecretStore } from "../services/video-gateway/software-connector-cloud.mjs";

const timeoutMs = 450;
const concurrency = 32;

function localSubnets() {
  const prefixes = new Set();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== "IPv4" || address.internal) continue;
      const parts = address.address.split(".").map(Number);
      const privateAddress = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
      if (privateAddress) prefixes.add(parts.slice(0, 3).join("."));
    }
  }
  return [...prefixes].slice(0, 2);
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function probe(host) {
  const onvif = await portOpen(host, 2020);
  if (!onvif) return null;
  const [rtsp, https] = await Promise.all([portOpen(host, 554), portOpen(host, 443)]);
  if (!rtsp) return null;
  return { host, vendor: process.env.OBSERVER_CONNECTOR_DISCOVERY_VENDOR === "tapo" ? "tapo" : "generic", model: process.env.OBSERVER_CONNECTOR_DISCOVERY_MODEL || undefined, protocols: ["RTSP", "ONVIF", ...(https ? ["HTTPS"] : [])], rtsp_port: 554, onvif_port: 2020 };
}

const hosts = localSubnets().flatMap((prefix) => Array.from({ length: 253 }, (_, index) => `${prefix}.${index + 2}`));
if (!hosts.length) throw new Error("CONNECTOR_PRIVATE_NETWORK_NOT_FOUND");
const candidates = [];
for (let offset = 0; offset < hosts.length; offset += concurrency) {
  const found = (await Promise.all(hosts.slice(offset, offset + concurrency).map(probe))).filter(Boolean);
  candidates.push(...found);
  if (candidates.length >= 32) break;
}
if (!candidates.length) throw new Error("CONNECTOR_CAMERA_NOT_FOUND");
const store = softwareConnectorSecretStore();
const gatewayId = store.read("device_gateway_id");
const observerSiteId = store.read("device_observer_site_id");
const result = await connectorCloudRequest("/api/digital-observer/software-connector", {
  method: "POST",
  body: JSON.stringify({ action: "publish_discovery", gateway_id: gatewayId, observer_site_id: observerSiteId, candidates: candidates.slice(0, 32) })
}, store);
console.log(JSON.stringify({ status: "DISCOVERED", count: result.data?.candidates?.length || 0, credentials_printed: false, private_addresses_printed: false }));
