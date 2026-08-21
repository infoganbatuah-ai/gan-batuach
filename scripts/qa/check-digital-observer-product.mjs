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
  const { data: observerAccount, error: observerAccountError } = await client.from("digital_observer_accounts").select("profile_id,account_type,status,onboarding_step,trial_start,trial_end").eq("profile_id", data.user.id).maybeSingle();
  record(
    `${label} standalone identity`,
    !profileError && !observerAccountError && Boolean(observerAccount) && profile?.active !== false,
    profileError || observerAccountError
      ? `Database error ${profileError?.code || observerAccountError?.code || "unknown"}`
      : observerAccount
        ? "Digital Observer membership exists independently from the Gan Batuach role"
        : "No standalone Digital Observer account row exists for this legacy test user"
  );
  record(
    `${label} product metadata`,
    data.user.user_metadata?.product === "digital_observer",
    data.user.user_metadata?.product === "digital_observer"
      ? "Auth metadata identifies the standalone product"
      : "Legacy test user is missing product=digital_observer metadata"
  );
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
  const [cameraResult, signalResult, subscriptionResult, peopleResult, candidateResult, privateCandidateResult, clipsResult, deliveriesResult] = await Promise.all([
    session.client.from("digital_observer_camera_sources").select("id,observer_site_id,display_name,source_mode,status,health_status,connector_type").eq("observer_site_id", site.id),
    session.client.from("observer_intelligence_signals").select("id,observer_site_id,severity,review_status,confidence").eq("observer_site_id", site.id),
    session.client.from("observer_site_subscriptions").select("id,observer_site_id,status,subscription_status,payment_provider,entitlement_status,purchase_channel").eq("observer_site_id", site.id),
    session.client.from("digital_observer_known_people").select("id,observer_site_id,display_name,consent_status,recognition_status").eq("observer_site_id", site.id),
    session.client.from("digital_observer_identity_candidates").select("id,observer_site_id,candidate_status,observation_count,average_confidence,preview_available").eq("observer_site_id", site.id),
    session.client.from("digital_observer_identity_candidates").select("id,cluster_reference").eq("observer_site_id", site.id).limit(1),
    session.client.from("digital_observer_event_clips").select("id,observer_site_id,title,clip_status,retention_hours,downloadable").eq("observer_site_id", site.id),
    session.client.from("digital_observer_notification_deliveries").select("id,observer_site_id,channel,provider_mode,delivery_status").eq("observer_site_id", site.id)
  ]);
  const evidence = (result, success, missing) => result.error
    ? `Database error ${result.error.code || "unknown"}`
    : (result.data?.length ?? 0) > 0 ? success : missing;
  record(`${label} camera source binding`, !cameraResult.error && (cameraResult.data?.length ?? 0) > 0, evidence(cameraResult, "User can read only safe camera source columns", "No synthetic camera source is linked to this site"));
  record(`${label} event binding`, !signalResult.error && (signalResult.data?.length ?? 0) > 0, evidence(signalResult, "Synthetic AI events are data-bound", "No synthetic AI event is linked to this site"));
  record(`${label} billing readiness`, !subscriptionResult.error && (subscriptionResult.data?.length ?? 0) > 0 && subscriptionResult.data.every((item) => item.payment_provider !== "live"), evidence(subscriptionResult, "Subscription exists without live billing provider", "No trial or subscription row is linked to this site"));
  record(`${label} known people privacy`, !peopleResult.error && (peopleResult.data?.length ?? 0) > 0 && peopleResult.data.every((item) => item.recognition_status !== "active"), evidence(peopleResult, "Synthetic known people are visible without biometric fields", "No synthetic known-person readiness row is linked to this site"));
  record(`${label} identity candidate workflow`, !candidateResult.error, candidateResult.error ? `Database error ${candidateResult.error.code || "unknown"}` : "Candidate review metadata is site-scoped and available even when no AI candidate exists");
  record(`${label} identity candidate private columns`, Boolean(privateCandidateResult.error), privateCandidateResult.error ? "Raw cluster references are not selectable by the browser role" : "Private cluster reference was unexpectedly selectable");
  record(`${label} event clip retention`, !clipsResult.error && (clipsResult.data?.length ?? 0) > 0 && clipsResult.data.every((item) => Number(item.retention_hours) <= 48 && item.downloadable === false), evidence(clipsResult, "Readiness clips are capped at 48 hours and have no download claim", "No synthetic event clip is linked to this site"));
  record(`${label} notification isolation`, !deliveriesResult.error && (deliveriesResult.data?.length ?? 0) > 0 && deliveriesResult.data.every((item) => item.provider_mode !== "live"), evidence(deliveriesResult, "Only scoped mock notification delivery is visible", "No synthetic notification delivery is linked to this site"));
}

