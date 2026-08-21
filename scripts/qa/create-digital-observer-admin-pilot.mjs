import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOCAL_ENV = resolve(PROJECT_ROOT, ".env.qa-demo.local");
const REPORT = resolve(PROJECT_ROOT, "DIGITAL_OBSERVER_ADMIN_PILOT_ACCOUNT_RESULTS.md");
const CONFIRMATION = "I_UNDERSTAND_SYNTHETIC_DEMO_ONLY";
const allowProductionInfrastructure = process.argv.includes("--allow-production-infrastructure");

// Runtime infrastructure comes from .env.local; QA credentials fill only keys
// that are not already configured there.
for (const envFile of [".env.local", ".env.qa-demo.local"]) {
  const path = resolve(PROJECT_ROOT, envFile);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

if (process.env.QA_DEMO_USER_SETUP_CONFIRM !== CONFIRMATION) throw new Error("Synthetic demo setup confirmation is required.");
if (!["local", "demo", "staging", "pilot"].includes(String(process.env.QA_DEMO_ENVIRONMENT ?? "").toLowerCase())) throw new Error("A safe QA environment is required.");
if (process.env.VERCEL_ENV === "production" && !allowProductionInfrastructure) {
  throw new Error("Production infrastructure requires the explicit account-setup flag.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = String(process.env.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL ?? "").trim().toLowerCase();
if (!url || !serviceRole || !email.includes("@")) throw new Error("Supabase server configuration and QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL are required.");

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

function persistLocalCredential(key, value) {
  const original = existsSync(LOCAL_ENV) ? readFileSync(LOCAL_ENV, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(original) ? original.replace(pattern, line) : `${original.trimEnd()}\n${line}\n`;
  writeFileSync(LOCAL_ENV, next.replace(/^\n/, ""), { encoding: "utf8", mode: 0o600 });
  chmodSync(LOCAL_ENV, 0o600);
}

async function findUser() {
  let page = 1;
  while (true) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const found = result.data.users.find((user) => user.email?.toLowerCase() === email);
    if (found || result.data.users.length < 1000) return found ?? null;
    page += 1;
  }
}

let password = process.env.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD;
if (!password) {
  password = `${randomBytes(18).toString("base64url")}A7!`;
  persistLocalCredential("QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD", password);
}
persistLocalCredential("QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", email);

const existing = await findUser();
const attributes = {
  email,
  password,
  email_confirm: true,
  app_metadata: { ...(existing?.app_metadata ?? {}), digital_observer_admin: true, product: "digital_observer", qa_demo: true },
  user_metadata: { ...(existing?.user_metadata ?? {}), full_name: "[PILOT] מנהל תצפיתן", product: "digital_observer", account_type: "business", qa_demo: true }
};
const authResult = existing
  ? await supabase.auth.admin.updateUserById(existing.id, attributes)
  : await supabase.auth.admin.createUser(attributes);
if (authResult.error || !authResult.data.user) throw authResult.error ?? new Error("Observer admin user was not created.");
const user = authResult.data.user;

const profileResult = await supabase.from("profiles").upsert({
  id: user.id,
  email,
  username: email,
  full_name: "[PILOT] מנהל תצפיתן",
  role: "parent",
  active: true,
  is_demo: true,
  must_change_password: false,
  demo_batch_id: "digital-observer-admin-pilot"
}, { onConflict: "id" });
if (profileResult.error) throw profileResult.error;

const accountResult = await supabase.from("digital_observer_accounts").upsert({
  profile_id: user.id,
  account_type: "business",
  status: "active",
  onboarding_step: "complete",
  email_verified_at: new Date().toISOString(),
  billing_status: "payment_method_pending",
  metadata: { admin_scope: "digital_observer_only", synthetic: true, no_live_services: true },
  updated_at: new Date().toISOString()
}, { onConflict: "profile_id" });
if (accountResult.error) throw accountResult.error;

writeFileSync(REPORT, `# DIGITAL OBSERVER ADMIN PILOT ACCOUNT RESULTS\n\n- Account: ${existing ? "updated" : "created"}\n- Username: ${email}\n- Password printed: no\n- Password storage: ignored local QA environment only\n- Product scope: digital_observer_only\n- Gan Batuach global admin: no\n- Infrastructure source: ${process.env.VERCEL_ENV === "production" ? "production environment variables, account setup only" : "non-production environment variables"}\n- Live camera, AI, notifications, billing or emergency actions enabled: no\n- Expected route after deployment: /digital-observer/admin\n`, "utf8");
process.stdout.write(`Digital Observer pilot admin ${existing ? "updated" : "created"}. Credentials were not printed.\n`);
