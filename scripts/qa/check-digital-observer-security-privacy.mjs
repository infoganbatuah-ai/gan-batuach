import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migrationFiles = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
const migrations = migrationFiles.map((file) => read(`supabase/migrations/${file}`)).join("\n");
const hardening = read("supabase/migrations/20260907010000_digital_observer_security_privacy_hardening.sql");

const checks = [];
function check(name, run) {
  run();
  checks.push(name);
}

check("canonical sensitive tables enable RLS", () => {
  for (const table of [
    "observer_sites",
    "digital_observer_camera_sources",
    "observer_intelligence_signals",
    "observer_correlated_events",
    "digital_observer_event_clips",
    "digital_observer_risk_evaluations",
    "digital_observer_decision_intents",
    "digital_observer_incident_verifications",
    "digital_observer_feedback_revisions",
    "digital_observer_calibration_samples",
    "digital_observer_calibration_recommendations",
    "digital_observer_watch_rule_versions",
    "digital_observer_watch_rule_evaluations"
  ]) {
    assert.match(migrations, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
  }
});

check("canonical reads are tenant or privileged scoped", () => {
  for (const marker of [
    "digital observer camera sources scoped read",
    "observer signals standalone member read",
    "correlated events scoped read",
    "digital observer clips scoped read",
    "digital observer risk evaluations scoped read",
    "digital observer decision intents scoped read",
    "digital observer incident verifications scoped read",
    "digital observer feedback scoped read",
    "digital observer watch rule versions scoped read",
    "digital observer watch rule evaluations scoped read"
  ]) assert.match(migrations.toLowerCase(), new RegExp(marker));
});

check("immutable product history rejects direct anonymous and authenticated mutation", () => {
  assert.match(hardening, /revoke all on table public\.digital_observer_risk_evaluations from anon/i);
  assert.match(hardening, /revoke insert, update, delete on table public\.digital_observer_risk_evaluations from authenticated/i);
  assert.match(hardening, /revoke insert, update, delete on table public\.digital_observer_incident_verifications from authenticated/i);
  assert.match(hardening, /revoke insert, update, delete on table public\.digital_observer_feedback_revisions from authenticated/i);
  assert.match(hardening, /revoke insert, update, delete on table public\.digital_observer_watch_rule_evaluations from authenticated/i);
});

check("rate limiter is atomic and service-only", () => {
  assert.match(hardening, /create or replace function public\.consume_rate_limit/);
  assert.match(hardening, /on conflict \(identifier, route, window_start\) do update/i);
  assert.match(hardening, /security definer[\s\S]*set search_path = pg_catalog, pg_temp/i);
  assert.match(hardening, /revoke all on function public\.consume_rate_limit[\s\S]*from public, anon, authenticated/i);
  assert.match(hardening, /grant execute on function public\.consume_rate_limit[\s\S]*to service_role/i);
});

check("SECURITY DEFINER search paths cannot be shadowed by browser roles", () => {
  assert.match(hardening, /revoke create on schema public from public, anon, authenticated/i);
  const definitions = [...migrations.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([^\s(]+)[\s\S]*?security\s+definer[\s\S]*?\$\$;/gi)];
  assert.ok(definitions.length > 0);
  for (const definition of definitions) assert.match(definition[0], /set\s+search_path\s*=/i, `${definition[1]} must set search_path`);
});

check("privacy child requests have a restrictive ownership boundary", () => {
  assert.match(hardening, /privacy rights child ownership boundary/);
  assert.match(hardening, /as restrictive for insert to authenticated/i);
  assert.match(hardening, /can_parent_access_child\(child_id\)/i);
});

check("server secrets and encryption keys remain separated", () => {
  const admin = read("lib/supabase/admin.ts");
  const fieldEncryption = `${read("lib/security/encryption.ts")}\n${read("lib/security/field-encryption.ts")}`;
  assert.match(admin, /server-only/);
  assert.doesNotMatch(fieldEncryption, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(fieldEncryption, /FIELD_ENCRYPTION_KEY/);
});

check("canonical mutations enforce CSRF, body bounds and per-principal rate limits", () => {
  for (const route of [
    "app/api/digital-observer/incidents/feedback/route.ts",
    "app/api/digital-observer/investigation/route.ts",
    "app/api/digital-observer/watch-rules/route.ts",
    "app/api/digital-observer/events/review/route.ts",
    "app/api/digital-observer/settings/route.ts",
    "app/api/digital-observer/access-settings/route.ts",
    "app/api/digital-observer/known-people/route.ts",
    "app/api/digital-observer/identity-candidates/route.ts",
    "app/api/privacy/requests/route.ts"
  ]) {
    const source = read(route);
    assert.match(source, /assertTrustedMutationOrigin\(request\)/, `${route} must check request origin`);
    assert.match(source, /parseBoundedJson\(request/, `${route} must bound the request body`);
    assert.match(source, /assertRateLimit\(/, `${route} must rate limit`);
    assert.match(source, /handleSafeRouteError/, `${route} must use bounded failures`);
  }
});

check("rate-limit identifiers do not persist raw user, tenant or IP tuples", () => {
  const guards = read("lib/security/request-guards.ts");
  assert.match(guards, /createHash\("sha256"\)/);
  assert.match(guards, /firstForwardedIp/);
  assert.match(guards, /return `do:\$\{createHash/);
});

check("private media requires auth, ownership, short TTL and no-store redirect", () => {
  for (const route of [
    "app/api/digital-observer/event-clips/[id]/media/route.ts",
    "app/api/digital-observer/identity-candidates/[id]/preview/route.ts"
  ]) {
    const source = read(route);
    assert.match(source, /getDigitalObserverApiUser/);
    assert.match(source, /getObserverSiteAccess/);
    assert.match(source, /z\.string\(\)\.uuid\(\)/);
    assert.match(source, /createSignedUrl\([^)]*, 60/);
    assert.match(source, /Cache-Control", "private, no-store/);
    assert.match(source, /writeAuditEvent/);
  }
});

check("billing role is not a general camera, incident or evidence viewer", () => {
  const access = read("lib/domain/digital-observer/access.ts");
  assert.match(access, /options\.billing[\s\S]*\["owner", "admin", "billing"\]/);
  assert.match(access, /\["owner", "admin", "operator", "viewer"\]/);
  assert.doesNotMatch(access, /\["owner", "admin", "operator", "viewer", "billing"\]/);
});

check("CSP blocks eval, plugins, framing and inline script attributes", () => {
  const vercel = read("vercel.json");
  assert.doesNotMatch(vercel, /unsafe-eval/);
  assert.match(vercel, /object-src 'none'/);
  assert.match(vercel, /script-src-attr 'none'/);
  assert.match(vercel, /frame-ancestors 'none'/);
});

check("biometric readiness remains consented and inactive", () => {
  const knownPeople = read("app/api/digital-observer/known-people/route.ts");
  const candidates = read("app/api/digital-observer/identity-candidates/route.ts");
  assert.match(knownPeople, /consent_confirmed/);
  assert.match(knownPeople, /biometric_processing_active: false/);
  assert.match(candidates, /vision_privacy_mode/);
  assert.match(candidates, /business_handles_children/);
});

check("service role is not exposed through a public environment variable", () => {
  const tracked = [
    ...readdirSync("lib", { recursive: true }).filter((name) => typeof name === "string" && name.endsWith(".ts")).map((name) => `lib/${name}`),
    ...readdirSync("app", { recursive: true }).filter((name) => typeof name === "string" && /\.(ts|tsx)$/.test(name)).map((name) => `app/${name}`)
  ].map(read).join("\n");
  assert.doesNotMatch(tracked, /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|ENCRYPTION_KEY|PRIVATE_KEY|PASSWORD)/);
});

console.log(JSON.stringify({
  status: "PASS",
  suite: "digital-observer-security-privacy",
  checks: checks.length,
  rls_tables: 13,
  production_mutation: false,
  frozen_runtime_mutation: false
}, null, 2));
