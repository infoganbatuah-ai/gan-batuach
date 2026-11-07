import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const original = readFileSync(new URL("../../supabase/migrations/20260912070000_management_staff_hiring_lifecycle.sql", import.meta.url), "utf8");
const repair = readFileSync(new URL("../../supabase/migrations/20261107165001_management_candidate_review_actor_role.sql", import.meta.url), "utf8");
const oldBlock = original.slice(original.indexOf("create or replace function public.decide_staff_job_application("), original.indexOf("create or replace function public.respond_staff_job_application("));
const oldBody = oldBlock.match(/\$\$([\s\S]*?)\$\$/)?.[1]?.trim();
const newBody = repair.match(/\$function\$([\s\S]*?)\$function\$/)?.[1]?.trim();

test("repair changes only the existing audit role cast, retaining transition and authorization logic", () => {
  assert.ok(oldBody && newBody);
  assert.equal(oldBody.split("public.current_role()::text").length, 2);
  assert.equal(newBody, oldBody.replace("public.current_role()::text", "public.current_role()::public.app_role"));
  assert.match(newBody, /public\.can_manage_garden\(application\.garden_id\)/);
  assert.match(newBody, /for update/);
});

test("function signature, return, definer and search path remain fixed", () => {
  assert.match(repair, /CREATE OR REPLACE FUNCTION public\.decide_staff_job_application\(target_application_id uuid, target_action text, target_reason text DEFAULT NULL::text, target_role text DEFAULT NULL::text, target_classroom_id uuid DEFAULT NULL::uuid\)/);
  assert.match(repair, /RETURNS jsonb\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path TO 'public'/i);
  assert.equal((repair.match(/CREATE OR REPLACE FUNCTION/gi) ?? []).length, 1);
  assert.doesNotMatch(repair, /\b(?:DROP|ALTER|TRUNCATE|GRANT|REVOKE)\s+(?:TABLE|FUNCTION|ROLE|POLICY|ON)\b/i);
});
