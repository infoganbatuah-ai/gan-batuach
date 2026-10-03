import { createPush38tIngress } from "../../services/video-gateway/push38t-ota-ingress.mjs";

// The Home components share this host. Keep the qualification surface bound
// to loopback and require TLS even for local device-to-control-plane traffic.
const keyPath = process.env.PUSH38T_TLS_KEY_PATH;
const certPath = process.env.PUSH38T_TLS_CERT_PATH;
if (!keyPath || !certPath) throw new Error("QA_INGRESS_TLS_MATERIAL_REQUIRED");
const remoteResultToken = process.env.PUSH38T_REMOTE_RESULT_TOKEN || "";
const server = createPush38tIngress({ tls: { keyPath, certPath },
  remoteResultToken,
  onRemoteResult: result => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(),
    event: "PUSH38_REMOTE_CLIENT_RESULT", result })}\n`),
  onAudit: event => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`) });
server.listen(3101, "127.0.0.1", () => console.log(JSON.stringify({
  environment: "PUSH38T_QUALIFICATION", bind: "127.0.0.1:3101",
  transport: "HTTPS", surface: remoteResultToken ? "OTA_AND_REMOTE_PLAYBACK_QUALIFICATION" : "OTA_AUTHORIZATION_ONLY",
  publicExposure: false
})));
