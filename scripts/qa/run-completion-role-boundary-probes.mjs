import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const REPORT_PATH = "qa-evidence/gan-batuach-completion-audit-1/role-boundary-probes.json";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Supabase URL, public key and server-only service role key are required.");
}

const cameraSnapshotBucket = "camera-snapshots";
const cameraSnapshotProbeFolder = "qa-boundary-probe";
const cameraSnapshotProbeName = `synthetic-sentinel-${randomUUID()}.png`;
const cameraSnapshotProbePath = `${cameraSnapshotProbeFolder}/${cameraSnapshotProbeName}`;
const transparentPixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzZ5QAAAABJRU5ErkJggg==",
  "base64"
);
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const accounts = [
  ["parent_assigned", "QA_DEMO_PARENT_ASSIGNED_EMAIL", "QA_DEMO_PARENT_ASSIGNED_PASSWORD", "parent.1@demo.ganbatuach.com"],
  ["parent_unassigned", "QA_DEMO_PARENT_UNASSIGNED_EMAIL", "QA_DEMO_PARENT_UNASSIGNED_PASSWORD", "qa.parent.unassigned@demo.ganbatuach.com"],
  ["manager", "QA_DEMO_MANAGER_EMAIL", "QA_DEMO_MANAGER_PASSWORD", "manager.rakefet@demo.ganbatuach.com"],
  ["staff_assigned", "QA_DEMO_STAFF_ASSIGNED_EMAIL", "QA_DEMO_STAFF_ASSIGNED_PASSWORD", "staff.1@demo.ganbatuach.com"],
  ["staff_unassigned", "QA_DEMO_STAFF_UNASSIGNED_EMAIL", "QA_DEMO_STAFF_UNASSIGNED_PASSWORD", "qa.staff.unassigned@demo.ganbatuach.com"],
  ["inspector_assigned", "QA_DEMO_INSPECTOR_ASSIGNED_EMAIL", "QA_DEMO_INSPECTOR_ASSIGNED_PASSWORD", "inspector.yael@demo.ganbatuach.com"],
  ["inspector_unassigned", "QA_DEMO_INSPECTOR_UNASSIGNED_EMAIL", "QA_DEMO_INSPECTOR_UNASSIGNED_PASSWORD", "qa.inspector.unassigned@demo.ganbatuach.com"],
  ["admin", "QA_DEMO_ADMIN_EMAIL", "QA_DEMO_ADMIN_PASSWORD", "admin-demo@demo.ganbatuach.com"],
  ["digital_observer", "QA_DEMO_DIGITAL_OBSERVER_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD", "qa.digital.observer@demo.ganbatuach.com"]
].map(([key, emailEnv, passwordEnv, defaultEmail]) => ({
  key,
  email: process.env[emailEnv] || defaultEmail,
  password: process.env[passwordEnv]
}));

function safeError(error) {
  if (!error) return null;
  return {
    code: error.code || "UNKNOWN",
    message: String(error.message || "Query failed").slice(0, 180)
  };
}

async function probeRows(client, table, columns = "id", configure = (query) => query) {
  const result = await configure(client.from(table).select(columns).limit(25));
  return {
    rows: Array.isArray(result.data) ? result.data.length : 0,
    error: safeError(result.error)
  };
}

