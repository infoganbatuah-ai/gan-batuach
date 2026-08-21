import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env.qa-demo.local"]) {
  const path = resolve(process.cwd(), envFile);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL;
const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "https://gan-batuach.vercel.app").replace(/\/$/, "");
if (!url || !key || !email) throw new Error("Supabase public configuration and observer admin email are required.");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const redirectTo = `${appUrl}/auth/callback`;
const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
if (result.error) throw result.error;
process.stdout.write("One-time Digital Observer admin password setup email requested. No credential was printed.\n");
