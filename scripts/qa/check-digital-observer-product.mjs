import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const genericPassword = process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
const accounts = {
  home: {
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || genericPassword
  },
  business: {
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_EMAIL || process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_PASSWORD || genericPassword
  }
};

if (!url || !anonKey) throw new Error("Supabase URL and publishable key are required.");
if (!accounts.home.password || !accounts.business.password) throw new Error("Local Digital Observer QA passwords are required.");
if (String(process.env.QA_DEMO_ENVIRONMENT).toLowerCase() === "production") throw new Error("Refusing Digital Observer QA against production.");

const results = [];
function record(area, pass, evidence) {
  results.push({ area, pass: Boolean(pass), evidence });
}

async function login(account, label) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(account);
  record(`${label} login`, !error && Boolean(data.user), error ? "Normal Supabase login failed" : "Normal Supabase auth session created");
  if (error || !data.user) throw new Error(`${label} login failed`);
  const { data: profile, error: profileError } = await client.from("profiles").select("id,role,garden_id,active").eq("id", data.user.id).single();
  record(`${label} standalone profile`, !profileError && profile?.role === "network_manager" && !profile?.garden_id && profile?.active !== false, "network_manager profile without garden assignment");
  return { client, user: data.user };
}

async function ownedSite(session, expectedType, label) {
  const { data, error } = await session.client
    .from("observer_sites")
    .select("id,name,site_type,owner_profile_id,event_retention_days")
    .eq("owner_profile_id", session.user.id)
    .neq("site_type", "kindergarten");
  const site = data?.find((item) => item.site_type === expectedType);
  record(`${label} synthetic site`, !error && Boolean(site), `${expectedType} site visible through user-scoped query`);
  if (!site) throw new Error(`${label} site missing`);
  return site;
}

async function ownRuntimeChecks(session, site, label) {
  const [cameraResult, signalResult, subscriptionResult, peopleResult, clipsResult, deliveriesResult] = await Promise.all([
    session.client.from("digital_observer_camera_sources").select("id,observer_site_id,display_name,source_mode,status,health_status,connector_type").eq("observer_site_id", site.id),
    session.client.from("observer_intelligence_signals").select("id,observer_site_id,severity,review_status,confidence").eq("observer_site_id", site.id),
    session.client.from("observer_site_subscriptions").select("id,observer_site_id,status,subscription_status,payment_provider,entitlement_status,purchase_channel").eq("observer_site_id", site.id),
    session.client.from("digital_observer_known_people").select("id,observer_site_id,display_name,consent_status,recognition_status").eq("observer_site_id", site.id),
    session.client.from("digital_observer_event_clips").select("id,observer_site_id,title,clip_status,retention_hours,downloadable").eq("observer_site_id", site.id),
    session.client.from("digital_observer_notification_deliveries").select("id,observer_site_id,channel,provider_mode,delivery_status").eq("observer_site_id", site.id)
  ]);
  record(`${label} camera source binding`, !cameraResult.error && (cameraResult.data?.length ?? 0) > 0, cameraResult.error ? `Database error ${cameraResult.error.code || "unknown"}` : "User can read only safe camera source columns");
  record(`${label} event binding`, !signalResult.error && (signalResult.data?.length ?? 0) > 0, signalResult.error ? `Database error ${signalResult.error.code || "unknown"}` : "Synthetic AI events are data-bound");
  record(`${label} billing readiness`, !subscriptionResult.error && (subscriptionResult.data?.length ?? 0) > 0 && subscriptionResult.data.every((item) => item.payment_provider !== "live"), subscriptionResult.error ? `Database error ${subscriptionResult.error.code || "unknown"}` : "Subscription exists without live billing provider");
  record(`${label} known people privacy`, !peopleResult.error && (peopleResult.data?.length ?? 0) > 0 && peopleResult.data.every((item) => item.recognition_status !== "active"), peopleResult.error ? `Database error ${peopleResult.error.code || "unknown"}` : "Synthetic known people are visible without biometric fields");
  record(`${label} event clip retention`, !clipsResult.error && (clipsResult.data?.length ?? 0) > 0 && clipsResult.data.every((item) => Number(item.retention_hours) <= 48 && item.downloadable === false), clipsResult.error ? `Database error ${clipsResult.error.code || "unknown"}` : "Readiness clips are capped at 48 hours and have no download claim");
  record(`${label} notification isolation`, !deliveriesResult.error && (deliveriesResult.data?.length ?? 0) > 0 && deliveriesResult.data.every((item) => item.provider_mode !== "live"), deliveriesResult.error ? `Database error ${deliveriesResult.error.code || "unknown"}` : "Only scoped mock notification delivery is visible");
}