async function runAccount(account) {
  const base = {
    account: account.key,
    configured: Boolean(account.email && account.password),
    login: "NOT_RUN",
    profile: null,
    probes: {}
  };
  if (!base.configured) return base;

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (login.error || !login.data.user) {
    base.login = "FAIL";
    base.loginError = safeError(login.error);
    return base;
  }
  base.login = "PASS";

  const profile = await client.from("profiles").select("role,active,garden_id").eq("id", login.data.user.id).maybeSingle();
  base.profile = profile.error
    ? { error: safeError(profile.error) }
    : { role: profile.data?.role ?? null, active: profile.data?.active ?? null, hasGardenAssignment: Boolean(profile.data?.garden_id) };

  base.probes.gardens = await probeRows(client, "gardens", "id");
  base.probes.children = await probeRows(client, "children", "id");
  base.probes.providerHealth = await probeRows(client, "provider_integration_health", "id");
  base.probes.rawAiEvents = await probeRows(client, "ai_events", "id");

  const cameraSnapshotList = await client.storage
    .from(cameraSnapshotBucket)
    .list(cameraSnapshotProbeFolder, { limit: 10, offset: 0, search: cameraSnapshotProbeName });
  const listedSentinel = Array.isArray(cameraSnapshotList.data)
    && cameraSnapshotList.data.some((object) => object.name === cameraSnapshotProbeName);
  const cameraSnapshotDownload = await client.storage
    .from(cameraSnapshotBucket)
    .download(cameraSnapshotProbePath);
  const downloadedSentinel = !cameraSnapshotDownload.error && Boolean(cameraSnapshotDownload.data);
  base.probes.cameraSnapshotStorage = {
    accessStatus: !listedSentinel && !downloadedSentinel
      ? "PASS_DENIED"
      : listedSentinel
        ? "FAIL_LIST_VISIBLE"
        : "FAIL_DOWNLOAD_ALLOWED",
    listedSentinel,
    downloadedSentinel,
    listError: safeError(cameraSnapshotList.error),
    downloadError: safeError(cameraSnapshotDownload.error)
  };

  const cameraColumns = [
    "id",
    "dvr_host_encrypted",
    "username_encrypted",
    "password_encrypted",
    "connection_host",
    "connection_username_encrypted",
    "connection_password_encrypted",
    "encrypted_password",
    "secret_ref"
  ].join(",");
  const cameras = await client.from("camera_streams").select(cameraColumns).limit(25);
  const cameraRows = Array.isArray(cameras.data) ? cameras.data : [];
  const populatedColumns = [...new Set(cameraRows.flatMap((row) => Object.entries(row)
    .filter(([column, value]) => column !== "id" && value !== null && value !== "")
    .map(([column]) => column)))].sort();
  base.probes.cameraCredentialColumns = {
    rows: cameraRows.length,
    containsSensitiveValue: populatedColumns.length > 0,
    populatedColumns,
    accessStatus: populatedColumns.length > 0
      ? "FAIL_EXPOSED"
      : cameras.error?.code === "42501"
        ? "PASS_DENIED"
        : "PASS_NO_VALUES",
    error: safeError(cameras.error)
  };

  if (account.key.startsWith("parent_")) {
    base.probes.parentRows = await probeRows(client, "parents", "id,profile_id");
  }
  if (account.key.startsWith("staff_")) {
    base.probes.staffRows = await probeRows(client, "staff", "id,profile_id,garden_id");
  }
  if (account.key.startsWith("inspector_")) {
    base.probes.inspectorRows = await probeRows(client, "inspectors", "id");
    base.probes.inspectorGardenAssignments = await probeRows(client, "gardens", "id", (query) => query.eq("inspector_id", login.data.user.id));
  }
  if (account.key === "digital_observer") {
    base.probes.observerSitesOwned = await probeRows(client, "observer_sites", "id", (query) => query.eq("owner_profile_id", login.data.user.id));
    base.probes.observerMemberships = await probeRows(client, "observer_site_memberships", "id,observer_site_id", (query) => query.eq("profile_id", login.data.user.id));
  }

  await client.auth.signOut();
  return base;
}

const sentinelUpload = await serviceClient.storage
  .from(cameraSnapshotBucket)
  .upload(cameraSnapshotProbePath, transparentPixelPng, {
    contentType: "image/png",
    cacheControl: "0",
    upsert: false
  });
if (sentinelUpload.error) {
  throw new Error(`Unable to create the synthetic storage boundary sentinel: ${safeError(sentinelUpload.error)?.code}`);
}

const results = [];
let sentinelCleanup;
try {
  for (const account of accounts) {
    results.push(await runAccount(account));
  }
} finally {
  sentinelCleanup = await serviceClient.storage
    .from(cameraSnapshotBucket)
    .remove([cameraSnapshotProbePath]);
}

