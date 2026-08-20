import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.qa-demo.local", ".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));
const email = String(args.get("email") || "").trim().toLowerCase();
const confirmation = String(args.get("confirm") || "");
const appEnvironment = String(args.get("environment") || "").toLowerCase();

if (!email || !email.includes("@")) throw new Error("An exact --email is required.");
if (confirmation !== `DELETE:${email}`) throw new Error("Explicit --confirm=DELETE:<exact-email> is required.");
if (!["local", "demo", "staging", "pilot"].includes(appEnvironment)) throw new Error("Explicit --environment=local|demo|staging|pilot is required. Production is refused.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Server-only Supabase admin configuration is required.");

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
let page = 1;
let target = null;
while (!target) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error("Could not read the Supabase test-user inventory.");
  target = data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
  if (target || data.users.length < 200) break;
  page += 1;
}
if (!target) throw new Error("No Auth user matched the exact email.");

const [{ data: account }, { data: sites }] = await Promise.all([
  admin.from("digital_observer_accounts").select("profile_id").eq("profile_id", target.id).maybeSingle(),
  admin.from("observer_sites").select("id").eq("owner_profile_id", target.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1)
]);
const isObserverTestUser = target.user_metadata?.product === "digital_observer" || Boolean(account || sites?.length);
if (!isObserverTestUser) throw new Error("Refusing deletion: the account is not identified as a Digital Observer user.");

const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
if (deleteError) throw new Error("Supabase rejected the test-user deletion.");
process.stdout.write("Deleted the exact Digital Observer test user. No password or secret was printed.\n");
