import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "I_UNDERSTAND_SYNTHETIC_DEMO_ONLY";
const SAFE_ENVIRONMENTS = new Set(["local", "demo", "staging", "pilot"]);
const REPORT_PATH = "DEMO_AUTH_SETUP_1_SCRIPT_RESULTS.md";

for (const envFile of [".env.qa-demo.local", ".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function fail(message) {
  throw new Error(message);
}

if (process.env.QA_DEMO_USER_SETUP_CONFIRM !== CONFIRMATION) {
  fail(`Set QA_DEMO_USER_SETUP_CONFIRM=${CONFIRMATION} in an ignored local env file before running.`);
}

const qaEnvironment = String(process.env.QA_DEMO_ENVIRONMENT ?? "").toLowerCase();
if (!SAFE_ENVIRONMENTS.has(qaEnvironment)) {
  fail("QA_DEMO_ENVIRONMENT must be one of: local, demo, staging, pilot.");
}

if (qaEnvironment === "production" || process.env.VERCEL_ENV === "production") {
  fail("Refusing to create demo QA users in production.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side demo user setup.");
}
if (supabaseUrl.includes("sample.supabase.co") || supabaseUrl.includes("your-project") || serviceRoleKey.includes("replace-with")) {
  fail("Refusing to run with placeholder Supabase configuration.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const accounts = [
  {
    key: "parent",
    email: process.env.QA_DEMO_PARENT_EMAIL || "parent.1@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_PARENT_PASSWORD",
    role: "parent",
    fullName: "[DEMO] הורה QA",
    active: true,
    note: "Existing full demo seed normally provides linked child data."
  },
  {
    key: "manager",
    email: process.env.QA_DEMO_MANAGER_EMAIL || "manager.rakefet@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_MANAGER_PASSWORD",
    role: "manager",
    fullName: "[DEMO] מנהלת QA",
    active: true,
    note: "Existing full demo seed normally provides Kindergarten A assignment."
  },
  {
    key: "staff_assigned",
    email: process.env.QA_DEMO_STAFF_ASSIGNED_EMAIL || "staff.1@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_STAFF_ASSIGNED_PASSWORD",
    role: "staff",
    fullName: "[DEMO] צוות משויך QA",
    active: true,
    note: "Existing full demo seed normally provides Kindergarten A assignment."
  },
  {
    key: "staff_unassigned",
    email: process.env.QA_DEMO_STAFF_UNASSIGNED_EMAIL || "qa.staff.unassigned@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_STAFF_UNASSIGNED_PASSWORD",
    role: "staff",
    fullName: "[DEMO] צוות לא משויך QA",
    active: true,
    note: "Profile-only user. Must have no garden assignment for unassigned-state QA."
  },
  {
    key: "inspector_assigned",
    email: process.env.QA_DEMO_INSPECTOR_ASSIGNED_EMAIL || "inspector.yael@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_INSPECTOR_ASSIGNED_PASSWORD",
    role: "inspector",
    fullName: "[DEMO] מפקחת משויכת QA",
    active: true,
    note: "Existing full demo seed normally provides assigned gardens."
  },
  {
    key: "inspector_unassigned",
    email: process.env.QA_DEMO_INSPECTOR_UNASSIGNED_EMAIL || "qa.inspector.unassigned@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_INSPECTOR_UNASSIGNED_PASSWORD",
    role: "inspector",
    fullName: "[DEMO] מפקחת לא משויכת QA",
    active: false,
    note: "Profile-only user. Expected to reach pending/apply inspector state."
  },
  {
    key: "admin",
    email: process.env.QA_DEMO_ADMIN_EMAIL || "admin-demo@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_ADMIN_PASSWORD",
    role: "admin",
    fullName: "[DEMO] אדמין QA",
    active: true,
    note: "Existing full demo seed normally provides admin access."
  },
  {
    key: "digital_observer",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com",
    passwordEnv: "QA_DEMO_DIGITAL_OBSERVER_PASSWORD",
    role: "network_manager",
    fullName: "[DEMO] Digital Observer QA",
    active: true,
    note: "Creates a standalone observer site and owner membership when possible."
  }
];

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertAccount(account) {
  const password = process.env[account.passwordEnv];
  if (!password) {
    return { ...account, status: "SKIPPED_MISSING_LOCAL_PASSWORD", userId: null };
  }

  const existing = await findUserByEmail(account.email);
  const attributes = {
    email: account.email,
    password,
    email_confirm: true,
    app_metadata: { role: account.role, is_demo: true, qa_demo: true },
    user_metadata: { full_name: account.fullName, qa_demo: true }
  };
  const { data, error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attributes)
    : await supabase.auth.admin.createUser(attributes);
  if (error) throw error;
  const user = data.user;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    role: account.role,
    full_name: account.fullName,
    username: account.email,
    email: account.email,
    active: account.active,
    must_change_password: false,
    is_demo: true,
    garden_id: null,
    demo_batch_id: "qa-demo-role-access"
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  if (account.key === "digital_observer") {
    await ensureDigitalObserverSite(user.id);
  }

  return { ...account, status: existing ? "UPDATED" : "CREATED", userId: user.id };
}

async function ensureDigitalObserverSite(profileId) {
  const siteName = "[DEMO] Digital Observer QA Site";
  const { data: existingSite, error: existingError } = await supabase
    .from("observer_sites")
    .select("id")
    .eq("owner_profile_id", profileId)
    .eq("site_type", "office")
    .maybeSingle();
  if (existingError) throw existingError;

  let siteId = existingSite?.id;
  if (!siteId) {
    const { data: site, error: siteError } = await supabase
      .from("observer_sites")
      .insert({
        name: siteName,
        site_type: "office",
        owner_profile_id: profileId,
        address: "Synthetic QA site",
        timezone: "Asia/Jerusalem",
        active: true,
        monitoring_enabled: false,
        camera_limit: 4,
        event_retention_days: 30,
        ai_features: { qa_demo: true, live_ai: false },
        metadata: { qa_demo: true, real_data: false }
      })
      .select("id")
      .single();
    if (siteError) throw siteError;
    siteId = site.id;
  }

  const { error: membershipError } = await supabase.from("observer_site_memberships").upsert({
    observer_site_id: siteId,
    profile_id: profileId,
    member_role: "owner",
    active: true,
    metadata: { qa_demo: true }
  }, { onConflict: "observer_site_id,profile_id" });
  if (membershipError) throw membershipError;
}

const results = [];
for (const account of accounts) {
  results.push(await upsertAccount(account));
}

const lines = [
  "# DEMO AUTH SETUP 1 - Script Results",
  "",
  `Date: ${new Date().toISOString()}`,
  "",
  "No passwords are printed in this report.",
  "",
  "| Account | Email | Role | Status | Note |",
  "|---|---|---|---|---|",
  ...results.map((result) => `| ${result.key} | ${result.email} | ${result.role} | ${result.status} | ${result.note} |`),
  "",
  "If any account is SKIPPED_MISSING_LOCAL_PASSWORD, add the matching password variable to an ignored local env file and rerun."
];

writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
console.log(`Demo QA user setup completed. Report written to ${REPORT_PATH}. Passwords were not printed.`);
