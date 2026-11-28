import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { requestGanMarkAllRead } from "../../lib/domain/gan-notification-read-all.ts";

test("mark-all covers unread notifications beyond the 30-row bell preview", async () => {
  let request;
  const result = await requestGanMarkAllRead(async (url, init) => {
    request = { url, init };
    return { ok: true };
  });
  assert.equal(result, true);
  assert.equal(request.url, "/api/notifications/mark-read");
  assert.deepEqual(JSON.parse(request.init.body), {});
});

test("mark-all never updates the UI on a failed server response", async () => {
  assert.equal(await requestGanMarkAllRead(async () => ({ ok: false })), false);
});

test("the bell uses the unbounded mark-all request rather than preview IDs", () => {
  const bell = readFileSync(new URL("../../components/notification-bell.tsx", import.meta.url), "utf8");
  assert.match(bell, /requestGanMarkAllRead\(fetch\)/);
  assert.doesNotMatch(bell, /const ids = rows\.map/);
});
