import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

// Run under `vercel env run`: credentials exist only in process memory.
// Never print, persist, provision, rotate or transfer any credential.
const local = {};
for (const name of [".env.qa-demo.local", ".env.local"]) {
  const file = resolve(process.env.DIGITAL_GUARD_QA_CONFIG_DIR ?? process.cwd(), name);
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) if (!local[key]) local[key] = value;
}
const expected = new URL(local.NEXT_PUBLIC_SUPABASE_URL).origin;
const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log(`Authenticated database URL present: ${Boolean(configured)}`);
if (configured) {
  const hostname = new URL(configured).hostname;
  console.log(`Authenticated project ref: ${hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : "non-Supabase-host"}`);
}
if (!configured) {
  console.log("BLOCKED: database URL is absent or not exportable from the authenticated environment");
  process.exit(2);
}
if (new URL(configured).origin !== expected) {
  console.log("BLOCKED: authenticated environment does not match the configured QA database");
  process.exit(2);
}
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) { console.log("BLOCKED: server credential absent in authenticated environment"); process.exit(2); }
let privileged = secret.startsWith("sb_secret_");
try { privileged ||= JSON.parse(Buffer.from(secret.split(".")[1] ?? "", "base64url").toString()).role === "service_role"; } catch { /* Not a JWT. */ }
if (!privileged) { console.log("BLOCKED: credential is not a server credential"); process.exit(2); }
try {
  const headers = { apikey: secret };
  if (!secret.startsWith("sb_secret_")) headers.Authorization = `Bearer ${secret}`;
  const response = await fetch(`${expected}/rest/v1/observer_sites?select=id&limit=0`, { headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
  console.log(`QA project match: yes; server credential validation HTTP: ${response.status}`);
  console.log(`Command gateway configuration present: ${Boolean(process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_URL && process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_SECRET)}`);
  if (!response.ok) process.exitCode = 1;
} catch {
  console.log("BLOCKED: credential validation request failed (details withheld)");
  process.exitCode = 1;
}
