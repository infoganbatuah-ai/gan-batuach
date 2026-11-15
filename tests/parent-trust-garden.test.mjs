import assert from "node:assert/strict";
import { test } from "node:test";
import { belongsToParentTrustGarden, parentTrustGardenIds, resolveParentTrustGarden } from "../lib/domain/parent-trust-garden.ts";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreign = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("active parent links and enrollments allow two Gardens while pending/ended links do not", () => {
  const eligible = parentTrustGardenIds({
    links: [{ garden_id: a, status: "active" }, { garden_id: foreign, status: "pending" }],
    enrollments: [{ garden_id: b, status: "approved" }, { garden_id: foreign, status: "ended" }],
    gardenIds: [a, b, foreign], sourceUnavailable: false
  });
  assert.deepEqual(eligible, [a, b]);
  assert.equal(resolveParentTrustGarden(a, eligible), a);
  assert.equal(resolveParentTrustGarden(b, eligible), b);
  assert.equal(resolveParentTrustGarden(foreign, eligible), null);
  assert.equal(resolveParentTrustGarden(undefined, eligible), null);
});

test("a single active Garden keeps implicit selection while an unverified link does not", () => {
  assert.equal(resolveParentTrustGarden(undefined, [a]), a);
  assert.deepEqual(parentTrustGardenIds({ links: [{ garden_id: a, status: "active" }], enrollments: [], gardenIds: [a], sourceUnavailable: false }), [a]);
  assert.deepEqual(parentTrustGardenIds({ links: [{ garden_id: a, status: "pending" }], enrollments: [], gardenIds: [a], sourceUnavailable: false }), []);
});

test("membership source failures fail closed", () => {
  assert.deepEqual(parentTrustGardenIds({ links: [{ garden_id: a, status: "active" }], enrollments: [], gardenIds: [a], sourceUnavailable: true }), []);
});

test("cross-Garden surveys and events are rejected; only active global surveys may be considered", () => {
  assert.equal(belongsToParentTrustGarden({ garden_id: b }, a), false);
  assert.equal(belongsToParentTrustGarden({ garden_id: b }, a, true), false);
  assert.equal(belongsToParentTrustGarden({ garden_id: null }, a), false);
  assert.equal(belongsToParentTrustGarden({ garden_id: null }, a, true), true);
  assert.equal(belongsToParentTrustGarden({ garden_id: a }, a), true);
});
