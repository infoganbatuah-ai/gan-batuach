import { randomBytes } from "node:crypto";
import { existsSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const output = resolve(process.argv.find(value => value.startsWith("--output="))?.slice(9) || "");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output)) throw new Error("P38_REMOTE_RUNTIME_SECRET_PATH_INVALID");
writeFileSync(output, `${JSON.stringify({
  protocol: "observer-push38-remote-runtime-secrets-v1",
  cloud_discovery_secret: randomBytes(48).toString("base64url"),
  result_token: randomBytes(32).toString("base64url"),
  created_at: new Date().toISOString(),
  environment: "ISOLATED_HOME_QA"
})}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: "PASS", secret_location: "RESTRICTED_LOCAL_ONLY",
  values_logged: false, recurring_cost_introduced: false }));