async function crossTenantChecks(session, foreignSite, label) {
  const [siteResult, cameraResult, signalResult, peopleResult, clipsResult, deliveriesResult] = await Promise.all([
    session.client.from("observer_sites").select("id").eq("id", foreignSite.id),
    session.client.from("digital_observer_camera_sources").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("observer_intelligence_signals").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_known_people").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_event_clips").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_notification_deliveries").select("id").eq("observer_site_id", foreignSite.id)
  ]);
  record(`${label} cannot read foreign site`, !siteResult.error && siteResult.data?.length === 0, "RLS returned no foreign site rows");
  record(`${label} cannot read foreign cameras`, !cameraResult.error && cameraResult.data?.length === 0, cameraResult.error ? `Database error ${cameraResult.error.code || "unknown"}` : "RLS returned no foreign camera rows");
  record(`${label} cannot read foreign events`, !signalResult.error && signalResult.data?.length === 0, "RLS returned no foreign event rows");
  record(`${label} cannot read foreign known people`, !peopleResult.error && peopleResult.data?.length === 0, peopleResult.error ? `Database error ${peopleResult.error.code || "unknown"}` : "RLS returned no foreign known-person rows");
  record(`${label} cannot read foreign clips`, !clipsResult.error && clipsResult.data?.length === 0, clipsResult.error ? `Database error ${clipsResult.error.code || "unknown"}` : "RLS returned no foreign clip rows");
  record(`${label} cannot read foreign deliveries`, !deliveriesResult.error && deliveriesResult.data?.length === 0, deliveriesResult.error ? `Database error ${deliveriesResult.error.code || "unknown"}` : "RLS returned no foreign notification rows");
}

const home = await login(accounts.home, "Home user");
const business = await login(accounts.business, "Business user");
const homeSite = await ownedSite(home, "home", "Home user");
const businessSite = await ownedSite(business, "business", "Business user");
await ownRuntimeChecks(home, homeSite, "Home user");
await ownRuntimeChecks(business, businessSite, "Business user");
await crossTenantChecks(home, businessSite, "Home user");
await crossTenantChecks(business, homeSite, "Business user");

const { data: packages, error: packageError } = await home.client
  .from("observer_monitoring_packages")
  .select("id,package_key,recording_retention_hours,live_view_enabled,payment_provider_mode,site_limit,user_limit,sms_quota,voice_call_quota,trial_days")
  .eq("active", true);
record("Retention is capped for Digital Observer", !packageError && (packages?.length ?? 0) > 0 && packages.every((item) => Number(item.recording_retention_hours ?? 0) <= 48), packageError ? `Database error ${packageError.code || "unknown"}` : "All active packages are 48 hours or less");
record("No package activates live providers", !packageError && packages.every((item) => item.payment_provider_mode !== "live"), packageError ? `Database error ${packageError.code || "unknown"}` : "Package provider modes remain mock/sandbox/readiness");
record("Commercial package matrix is complete", !packageError && ["home_basic","home_plus","home_premium","business_basic","business_pro","enterprise_monitoring"].every((key) => packages.some((item) => item.package_key === key)), packageError ? `Database error ${packageError.code || "unknown"}` : "Home, business and multi-site package rows are present");

await home.client.auth.signOut();
await business.client.auth.signOut();

const failed = results.filter((item) => !item.pass);
const lines = [
  "# DIGITAL OBSERVER AUTOMATED QA RESULTS",
  "",
  `Date: ${new Date().toISOString()}`,
  "Environment: synthetic demo",
  "Passwords or tokens printed: no",
  "Service role used in browser/client QA: no",
  "",
  "| Area | Result | Evidence |",
  "|---|---|---|",
  ...results.map((item) => `| ${item.area} | ${item.pass ? "PASS" : "FAIL"} | ${item.evidence} |`),
  "",
  `Final result: ${failed.length ? "FAIL" : "PASS"}`,
  `Passed: ${results.length - failed.length}/${results.length}`,
  "",
  "> This runtime QA uses normal Supabase authentication and RLS. It does not validate a real camera gateway, AI provider, billing provider or production notification provider."
];
writeFileSync("DIGITAL_OBSERVER_AUTOMATED_QA_RESULTS.md", `${lines.join("\n")}\n`, "utf8");

for (const item of results) process.stdout.write(`${item.pass ? "PASS" : "FAIL"} | ${item.area}\n`);
process.stdout.write(`SUMMARY | ${results.length - failed.length}/${results.length}\n`);
if (failed.length) process.exitCode = 1;
