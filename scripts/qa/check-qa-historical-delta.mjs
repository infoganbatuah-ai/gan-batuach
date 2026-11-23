#!/usr/bin/env node
// Verify the narrow historical source changes against the required baseline.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = "56a33389e6449df1aac41f4e48dfc515ce478d0f";
const changes = new Map([
  ["20260523000000_initial_schema.sql", [
    ["('admin', 'inspector', 'manager', 'staff', 'parent')", "('admin', 'inspector', 'manager', 'owner', 'staff', 'parent')"],
  ]],
  ["20260523012000_qa_action_persistence.sql", [["alter typeש", "alter type"]]],
  ["20260612016600_external_legal_privacy_regulatory_review_pack.sql", [[
    "'review_required', 'requested', 'needs_review', 'needs_review', 'medium'",
    "'review_required', 'needs_review', 'not_started', 'needs_review', 'medium'",
  ]]],
  ["20260827000100_digital_observer_event_media_evidence.sql", [[
    `from lateral (
  select cs.id
  from public.digital_observer_camera_sources cs
  where cs.observer_site_id = s.observer_site_id
    and coalesce(cs.status, '') in ('connected','active','ready')
    and coalesce(cs.health_status, '') in ('healthy','unknown')
  order by cs.created_at asc
  limit 1
) c
where s.observer_site_id is not null`,
    `from public.digital_observer_camera_sources c
where c.id = (
    select cs.id
    from public.digital_observer_camera_sources cs
    where cs.observer_site_id = s.observer_site_id
      and coalesce(cs.status, '') in ('connected','active','ready')
      and coalesce(cs.health_status, '') in ('healthy','unknown')
    order by cs.created_at asc
    limit 1
  )
  and s.observer_site_id is not null`,
  ]]],
  ["20260902033000_activate_scoped_digital_guard_camera_automation.sql", [[
    "  select count(*) into expected\n  from public.digital_observer_camera_sources",
    `  -- A fresh isolated installation has no Home Site to activate. Keep the
  -- original strict checks whenever that exact Site is present.
  if not exists (
    select 1 from public.observer_sites
    where id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
  ) then
    return;
  end if;
  select count(*) into expected
  from public.digital_observer_camera_sources`,
  ]]],
  ["20260902043000_activate_channel_1_guard_lighting.sql", [[
    "begin\n  if to_regprocedure('public.enqueue_digital_guard_capability_refresh_v1(uuid,text,text)')",
    `begin
  -- Empty isolated installations have no authorized Home Site. Do not
  -- activate anything; preserve every existing check when the Site exists.
  if not exists (select 1 from public.observer_sites where id = site_id) then
    return;
  end if;
  if to_regprocedure('public.enqueue_digital_guard_capability_refresh_v1(uuid,text,text)')`,
  ]]],
]);

for (const [name, substitutions] of changes) {
  const path = `supabase/migrations/${name}`;
  const before = execFileSync("git", ["show", `${base}:${path}`], { cwd: root, encoding: "utf8" });
  let expected = before;
  for (const [oldText, newText] of substitutions) {
    assert.equal(expected.split(oldText).length, 2, `${name}: baseline substitution must be unique`);
    expected = expected.replace(oldText, newText);
  }
  let actual = readFileSync(join(root, path), "utf8");
  if (name === "20260902033000_activate_scoped_digital_guard_camera_automation.sql") {
    const withoutPreflight = actual.replace(
      /  -- The next migration activates CH1\.[\s\S]*?  \) then raise exception 'A physical command requires operator reconciliation'; end if;\n/,
      "",
    );
    assert.notEqual(withoutPreflight, actual, "CH1 prerequisite preflight must be present");
    actual = withoutPreflight
      .replace("site.id,authorized.camera_id,\n  false,", "site.id,authorized.camera_id,\n  public.digital_guard_crossing_line_valid(source.metadata -> 'crossing_line'),")
      .replace("'activation_state','authorized_waiting_for_channel_1_activation',",
        "'activation_state',case when public.digital_guard_crossing_line_valid(source.metadata -> 'crossing_line')\n      then 'active' else 'authorized_waiting_for_crossing_line' end,");
  }
  if (name === "20260523000000_initial_schema.sql") {
    expected = expected.replace("create type public.app_role", "-- Fresh bootstrap must define owner before a later migration uses it in the\n-- same transaction in which ALTER TYPE ADD VALUE would otherwise run.\ncreate type public.app_role");
  }
  assert.equal(actual, expected, `${name}: unexpected historical change`);
  console.log(`PASS ${name}`);
}
