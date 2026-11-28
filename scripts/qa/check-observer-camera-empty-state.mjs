import assert from "node:assert/strict";
import { test } from "node:test";
import { observerCameraEmptyState } from "../../lib/ui/observer-camera-empty-state.ts";

test("filter misses permit reset even when the selected status has matches outside the search", () => {
  for (const status of ["active", "offline", "all"]) {
    const state = observerCameraEmptyState({ cameraCount: 3, offlineCount: 1, status });
    assert.equal(state.title, "לא נמצאו מצלמות לפי הסינון");
    assert.equal(state.action, "clear_filters");
  }
});

test("no assigned cameras and no offline cameras have distinct actions", () => {
  assert.equal(observerCameraEmptyState({ cameraCount: 0, offlineCount: 0, status: "offline" }).action, "add_camera");
  assert.equal(observerCameraEmptyState({ cameraCount: 3, offlineCount: 0, status: "offline" }).action, "none");
});