const payload = {
  generatedAt: new Date().toISOString(),
  method: "Normal Supabase password authentication with the public browser key. A server-only service client creates and removes one synthetic storage sentinel; browser-role probes never receive that key.",
  privacy: "Only role/status/count/error metadata is stored. Emails, passwords, row identifiers and row contents are omitted.",
  storageSentinel: {
    setup: "PASS",
    cleanup: sentinelCleanup?.error ? "FAIL" : "PASS",
    cleanupError: safeError(sentinelCleanup?.error)
  },
  results,
  assertions: []
};

function addAssertion(name, passed, evidence) {
  payload.assertions.push({ name, status: passed ? "PASS" : "FAIL", evidence });
}

const byAccount = Object.fromEntries(results.map((item) => [item.account, item]));
addAssertion("all_demo_roles_login", results.length === 9 && results.every((item) => item.login === "PASS"), `${results.filter((item) => item.login === "PASS").length}/9`);
addAssertion("camera_credentials_denied", results.every((item) => item.probes.cameraCredentialColumns?.accessStatus === "PASS_DENIED"), results.map((item) => `${item.account}:${item.probes.cameraCredentialColumns?.accessStatus}`).join(","));
addAssertion("camera_snapshot_storage_browser_access_denied", results.every((item) => item.probes.cameraSnapshotStorage?.accessStatus === "PASS_DENIED"), results.map((item) => `${item.account}:${item.probes.cameraSnapshotStorage?.accessStatus}`).join(","));
addAssertion("parent_raw_ai_denied", byAccount.parent_assigned?.probes.rawAiEvents?.rows === 0 && byAccount.parent_unassigned?.probes.rawAiEvents?.rows === 0, "assigned/unassigned parent raw AI rows must both be zero");
addAssertion("unassigned_sensitive_rows_empty", ["parent_unassigned", "staff_unassigned", "inspector_unassigned"].every((key) => byAccount[key]?.probes.children?.rows === 0), "unassigned parent/staff/inspector child rows must be zero");
addAssertion("normal_roles_provider_health_denied", results.filter((item) => item.account !== "admin").every((item) => item.probes.providerHealth?.rows === 0), "provider health rows must be zero outside admin");
addAssertion("assigned_role_fixtures_visible", ["parent_assigned", "manager", "staff_assigned", "inspector_assigned"].every((key) => (byAccount[key]?.probes.children?.rows ?? 0) > 0), "assigned fixtures must have scoped synthetic child rows");
addAssertion("inspector_assignment_states", (byAccount.inspector_assigned?.probes.inspectorGardenAssignments?.rows ?? 0) > 0 && byAccount.inspector_unassigned?.probes.inspectorGardenAssignments?.rows === 0, "assigned inspector has garden; unassigned inspector has none");
addAssertion("digital_observer_rls_non_recursive", !byAccount.digital_observer?.probes.observerSitesOwned?.error && !byAccount.digital_observer?.probes.observerMemberships?.error && (byAccount.digital_observer?.probes.observerMemberships?.rows ?? 0) > 0, "observer site/membership reads complete without policy recursion");

const outputPath = resolve(process.cwd(), REPORT_PATH);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const logins = results.filter((item) => item.login === "PASS").length;
const failed = results.filter((item) => item.login === "FAIL").length;
const sensitive = results.filter((item) => item.probes.cameraCredentialColumns?.containsSensitiveValue).map((item) => item.account);
const assertionFailures = payload.assertions.filter((item) => item.status === "FAIL");
console.log(`Role boundary probes complete: ${logins} login PASS, ${failed} login FAIL.`);
console.log(`Camera credential values visible to these QA roles: ${sensitive.length ? sensitive.join(", ") : "none"}.`);
console.log(`Boundary assertions: ${payload.assertions.length - assertionFailures.length} PASS, ${assertionFailures.length} FAIL.`);
console.log(`Synthetic camera snapshot sentinel cleanup: ${payload.storageSentinel.cleanup}.`);
console.log(`Sanitized report: ${REPORT_PATH}`);
if (assertionFailures.length || payload.storageSentinel.cleanup !== "PASS") process.exitCode = 1;
