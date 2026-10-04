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
process.env.PUSH38T_REMOTE_RESULT_TOKEN = secrets.result_token;
process.env.PUSH38T_REMOTE_RESULT_EXPIRES_AT = String(Date.now() + 20 * 60_000);
process.env.PUSH38T_TLS_KEY_PATH = keyPath;
process.env.PUSH38T_TLS_CERT_PATH = certPath;
await import("./start-push38t-ingress.mjs");
