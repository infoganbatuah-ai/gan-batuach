// Static review-package containment only. Never connects to a database.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const sql = readFileSync("review-only/push-registration-binding/forward.sql", "utf8");
const report = readFileSync("review-only/push-registration-binding/IMPLEMENTATION-QUALIFICATION.md", "utf8");
const register = readFileSync("app/api/push/register/route.ts", "utf8");
const unregister = readFileSync("app/api/push/unregister/route.ts", "utf8");
const service = readFileSync("lib/domain/push-service.ts", "utf8");
const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"));

const checks = [
  ["review guard", /^begin;\s*do \$\$ begin raise exception 'REVIEW_ONLY_PUSH_BINDING_MUST_NOT_RUN'; end \$\$;/m.test(sql)],
  ["outside active migrations", !migrations.some((name) => readFileSync(`supabase/migrations/${name}`, "utf8").includes("guard_observer_push_token_binding"))],
  ["observer-only unique predicate", /create unique index push_tokens_observer_active_installation_uq[\s\S]*?where is_active and device_id is not null[\s\S]*?digital_observer_native/.test(sql)],
  ["legacy conflict fail closed", sql.includes("PUSH_BINDING_ACTIVE_INSTALLATION_CONFLICT") && sql.includes("PUSH_BINDING_LEGACY_ROWS_REQUIRE_OWNER_REVIEW")],
  ["write trigger", /before insert or update or delete on public\.push_device_tokens/.test(sql)],
  ["binding immutability", sql.includes("OBSERVER_PUSH_REPLAY_BINDING_DENIED") && sql.includes("OBSERVER_PUSH_SOURCE_IMMUTABLE")],
  ["own scoped revoke", sql.includes("OBSERVER_PUSH_REVOKE_SCOPE_DENIED") && unregister.includes("observer_site_id")],
  ["site and session", sql.includes("digital_observer_current_session_active()") && sql.includes("observer_site_memberships")],
  ["no global admin override", !/^[^\n-]*public\.is_admin\(\)/m.test(sql)],
  ["no broad privilege change", !/\b(grant|revoke)\s+.*\bon\s+table\b/i.test(sql)],
  ["current route still direct insert", service.includes('.from("push_device_tokens").insert(') && !register.includes('.rpc(')],
  ["future PG gate explicitly open", report.includes("not ready to apply") && report.includes("not proven")]
];
for (const [name, condition] of checks) assert.ok(condition, name);
console.log(JSON.stringify({ status: "PASS_SOURCE_ONLY", checks: checks.map(([name]) => name), databaseTests: "NOT_RUN" }, null, 2));