async function crossTenantChecks(session, foreignSite, label) {
  const [siteResult, cameraResult, signalResult, peopleResult, candidateResult, clipsResult, deliveriesResult] = await Promise.all([
    session.client.from("observer_sites").select("id").eq("id", foreignSite.id),
    session.client.from("digital_observer_camera_sources").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("observer_intelligence_signals").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_known_people").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_identity_candidates").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_event_clips").select("id").eq("observer_site_id", foreignSite.id),
    session.client.from("digital_observer_notification_deliveries").select("id").eq("observer_site_id", foreignSite.id)
  ]);
  record(`${label} cannot read foreign site`, !siteResult.error && siteResult.data?.length === 0, "RLS returned no foreign site rows");
  record(`${label} cannot read foreign cameras`, !cameraResult.error && cameraResult.data?.length === 0, cameraResult.error ? `Database error ${cameraResult.error.code || "unknown"}` : "RLS returned no foreign camera rows");
  record(`${label} cannot read foreign events`, !signalResult.error && signalResult.data?.length === 0, "RLS returned no foreign event rows");
  record(`${label} cannot read foreign known people`, !peopleResult.error && peopleResult.data?.length === 0, peopleResult.error ? `Database error ${peopleResult.error.code || "unknown"}` : "RLS returned no foreign known-person rows");
  record(`${label} cannot read foreign identity candidates`, !candidateResult.error && candidateResult.data?.length === 0, candidateResult.error ? `Database error ${candidateResult.error.code || "unknown"}` : "RLS returned no foreign identity-candidate rows");
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

