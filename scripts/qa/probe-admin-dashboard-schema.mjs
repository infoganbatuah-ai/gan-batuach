import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.qa-demo.local", ".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Supabase server configuration is required.");

const client = createClient(url, serviceRole, { auth: { persistSession: false } });
let failureCount = 0;
const probes = [
  ["gardens", "id,status,safe_status,approval_flow_status"],
  ["inspections", "id,status,completed_at"],
  ["violations", "id,status"],
  ["complaints", "id,status,severity"]
];

for (const [table, columns] of probes) {
  const result = await client.from(table).select(columns).limit(1);
  if (result.error) failureCount += 1;
  console.log(JSON.stringify({
    table,
    columns,
    status: result.error ? "FAIL" : "PASS",
    code: result.error?.code ?? null,
    message: result.error?.message?.slice(0, 160) ?? null
  }));
}

for (const [table, column] of [
  ["gardens", "status"],
  ["inspections", "status"],
  ["violations", "status"],
  ["complaints", "status"],
  ["complaints", "severity"]
]) {
  const result = await client.from(table).select(column).limit(250);
  const values = result.error
    ? []
    : [...new Set((result.data ?? []).map((row) => row[column]).filter(Boolean))].sort();
  console.log(JSON.stringify({ table, distinctColumn: column, values }));
}

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.QA_DEMO_ADMIN_EMAIL;
const adminPassword = process.env.QA_DEMO_ADMIN_PASSWORD;
if (!publishableKey || !adminEmail || !adminPassword) throw new Error("QA admin credentials and public key are required.");

const adminClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await adminClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
if (login.error) throw new Error("QA admin login failed.");

const exactQueries = [
  ["gardensSimple", adminClient.from("gardens").select("id").limit(1)],
  ["gardensCount", adminClient.from("gardens").select("id", { count: "exact", head: true })],
  ["inspectionsSimple", adminClient.from("inspections").select("id").limit(1)],
  ["violationsSimple", adminClient.from("violations").select("id").limit(1)],
  ["complaintsSimple", adminClient.from("complaints").select("id").limit(1)],
  ["inspectionsOverview", adminClient.from("inspections").select("id,garden_id,inspector_id,status,completed_at,weighted_score,violation_count,critical_failures,gps_verified,gardens(name,city),inspectors:inspector_id(full_name)").order("created_at", { ascending: false }).limit(2)],
  ["inspectorsDirectory", adminClient.from("inspectors").select("id,service_cities,certification_notes,created_at,profiles!inspectors_id_fkey(full_name,phone,email,active,profile_image_url)").limit(2)],
  ["adminCanonicalSubscriptions", adminClient.from("kindergarten_subscriptions").select("id,status,created_at,current_period_end,subscription_plans(price_amount)").limit(2)],
  ["adminInspectorSummary", adminClient.from("inspectors").select("id,service_cities,certification_notes,created_at,profiles!inspectors_id_fkey(full_name,active)").limit(2)],
  ["enterpriseManagers", adminClient.from("network_manager_assignments").select("id,active,kindergarten_networks(network_name),profiles!network_manager_assignments_profile_id_fkey(full_name,email,phone)").eq("active", true).limit(2)],
  ["enterpriseSupervisors", adminClient.from("enterprise_supervisor_assignments").select("id,active,kindergarten_networks(network_name),gardens(name,city),profiles!enterprise_supervisor_assignments_profile_id_fkey(full_name)").eq("active", true).limit(2)],
  ["enterpriseSubscriptions", adminClient.from("kindergarten_subscriptions").select("id,garden_id,billing_status,renewal_date,current_period_end,status").limit(2)],
  ["activeGardens", adminClient.from("gardens").select("id", { count: "exact", head: true }).eq("status", "active")],
  ["suspendedGardens", adminClient.from("gardens").select("id", { count: "exact", head: true }).in("status", ["blocked", "archived"])],
  ["completedInspections", adminClient.from("inspections").select("id", { count: "exact", head: true }).gte("completed_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).eq("status", "done")],
  ["violations", adminClient.from("violations").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "overdue"])],
  ["nationalUnresolvedViolations", adminClient.from("violations").select("id", { count: "exact", head: true }).neq("status", "done")],
  ["nationalViolationRows", adminClient.from("violations").select("id,garden_id,title,severity,status,correction_due_at,gardens(name,city)").neq("status", "done").order("created_at", { ascending: false }).limit(2)],
  ["complaints", adminClient.from("complaints").select("id", { count: "exact", head: true }).in("status", ["new", "assigned", "in_progress", "waiting_garden"])],
  ["criticalComplaints", adminClient.from("complaints").select("id", { count: "exact", head: true }).in("severity", ["critical", "high"]).in("status", ["new", "assigned", "in_progress", "waiting_garden"])]
];

for (const [name, promise] of exactQueries) {
  const result = await promise;
  if (result.error) failureCount += 1;
  const safeError = result.error
    ? Object.fromEntries(Object.getOwnPropertyNames(result.error).map((key) => [
        key,
        typeof result.error[key] === "string" ? result.error[key].slice(0, 240) : result.error[key]
      ]))
    : null;
  console.log(JSON.stringify({
    normalAdminQuery: name,
    status: result.error ? "FAIL" : "PASS",
    count: result.error ? null : result.count ?? 0,
    code: result.error?.code ?? null,
    message: result.error?.message?.slice(0, 160) ?? null,
    details: result.error?.details?.slice(0, 160) ?? null,
    hint: result.error?.hint?.slice(0, 160) ?? null,
    rawType: result.error?.constructor?.name ?? null,
    safeError
  }));
}

await adminClient.auth.signOut();
console.log(JSON.stringify({ adminSchemaProbe: failureCount ? "FAIL" : "PASS", failures: failureCount }));
if (failureCount) process.exitCode = 1;
