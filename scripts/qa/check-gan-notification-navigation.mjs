import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { safeGanNotificationDestination } from "../../lib/domain/gan-notification-destination.ts";

test("stored notification hints cannot navigate outside Gan's local Product routes", () => {
  for (const value of [
    "https://attacker.example.invalid/login",
    "//attacker.example.invalid/login",
    "javascript:alert(1)",
    "/digital-observer/alerts",
    "/onboarding/admin",
    "/onboarding/kindergarten/other",
    "/api/auth/logout",
    "/dashboard/../digital-observer/alerts",
    "/dashboard/%2e%2e/api/auth/logout",
    "/dashboard/%2f%2fexample.invalid",
    "/dashboard\\example.invalid",
    "/dashboard#spoofed",
    "/dashboard /parent",
    null
  ]) assert.equal(safeGanNotificationDestination(value), null, String(value));
});

test("legitimate Gan dashboard and onboarding links remain available", () => {
  for (const value of [
    "/dashboard", "/dashboard/parent/notifications",
    "/dashboard/garden/children?status=pending",
    "/parent-onboarding?childId=00000000-0000-4000-8000-000000000001",
    "/onboarding/kindergarten", "/onboarding/staff"
  ]) assert.equal(safeGanNotificationDestination(value), value);
});

test("notification navigation rejects credential-like query keys without blocking ordinary filters", () => {
  for (const value of [
    "/dashboard?access_token=synthetic",
    "/dashboard/parent/notifications?code=synthetic",
    "/dashboard?%61ccess_token=synthetic",
    "/dashboard?token_hash=synthetic"
  ]) assert.equal(safeGanNotificationDestination(value), null, value);
  assert.equal(safeGanNotificationDestination("/dashboard/garden/children?status=pending"),
    "/dashboard/garden/children?status=pending");
});

test("existing manager and staff notification producers target the exact allowed onboarding pages", () => {
  const manager = readFileSync(new URL("../../app/api/admin/kindergarten-approval/route.ts", import.meta.url), "utf8");
  const staff = readFileSync(new URL("../../app/api/garden/staff/[id]/approve/route.ts", import.meta.url), "utf8");
  assert.match(manager, /metadata: \{ href: "\/onboarding\/kindergarten"/);
  assert.match(staff, /metadata: \{ href: payload\.action === "approve" \? "\/dashboard\/staff" : "\/onboarding\/staff" \}/);
});

test("both in-app notification entrypoints use the same destination guard", () => {
  const bell = readFileSync(new URL("../../components/notification-bell.tsx", import.meta.url), "utf8");
  const center = readFileSync(new URL("../../components/notification-center.tsx", import.meta.url), "utf8");
  for (const source of [bell, center]) {
    assert.match(source, /safeGanNotificationDestination\(item\.action_url\)/);
    assert.match(source, /safeGanNotificationDestination\(item\.metadata\?\.href\)/);
  }
});
