import assert from "node:assert/strict";
import test from "node:test";
import { mergeLoadedInspectionAnswers, settleInspectionDraftLoad } from "../../lib/management/inspection-draft-state.ts";

test("late empty draft leaves a newly entered score intact and unsaved", () => {
  const local = { questionA: { score: 8 } };
  const merged = mergeLoadedInspectionAnswers({}, local);
  assert.deepEqual(merged, local);
  assert.equal(settleInspectionDraftLoad("dirty", 0), "dirty");
});

test("late existing draft adds other answers but cannot overwrite a local edit", () => {
  const saved = { questionA: { score: 4 }, questionB: { score: 9, note: "saved note" } };
  const local = { questionA: { score: 8 } };
  assert.deepEqual(mergeLoadedInspectionAnswers(saved, local), {
    questionA: { score: 8 },
    questionB: { score: 9, note: "saved note" },
  });
  assert.equal(settleInspectionDraftLoad("dirty", 2), "dirty");
});

test("untouched form restores persisted answers and saved state", () => {
  const saved = { questionA: { score: 7 } };
  assert.deepEqual(mergeLoadedInspectionAnswers(saved, {}), saved);
  assert.equal(settleInspectionDraftLoad("loading", 1), "saved");
  assert.equal(settleInspectionDraftLoad("loading", 0), "idle");
});

test("late load cannot erase an in-flight save state", () => {
  assert.equal(settleInspectionDraftLoad("saving", 1), "saving");
  assert.equal(settleInspectionDraftLoad("saved", 0), "saved");
});
