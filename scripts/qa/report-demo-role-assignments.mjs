import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.qa-demo.local", ".env.local"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Local Supabase server credentials are required.");
if (!["local", "demo", "staging", "pilot"].includes(String(process.env.QA_DEMO_ENVIRONMENT ?? "").toLowerCase())) {
  throw new Error("QA_DEMO_ENVIRONMENT must explicitly identify a safe non-production environment.");
}
if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to inspect demo assignments in production mode.");

const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [
  ["הורה משויך", process.env.QA_DEMO_PARENT_ASSIGNED_EMAIL || process.env.QA_DEMO_PARENT_EMAIL || "parent.1@demo.ganbatuach.com", "parent", "משויך לילד סינתטי"],
  ["הורה לא משויך", process.env.QA_DEMO_PARENT_UNASSIGNED_EMAIL || "qa.parent.unassigned@demo.ganbatuach.com", "parent", "ללא ילד וללא גן"],
  ["מנהלת", process.env.QA_DEMO_MANAGER_EMAIL || "manager.rakefet@demo.ganbatuach.com", "manager", "גן סינתטי"],
  ["צוות משויך", process.env.QA_DEMO_STAFF_ASSIGNED_EMAIL || "staff.1@demo.ganbatuach.com", "staff", "גן סינתטי"],
  ["צוות לא משויך", process.env.QA_DEMO_STAFF_UNASSIGNED_EMAIL || "qa.staff.unassigned@demo.ganbatuach.com", "staff", "ללא גן"],
  ["מפקחת משויכת", process.env.QA_DEMO_INSPECTOR_ASSIGNED_EMAIL || "inspector.yael@demo.ganbatuach.com", "inspector", "גנים סינתטיים"],
  ["מפקחת לא משויכת", process.env.QA_DEMO_INSPECTOR_UNASSIGNED_EMAIL || "qa.inspector.unassigned@demo.ganbatuach.com", "inspector", "ללא גן"],
  ["אדמין", process.env.QA_DEMO_ADMIN_EMAIL || "admin-demo@demo.ganbatuach.com", "admin", "גישה תפעולית לסביבת הדמו"],
  ["Digital Observer", process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com", "network_manager", "אתר תצפית סינתטי נפרד"]
];

const authUsers = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
const userByEmail = new Map(authUsers.map((user) => [String(user.email ?? "").toLowerCase(), user]));
const userIds = accounts.map(([, email]) => userByEmail.get(email.toLowerCase())?.id).filter(Boolean);

const [profilesRes, gardensRes, staffRes, parentsRes, sitesRes] = await Promise.all([
  supabase.from("profiles").select("id, email, full_name, role, garden_id, active").in("id", userIds),
  supabase.from("gardens").select("id, name, city, manager_id, owner_profile_id, inspector_id, is_demo").eq("is_demo", true),
  supabase.from("staff").select("profile_id, garden_id, approved_to_work, onboarding_status").in("profile_id", userIds),
  supabase.from("parents").select("id, profile_id, user_id, garden_id").or(`profile_id.in.(${userIds.join(",")}),user_id.in.(${userIds.join(",")})`),
  supabase.from("observer_sites").select("id, name, site_type, owner_profile_id, active, monitoring_enabled").in("owner_profile_id", userIds)
]);
for (const result of [profilesRes, gardensRes, staffRes, parentsRes, sitesRes]) if (result.error) throw result.error;

const profiles = profilesRes.data ?? [];
const gardens = gardensRes.data ?? [];
const staff = staffRes.data ?? [];
const parents = parentsRes.data ?? [];
const sites = sitesRes.data ?? [];
const parentIds = parents.map((parent) => parent.id);
const { data: children, error: childrenError } = parentIds.length
  ? await supabase.from("children").select("id, full_name, primary_parent_id, garden_id, is_demo").in("primary_parent_id", parentIds)
  : { data: [], error: null };
if (childrenError) throw childrenError;

function clean(value, fallback = "") {
  return String(value ?? fallback).replace(/\[demo\]/gi, "").trim() || fallback;
}

function assignmentsFor(userId, role) {
  if (!userId) return "משתמש חסר";
  if (role === "manager") {
    const rows = gardens.filter((garden) => garden.manager_id === userId || garden.owner_profile_id === userId);
    return rows.length ? rows.map((garden) => `${clean(garden.name, "גן")} (${garden.city ?? "עיר לא הוגדרה"})`).join(", ") : "לא משויך";
  }
  if (role === "staff") {
    const gardenIds = staff.filter((row) => row.profile_id === userId).map((row) => row.garden_id);
    const rows = gardens.filter((garden) => gardenIds.includes(garden.id));
    return rows.length ? rows.map((garden) => `${clean(garden.name, "גן")} (${garden.city ?? "עיר לא הוגדרה"})`).join(", ") : "לא משויך";
  }
  if (role === "inspector") {
    const rows = gardens.filter((garden) => garden.inspector_id === userId);
    return rows.length ? rows.map((garden) => `${clean(garden.name, "גן")} (${garden.city ?? "עיר לא הוגדרה"})`).join(", ") : "לא משויך";
  }
  if (role === "parent") {
    const ownParents = parents.filter((parent) => parent.profile_id === userId || parent.user_id === userId);
    const ownParentIds = ownParents.map((parent) => parent.id);
    const ownChildren = (children ?? []).filter((child) => ownParentIds.includes(child.primary_parent_id));
    const names = ownChildren.map((child) => clean(child.full_name, "ילד/ה"));
    const gardenNames = gardens.filter((garden) => ownChildren.some((child) => child.garden_id === garden.id)).map((garden) => clean(garden.name, "גן"));
    return names.length ? `${names.join(", ")} · ${gardenNames.join(", ") || "ללא גן"}` : "ללא ילד וללא גן";
  }
  if (role === "network_manager") {
    const ownSites = sites.filter((site) => site.owner_profile_id === userId);
    return ownSites.length ? ownSites.map((site) => `${clean(site.name, "אתר")} (${site.site_type})`).join(", ") : "ללא אתר תצפית";
  }
  return role === "admin" ? "סביבת דמו מלאה" : "לא משויך";
}

const rows = accounts.map(([label, email, role, expected]) => {
  const user = userByEmail.get(email.toLowerCase());
  const profile = profiles.find((item) => item.id === user?.id);
  return { label, email, exists: Boolean(user && profile), active: Boolean(profile?.active), role: profile?.role ?? role, expected, assignment: assignmentsFor(user?.id, role) };
});

const output = [
  "# משתמשי בדיקה ושיוכים",
  "",
  `עודכן: ${new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date())}`,
  "",
  "> כל החשבונות והנתונים בדוח סינתטיים. הסיסמאות אינן מופיעות כאן ונשמרות רק בקובץ המקומי המוחרג מ-Git.",
  "",
  "| משתמש בדיקה | אימייל | תפקיד בפועל | חשבון קיים | פעיל | שיוך בפועל | מצב מיועד |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((row) => `| ${row.label} | ${row.email} | ${row.role} | ${row.exists ? "כן" : "לא"} | ${row.active ? "כן" : "לא"} | ${row.assignment} | ${row.expected} |`),
  "",
  "## סיסמאות",
  "",
  "הסיסמאות נמצאות רק ב-`.env.qa-demo.local`. אין להעתיק אותן לדוח, לקוד, לצילום מסך או ל-Git.",
  ""
].join("\n");

writeFileSync("DEMO_TEST_USERS_ASSIGNMENT_REPORT_HE.md", output);
console.log("Synthetic assignment report created without printing passwords.");
