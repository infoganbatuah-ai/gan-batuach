import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env.qa-demo.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !publishableKey) {
  throw new Error("Missing server-side Supabase configuration.");
}

function maskEmail(email = "") {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "<missing>";
  return `${name.slice(0, Math.min(2, name.length))}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: publishableKey }
});
if (!settingsResponse.ok) {
  throw new Error(`Could not read public Auth settings (${settingsResponse.status}).`);
}
const authSettings = await settingsResponse.json();

const users = [];
for (let page = 1; page <= 10; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

const recentObserverUsers = users
  .filter((user) => user.user_metadata?.product === "digital_observer")
  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  .slice(0, 12)
  .map((user) => ({
    email: maskEmail(user.email),
    created_at: user.created_at,
    email_confirmed: Boolean(user.email_confirmed_at),
    confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    account_type: user.user_metadata?.account_type ?? "unknown",
    product: user.user_metadata?.product ?? "unknown"
  }));

const recentUsers = users
  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  .slice(0, 12)
  .map((user) => ({
    email: maskEmail(user.email),
    created_at: user.created_at,
    email_confirmed: Boolean(user.email_confirmed_at),
    product: user.user_metadata?.product ?? "unknown",
    account_type: user.user_metadata?.account_type ?? "unknown",
    identity_count: user.identities?.length ?? 0
  }));

const recentUnconfirmedUsers = users
  .filter((user) => !user.email_confirmed_at)
  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  .slice(0, 12)
  .map((user) => ({
    email: maskEmail(user.email),
    created_at: user.created_at,
    product: user.user_metadata?.product ?? "unknown",
    account_type: user.user_metadata?.account_type ?? "unknown"
  }));

console.log(JSON.stringify({
  checked_at: new Date().toISOString(),
  public_auth_settings: {
    email_provider_enabled: Boolean(authSettings.external?.email),
    email_autoconfirm: Boolean(authSettings.mailer_autoconfirm),
    signup_disabled: Boolean(authSettings.disable_signup)
  },
  total_auth_users: users.length,
  recent_auth_users: recentUsers,
  recent_digital_observer_users: recentObserverUsers,
  recent_unconfirmed_users: recentUnconfirmedUsers,
  interpretation: recentObserverUsers.some((user) => !user.email_confirmed)
    ? "SIGNUP_REACHED_SUPABASE_EMAIL_DELIVERY_NOT_CONFIRMED"
    : "NO_RECENT_UNCONFIRMED_DIGITAL_OBSERVER_USER_FOUND"
}, null, 2));
