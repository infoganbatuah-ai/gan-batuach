// Non-authenticating, read-only TCP reachability check for the installed DVR.
// Never emits the private endpoint or credential material.
import { connect, isIP } from "node:net";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";

const store = createKeychainStore({ service: "com.ganbatuach.video-gateway.runtime" });
const profile = JSON.parse(await store.read("dvr_profile_json"));
const endpoint = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`);
const host = endpoint.hostname.replace(/^\[|\]$/g, "");
const port = Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80));
const pieces = host.split(".").map(Number);
const localV4 = isIP(host) === 4 && pieces.length === 4 && pieces.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
  (pieces[0] === 10 || (pieces[0] === 172 && pieces[1] >= 16 && pieces[1] <= 31) ||
    (pieces[0] === 192 && pieces[1] === 168));
if (!localV4 || !Number.isInteger(port) || port < 1 || port > 65535 ||
  !["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password)
  throw new Error("P38_DVR_PRIVATE_TRANSPORT_TARGET_REQUIRED");
const started = Date.now();
const result = await new Promise(resolve => {
  const socket = connect({ host, port });
  socket.setTimeout(2500);
  socket.once("connect", () => { socket.destroy(); resolve("TCP_REACHABLE"); });
  socket.once("timeout", () => { socket.destroy(); resolve("TCP_TIMEOUT"); });
  socket.once("error", error => { socket.destroy(); resolve(["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(error.code)
    ? error.code : "TCP_ERROR"); });
});
console.log(JSON.stringify({ protocol: "observer-push38-dvr-private-transport-probe-v1",
  observed_at: new Date().toISOString(), result, elapsed_ms: Date.now() - started,
  scope: "TCP_ONLY_NO_AUTH_NO_VIDEO_NO_CREDENTIAL_EXPORT" }));
