import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const checked = name => {
  const path = realpathSync(resolve(option(name)));
  if (!path.startsWith(restricted) || (statSync(path).mode & 0o077) !== 0)
    throw new Error(`P38_REMOTE_INGRESS_${name.toUpperCase().replace(/-/g, "_")}_UNSAFE`);
  return path;
};
const secretPath = checked("runtime-secrets");
const keyPath = checked("tls-key");
const certPath = checked("tls-cert");
const secrets = JSON.parse(readFileSync(secretPath, "utf8"));
if (secrets.protocol !== "observer-push38-remote-runtime-secrets-v1" ||
  !/^[A-Za-z0-9_-]{43}$/.test(secrets.result_token || ""))
  throw new Error("P38_REMOTE_INGRESS_SECRET_INVALID");
const sessionOption = option("session");
let remoteResultExpiresAt = Date.now() + 20 * 60_000;
if (sessionOption) {
  const sessionPath = checked("session");
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const exactExpiresAt = new Date(session.expires_at).getTime();
  if (session.protocol !== "observer-push38-remote-phone-payload-v1" ||
    session.config?.r !== secrets.result_token || !Number.isFinite(exactExpiresAt) ||
    exactExpiresAt <= Date.now() || exactExpiresAt > Date.now() + 20 * 60_000)
    throw new Error("P38_REMOTE_INGRESS_SESSION_INVALID");
  process.env.PUSH38T_REMOTE_SESSION_PATH = sessionPath;
  remoteResultExpiresAt = exactExpiresAt;
}
process.env.PUSH38T_REMOTE_RESULT_TOKEN = secrets.result_token;
process.env.PUSH38T_REMOTE_RESULT_EXPIRES_AT = String(remoteResultExpiresAt);
process.env.PUSH38T_TLS_KEY_PATH = keyPath;
process.env.PUSH38T_TLS_CERT_PATH = certPath;
await import("./start-push38t-ingress.mjs");
