import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) { return specifier.startsWith(".") && context.parentURL?.endsWith(".ts") ? next(`${specifier}.ts`, context) : next(specifier, context); },
  load(url, context, next) { return url.endsWith(".ts") ? { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText } : next(url, context); }
});

const { chooseActiveGarden } = await import("../../lib/management/garden-selection.ts");

const source = file => readFileSync(file, "utf8");
const migration = source("supabase/migrations/20260911010000_management_multi_garden_memberships.sql");

test("one canonical membership model supports multiple garden relationships", () => {
  assert.match(migration, /create table if not exists public\.garden_management_memberships/);
  assert.match(migration, /unique \(profile_id, garden_id, relationship_role\)/);
  assert.match(migration, /relationship_role in \('owner', 'manager'\)/);
  assert.match(migration, /status in \('pending', 'active', 'inactive', 'revoked'\)/);
  assert.match(migration, /garden_management_memberships_one_default_idx/);
});

test("backfill grants only deterministic legacy owner and manager authority", () => {
  assert.match(migration, /g\.owner_profile_id/);
  assert.match(migration, /g\.manager_id/);
  assert.match(migration, /p\.role::text in \('owner', 'manager'\)/);
  assert.doesNotMatch(migration, /owner_name.*profile_id|email.*profile_id/);
});

test("can_manage_garden proves an active relationship for every requested garden", () => {
  const body = migration.slice(migration.indexOf("create or replace function public.can_manage_garden"), migration.indexOf("create or replace function public.management_gardens_for_current_user"));
  assert.match(body, /membership\.profile_id = auth\.uid\(\)/);
  assert.match(body, /membership\.garden_id = target_garden_id/);
  assert.match(body, /membership\.status = 'active'/);
  assert.match(body, /garden\.status::text.*not in \('inactive', 'suspended', 'closed', 'rejected'\)/s);
  assert.doesNotMatch(body, /profile\.garden_id = target_garden_id/);
});

test("active context selection never turns an unauthorized id into a fallback", async () => {
  const gardens = [
    { id: "A", name: "A", relationshipRole: "owner", isDefault: true },
    { id: "B", name: "B", relationshipRole: "owner", isDefault: false }
  ];
  assert.equal(chooseActiveGarden(gardens, "A", null).id, "A");
  assert.equal(chooseActiveGarden(gardens, "B", null).id, "B");
  assert.equal(chooseActiveGarden(gardens, "C", "A"), null);
  assert.equal(chooseActiveGarden(gardens.slice(0, 1), null, null).id, "A");
  assert.equal(chooseActiveGarden(gardens.map(g => ({ ...g, isDefault: false })), null, null), null);
});

test("server-backed switch verifies authority before setting the context cookie", () => {
  const route = source("app/api/management/gardens/route.ts");
  const authorityAt = route.indexOf('rpc("can_manage_garden"');
  const cookieAt = route.indexOf("cookieStore.set");
  assert.ok(authorityAt > 0 && cookieAt > authorityAt);
  assert.match(route, /authority\.data !== true/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /management_garden_context_switched/);
});

test("all garden pages and guarded service routes receive the validated active context", () => {
  assert.match(source("lib/auth.ts"), /resolveManagementGardenContext/);
  assert.match(source("lib/management/garden-context.ts"), /context\.activeGarden\?\.id/);
  assert.match(source("lib/management/garden-context.ts"), /rpc\("can_manage_garden"/);
  assert.match(source("lib/management/operational-role.ts"), /gardenContext\.activeGarden\?\.id/);
});

test("owner-teacher and delegated teacher authority remain garden specific", () => {
  const teaching = source("supabase/migrations/20260910050000_management_teaching_assignments.sql");
  assert.match(teaching, /assignment\.garden_id = target_garden_id/);
  assert.match(teaching, /garden\.owner_profile_id = profile\.id/);
  assert.match(teaching, /employment\.garden_id = assignment\.garden_id/);
});

test("representative child attendance staff message and document policies remain garden scoped", () => {
  const rls = source("supabase/migrations/20260523000000_initial_schema.sql") + source("supabase/migrations/20260616000100_parent_rls_scope_hardening.sql");
  for (const table of ["children", "attendance", "staff", "messages", "documents"]) assert.match(rls, new RegExp(table), `${table} missing from tenant RLS migration`);
  assert.match(rls, /can_manage_garden\(garden_id\)/);
});

test("admin membership lifecycle supports independent grant revocation and audit", () => {
  const route = source("app/api/admin/garden-memberships/route.ts");
  assert.match(route, /requireRole\(\["admin"\]\)/);
  assert.match(route, /z\.literal\("grant"\)/);
  assert.match(route, /z\.literal\("revoke"\)/);
  assert.match(route, /garden_membership_\$\{payload\.action\}/);
});