const rootLayoutSource = readFileSync("app/layout.tsx", "utf8");
const observerLayoutSource = readFileSync("app/digital-observer/layout.tsx", "utf8");
const templateSource = readFileSync("lib/domain/digital-observer/site-templates.ts", "utf8");
const observerDashboardSource = readFileSync("app/digital-observer/dashboard/page.tsx", "utf8");
const observerShellSource = readFileSync("components/digital-observer/observer-app-shell.tsx", "utf8");
const observerStylesSource = readFileSync("app/styles/digital-observer-product.css", "utf8");
const serviceWorkerSource = readFileSync("public/sw.js", "utf8");
const observerAdminSource = readFileSync("app/digital-observer/admin/page.tsx", "utf8");
const observerAdminAccessSource = readFileSync("lib/domain/digital-observer/admin-access.ts", "utf8");
const observerAdminRuntimeSource = readFileSync("lib/domain/digital-observer/admin-runtime.ts", "utf8");
const observerPackageRouteSource = readFileSync("app/api/admin/observer-packages/route.ts", "utf8");
const authCallbackSource = readFileSync("components/auth/auth-callback-client.tsx", "utf8");
const passwordUpdateSource = readFileSync("components/auth/password-update-form.tsx", "utf8");
const observerPasswordWrapperSource = readFileSync("components/digital-observer/observer-set-password-form.tsx", "utf8");
const observerAuthActionsSource = readFileSync("app/digital-observer/auth-actions.ts", "utf8");
const observerOnboardingSource = readFileSync("app/digital-observer/onboarding/page.tsx", "utf8");
const observerActionFormsSource = readFileSync("components/digital-observer/observer-action-forms.tsx", "utf8");
const observerBillingRouteSource = readFileSync("app/api/digital-observer/billing/route.ts", "utf8");
const observerBillingPageSource = readFileSync("app/digital-observer/billing/page.tsx", "utf8");
const observerRecordingsSource = readFileSync("app/digital-observer/recordings/page.tsx", "utf8");
const authConfirmRouteSource = readFileSync("app/auth/confirm/route.ts", "utf8");
const authFlowSource = readFileSync("lib/domain/auth-flow.ts", "utf8");
const logoutRouteSource = readFileSync("app/api/auth/logout/route.ts", "utf8");
record("Mobile zoom remains accessible", !/maximumScale\s*:\s*1/.test(`${rootLayoutSource}\n${observerLayoutSource}`), "Viewport metadata does not disable pinch zoom");
record("Observer routes have loading and error states", existsSync("app/digital-observer/loading.tsx") && existsSync("app/digital-observer/error.tsx"), "Dedicated route-level loading and recovery UI exists");
record("Multi-industry templates keep high-risk review guarded", ["kiosk", "retail", "office", "warehouse", "clinic", "restaurant", "child_education", "custom"].every((key) => templateSource.includes(`key: \"${key}\"`)) && templateSource.includes("automaticEmergencyAction: false") && templateSource.includes("highRiskEventsAreSuspicions: true"), "Site templates are reusable and never enable automatic emergency action");
record("Home dashboard exposes core product actions", ["הוספת מצלמה", "המצלמות שלי", "התצפיתן שלי", "המנוי שלי"].every((label) => observerDashboardSource.includes(label)), "Camera, Observer, subscription and monitoring entry points are present in the authenticated dashboard");
record("Home navigation exposes subscription management", observerShellSource.includes('{ href: "/digital-observer/billing", label: "מנוי וחיוב"'), "Home users can reach billing without using a business-only menu");
record("Mobile header keeps primary actions visible", observerStylesSource.includes(".do-top-actions > .do-button") && !observerStylesSource.includes(".do-top-actions > .do-button,\n  .do-top-actions .logout-button { display: none; }"), "Primary page action is rendered as an icon button instead of being hidden on mobile");
record(
  "Mobile shell exposes every role destination",
  observerShellSource.includes("do-mobile-menu-sheet")
    && observerShellSource.includes("כל מסכי התצפיתן")
    && observerStylesSource.includes(".do-mobile-menu-sheet")
    && observerStylesSource.includes(".do-bottom-nav"),
  "The compact bottom navigation is paired with a full mobile drawer; no destination is available only on desktop"
);
record(
  "Business activity chart is data-bound",
  observerDashboardSource.includes("activityBuckets(siteSignals)")
    && observerDashboardSource.includes("businessActivity.map")
    && !observerDashboardSource.includes("24, 48"),
  "The 24-hour graph is derived from timestamped site signals rather than hardcoded chart values"
);
record(
  "Recordings use a responsive truthful list",
  observerRecordingsSource.includes("do-recording-list")
    && observerRecordingsSource.includes("הורדה לא זמינה")
    && !observerRecordingsSource.includes("href={clip"),
  "Clip rows adapt to mobile and never expose a download action without a signed file URL"
);
record("Service worker never caches authenticated navigation", serviceWorkerSource.includes("if (request.mode === 'navigate')") && !serviceWorkerSource.includes("cache.put(request, copy)") && !serviceWorkerSource.includes("caches.match('/')"), "Navigation is network-only and the offline response is product-aware; only static assets are cached");
record("Observer admin uses a product-scoped signed claim", observerAdminAccessSource.includes('DIGITAL_OBSERVER_ADMIN_METADATA_KEY = "digital_observer_admin"') && observerAdminAccessSource.includes("session.user.app_metadata") && observerAdminAccessSource.includes('mediaAccess: false') && observerAdminAccessSource.includes('secretAccess: false'), "Dedicated Digital Observer admin access is granted by signed app metadata and does not imply media or secret access");
record("Observer admin has a complete control center", ["תמונת מצב מערכת", "מפת לקוחות ואתרים מורשים", "אירועים ומגמה", "בריאות מנוע ושירותים", "תורים ובקרות תצפיתן", "אתרים, מצלמות ומנויים"].every((label) => observerAdminSource.includes(label)), "System state, authorized locations, trends, services, queues and source records are visible in the admin center");
record("Observer admin reads safe metadata only", !/(rtsp|password|secret|credential|stream_url|access_token)/i.test(observerAdminRuntimeSource) && observerAdminRuntimeSource.includes('is("garden_id", null)') && observerAdminRuntimeSource.includes('neq("site_type", "kindergarten")'), "Admin runtime explicitly selects non-secret observer metadata and excludes Gan Batuach kindergarten sites");
record("Observer admin routes have dedicated loading and recovery states", existsSync("app/digital-observer/admin/loading.tsx") && existsSync("app/digital-observer/admin/error.tsx"), "The control center has honest loading and retry UI");
record("Observer admin mobile navigation is complete", ["מרכז בקרה", "לקוחות ואתרים", "מנוע ותפעול", "מנויים וחיוב", "חבילות"].every((label) => observerShellSource.includes(label)) && observerStylesSource.includes(".do-mode-admin .do-bottom-nav"), "All five admin destinations are exposed through a dedicated responsive shell");
record(
  "Observer admin password setup uses normal Supabase recovery",
  existsSync("app/digital-observer/set-password/page.tsx")
    && observerPasswordWrapperSource.includes('product="digital_observer"')
    && passwordUpdateSource.includes("supabase.auth.updateUser")
    && passwordUpdateSource.includes('supabase.auth.signOut({ scope: "local" })'),
  "No password is embedded in source; the shared form requires an authenticated recovery session, updates through Supabase and signs the local session out"
);
record(
  "Recovery callback supports PKCE and implicit email links",
  authCallbackSource.includes("exchangeCodeForSession")
    && authCallbackSource.includes("hash.get(\"access_token\")")
    && authCallbackSource.includes("supabase.auth.setSession")
    && authCallbackSource.includes("window.history.replaceState"),
  "The browser callback accepts PKCE or fragment tokens and removes sensitive URL material before continuing"
);
record(
  "Email token-hash links preserve product routing after verification",
  authConfirmRouteSource.includes("verifyOtp({ token_hash: tokenHash")
    && authConfirmRouteSource.includes('typeValue === "email"')
    && authConfirmRouteSource.includes('type: "signup"')
    && authCallbackSource.includes('typeValue === "email"')
    && authCallbackSource.includes('type: "signup"')
    && authConfirmRouteSource.includes('request.cookies.get("auth_callback_product")')
    && authConfirmRouteSource.includes('data.user.user_metadata?.product === "digital_observer"')
    && authConfirmRouteSource.includes('data.user.app_metadata?.digital_observer_admin === true')
    && authConfirmRouteSource.includes('response.cookies.delete("auth_callback_product")'),
  "Direct signup/recovery links are verified server-side, legacy email-type signup links retry only as signup, route by signed identity plus the requesting product, then clear the short-lived routing hint"
);
record(
  "Supabase redirect uses the exact allow-listed callback",
  authFlowSource.includes('return `${appOrigin()}/auth/callback`')
    && !authFlowSource.includes('/auth/callback?'),
  "Email requests do not append query parameters that would make Supabase fall back to the site root"
);
record(
  "Password reset request prevents account enumeration",
  observerAuthActionsSource.includes('redirect("/digital-observer/forgot-password?sent=1")')
    && !observerAuthActionsSource.includes("reset_user_not_found")
    && !observerAuthActionsSource.includes("existing=1"),
  "The user receives the same confirmation path whether or not an account exists"
);
record(
  "Home and business onboarding stay account-scoped",
  observerOnboardingSource.includes("observerAccount?.account_type")
    && !observerOnboardingSource.includes('params?.type === "business"')
    && observerActionFormsSource.includes("packages.filter((item) => item.package_type === form.site_type"),
  "A query string cannot switch the account track, and package choices are filtered by the persisted home/business type"
);
record(
  "Subscription changes remain no-charge readiness requests",
  observerBillingRouteSource.includes("charged: false")
    && observerBillingRouteSource.includes('provider_mode: "mock"')
    && observerBillingRouteSource.includes("getObserverSiteAccess"),
  "The authenticated site access is checked before a server-only request record is created; no payment provider is invoked"
);
record(
  "Home and business package catalogues are isolated",
  observerBillingPageSource.includes('item.package_type === mode || (mode === "business" && item.package_type === "enterprise")')
    && observerBillingRouteSource.includes('allowedPackageType === "business" && requestedPackage.package_type === "enterprise"')
    && observerBillingRouteSource.includes("החבילה אינה מתאימה לסוג האתר הזה"),
  "Home accounts receive home packages only; business accounts receive business and enterprise packages, and the API enforces the same rule"
);
record(
  "Monthly and annual plan selection uses server prices",
  observerBillingPageSource.includes('cycle === "annual"')
    && observerBillingPageSource.includes("annual_price")
    && observerBillingPageSource.includes("billingCycle={cycle}")
    && observerBillingPageSource.includes("do-billing-cycle"),
  "Users can compare monthly and annual database prices while plan changes remain no-charge mock requests"
);
record(
  "Logout redirect remains product-scoped",
  logoutRouteSource.includes('requested?.startsWith("/digital-observer")')
    && logoutRouteSource.includes('!requested.startsWith("//")')
    && logoutRouteSource.includes(': "/login"'),
  "Logout may return to an internal Digital Observer path only and rejects protocol-relative redirects"
);
record(
  "Duplicate page routes are absent",
  !existsSync("app/digital-observer/[useCase]/page 2.tsx")
    && !existsSync("app/digital-observer/dashboard/page 2.tsx")
    && !existsSync("app/digital-observer/pricing/page 2.tsx")
    && !existsSync("app/digital-observer/sites/page 2.tsx")
    && !existsSync("app/digital-observer/start/page 2.tsx"),
  "Only the canonical App Router page files remain active"
);
record("Observer admin package actions keep audit logs schema-compatible", observerPackageRouteSource.includes("actor_role: profile.role") && observerPackageRouteSource.includes('audit_scope: "digital_observer_admin"') && !observerPackageRouteSource.includes('actor_role: "digital_observer_admin"'), "Audit rows use the existing app-role enum while retaining the dedicated observer-admin scope in audit data");

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
