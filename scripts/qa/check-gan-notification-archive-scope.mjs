import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { scopeActiveGanNotifications } from "../../lib/domain/gan-notification-visibility.ts";

test("notification list and unread count share the same recipient and archive scope", () => {
  for (const kind of ["list", "count"]) {
    const calls = [];
    const query = {
      or(value) { calls.push(["or", value]); return this; },
      is(column, value) { calls.push(["is", column, value]); return this; }
    };
    assert.equal(scopeActiveGanNotifications(query, "owner-id"), query, kind);
    assert.deepEqual(calls, [
      ["or", "recipient_id.eq.owner-id,recipient_profile_id.eq.owner-id"],
      ["is", "archived_at", null]
    ], kind);
  }
});

test("the live notification route applies the active scope to both queries", () => {
  const route = readFileSync(new URL("../../app/api/notifications/route.ts", import.meta.url), "utf8");
  assert.equal((route.match(/scopeActiveGanNotifications\(/g) ?? []).length, 2);
  assert.match(route, /scopeActiveGanNotifications\(supabase[\s\S]*?\.order\("created_at"/);
  assert.match(route, /const count = await scopeActiveGanNotifications\(/);
});
