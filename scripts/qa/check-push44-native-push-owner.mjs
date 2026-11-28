import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pushRequestBelongsToOwner } from "../../lib/domain/digital-observer/native-push-request.ts";

const runtime = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
const requestA = { requestId: "request-a", siteId: "shared-site", ownerId: "account-a" };

test("same Site does not make account A's pending registration belong to B", () => {
  assert.equal(pushRequestBelongsToOwner(requestA, "account-a"), true);
  assert.equal(pushRequestBelongsToOwner(requestA, "account-b"), false);
  assert.equal(pushRequestBelongsToOwner(requestA, null), false);
  assert.equal(pushRequestBelongsToOwner(null, "account-a"), false);
});

test("runtime fences provider callback to the initiating account and clears state on switch/401", () => {
  assert.match(runtime, /const ownedRequest = \{ \.\.\.request, ownerId: activeProfileId \};\s*pendingPushRequest = ownedRequest;/);
  assert.match(runtime, /if \(!ownerId \|\| registrationOwnerId !== ownerId\) return;/);
  assert.match(runtime, /pushRequestBelongsToOwner\(pendingPushRequest, ownerId\)/);
  assert.match(runtime, /if \(activeProfileId !== ownerId\) return;/);
  assert.match(runtime, /if \(previousOwner\.value !== profileId\) \{[\s\S]{0,500}?pendingPushRequest = null;\s*pendingPushDeadline = 0;\s*registrationOwnerId = null;/);
  assert.match(runtime, /SESSION_REVALIDATION_REQUIRED[\s\S]*?activeProfileId = null;\s*pendingPushRequest = null;\s*pendingPushDeadline = 0;\s*registrationOwnerId = null;/);
});

test("unverified native notification body stays generic and action still uses authorization route", () => {
  const mobile = readFileSync(new URL("../../lib/domain/digital-observer/mobile-runtime.ts", import.meta.url), "utf8");
  assert.match(mobile, /void data;\s*return \{ title: "תצפיתן דיגיטלי", body: "יש עדכון חדש לבדיקה באפליקציה\." \}/);
  assert.match(runtime, /pushNotificationActionPerformed[\s\S]*?authorizeAndOpen\(link\)/);
  assert.match(runtime, /fetch\("\/api\/digital-observer\/mobile\/runtime"/);
});
