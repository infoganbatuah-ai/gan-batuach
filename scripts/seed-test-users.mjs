import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;

  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["\']|["\']$/g, "");
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

if (supabaseUrl.includes("sample.supabase.co") || supabaseUrl.includes("your-project")) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL to your real Supabase project URL before seeding users");
}

if (serviceRoleKey.includes("your-service") || serviceRoleKey.includes("replace-with")) {
  throw new Error("Set SUPABASE_SERVICE_ROLE_KEY to your real Supabase service role key before seeding users");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const seedUsers = [
  { email: "admin@ganbatuach.com", passwordEnv: "SEED_ADMIN_PASSWORD", role: "admin", fullName: "אדמין גן בטוח" },
  { email: "inspector@ganbatuach.com", passwordEnv: "SEED_INSPECTOR_PASSWORD", role: "inspector", fullName: "פקח בדיקות" },
  { email: "manager@ganbatuach.com", passwordEnv: "SEED_MANAGER_PASSWORD", role: "manager", fullName: "מנהלת גן" },
  { email: "parent@ganbatuach.com", passwordEnv: "SEED_PARENT_PASSWORD", role: "parent", fullName: "הורה בדיקה" },
  { email: "staff@ganbatuach.com", passwordEnv: "SEED_STAFF_PASSWORD", role: "staff", fullName: "איש צוות בדיקה" }
];

async function findUserByEmail(email) {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertAuthUser(seedUser) {
  const existingUser = await findUserByEmail(seedUser.email);
  const password = process.env[seedUser.passwordEnv];

  if (!password) {
    throw new Error(`Missing ${seedUser.passwordEnv} for ${seedUser.email}`);
  }

  const attributes = {
    email: seedUser.email,
    password,
    email_confirm: true,
    app_metadata: { role: seedUser.role },
    user_metadata: { full_name: seedUser.fullName }
  };

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, attributes);
    if (error) throw error;
    return { user: data.user, action: "updated" };
  }

  const { data, error } = await supabase.auth.admin.createUser(attributes);
  if (error) throw error;
  return { user: data.user, action: "created" };
}

async function upsertProfile(user, seedUser) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role: seedUser.role,
      full_name: seedUser.fullName,
      active: true,
      must_change_password: false
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

for (const seedUser of seedUsers) {
  const { user, action } = await upsertAuthUser(seedUser);
  await upsertProfile(user, seedUser);
  console.log(`${action}: ${seedUser.email} (${seedUser.role})`);
}

console.log("Seed test users are ready.");
