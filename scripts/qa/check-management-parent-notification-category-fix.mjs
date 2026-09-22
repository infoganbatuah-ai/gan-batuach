import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260922120000_management_parent_notification_category_fix.sql", "utf8");
const route = readFileSync("app/api/profile/communication-preferences/route.ts", "utf8");
const component = readFileSync("components/parent-notification-preferences.tsx", "utf8");

const parentCategories = ["important", "safety", "attendance", "message", "document", "payment", "pickup"];

test("forward migration permits every Parent notification preference category", () => {
  for (const category of parentCategories) assert.match(migration, new RegExp(`'${category}'`));
  assert.match(migration, /drop constraint if exists push_category_preferences_category_check/);
  assert.match(migration, /add constraint push_category_preferences_category_check/);
});

test("route filters writes to the same canonical Parent category list", () => {
  for (const category of parentCategories) assert.match(route, new RegExp(`"${category}"`));
  assert.match(route, /includes\(category\)/);
});

test("Parent UI persists quiet hours and category preferences through the canonical endpoint", () => {
  assert.match(component, /\/api\/profile\/communication-preferences/);
  assert.match(component, /push_category_preferences: categoryEnabled/);
  assert.match(component, /quiet_hours_start/);
  assert.match(component, /quiet_hours_end/);
});
