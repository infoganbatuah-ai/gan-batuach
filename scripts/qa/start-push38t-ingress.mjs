import { createPush38tIngress } from "../../services/video-gateway/push38t-ota-ingress.mjs";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

// The Home components share this host. Keep the qualification surface bound
// to loopback and require TLS even for local device-to-control-plane traffic.
const keyPath = process.env.PUSH38T_TLS_KEY_PATH;
const certPath = process.env.PUSH38T_TLS_CERT_PATH;
if (!keyPath || !certPath) throw new Error("QA_INGRESS_TLS_MATERIAL_REQUIRED");
const remoteResultToken = process.env.PUSH38T_REMOTE_RESULT_TOKEN || "";
const remoteResultExpiresAt = Number(process.env.PUSH38T_REMOTE_RESULT_EXPIRES_AT || 0);
const remoteSessionPath = process.env.PUSH38T_REMOTE_SESSION_PATH || "";
let remoteSession = null;
if (remoteSessionPath) {
  const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
  const path = realpathSync(resolve(remoteSessionPath));
  const info = lstatSync(path);
  if (!path.startsWith(restricted) || !info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0)
    throw new Error("PUSH38T_REMOTE_SESSION_UNSAFE");
  const payload = JSON.parse(readFileSync(path, "utf8"));
  const expiresAt = new Date(payload.expires_at).getTime();
  if (payload.protocol !== "observer-push38-remote-phone-payload-v1" ||
    !/^[A-Za-z0-9_-]{22}$/.test(payload.session_id || "") || !Number.isFinite(expiresAt) ||
    expiresAt !== remoteResultExpiresAt || payload.config?.r !== remoteResultToken)
    throw new Error("PUSH38T_REMOTE_SESSION_INVALID");
  remoteSession = { session_id: payload.session_id, expires_at_ms: expiresAt, config: payload.config };
}
const server = createPush38tIngress({ tls: { keyPath, certPath },
  remoteResultToken, remoteResultExpiresAt, remoteSession,
  onRemoteResult: result => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(),
    event: "PUSH38_REMOTE_CLIENT_RESULT", result })}\n`),
  onAudit: event => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`) });
server.listen(3101, "127.0.0.1", () => console.log(JSON.stringify({
  environment: "PUSH38T_QUALIFICATION", bind: "127.0.0.1:3101",
  transport: "HTTPS", surface: remoteResultToken && remoteResultExpiresAt > Date.now()
    ? "DEVICE_CONTROL_OTA_AND_REMOTE_PLAYBACK_QUALIFICATION" : "DEVICE_CONTROL_AND_OTA_AUTHORIZATION",
  publicExposure: false
})));
