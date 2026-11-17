import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseGanNotificationFeed } from "../../lib/domain/gan-notification-feed.ts";

test("failed notification responses cannot masquerade as an empty feed", () => {
  assert.equal(parseGanNotificationFeed(false, { data: { rows: [], unread: 0 } }), null);
  assert.equal(parseGanNotificationFeed(true, { data: { rows: [], unread: 0, warning: "read failed" } }), null);
  assert.equal(parseGanNotificationFeed(true, {}), null);
  assert.equal(parseGanNotificationFeed(true, { data: { rows: "bad", unread: 0 } }), null);
  assert.equal(parseGanNotificationFeed(true, { data: { rows: [], unread: -1 } }), null);
});

test("a successful empty feed remains distinguishable from a read failure", () => {
  assert.deepEqual(parseGanNotificationFeed(true, { data: { rows: [], unread: 0 } }), { rows: [], unread: 0 });
});

test("the bell exposes load failure instead of silently showing no notifications", () => {
  const bell = readFileSync(new URL("../../components/notification-bell.tsx", import.meta.url), "utf8");
  assert.match(bell, /parseGanNotificationFeed\(response\.ok, body\)/);
  assert.match(bell, /role="alert"/);
  assert.match(bell, /disabled=\{loadError\}/);
});
