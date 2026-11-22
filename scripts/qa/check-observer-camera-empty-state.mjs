import assert from "node:assert/strict";
import { test } from "node:test";
import { observerCameraEmptyState } from "../../lib/ui/observer-camera-empty-state.ts";

test("a filter miss does not claim that live cameras are absent", () => {
  const state = observerCameraEmptyState({ cameraCount: 3, offlineCount: 1, status: "active", hasFilter: true });
  assert.equal(state.title, "לא נמצאו מצלמות לפי הסינון");
  assert.equal(state.action, "clear_filters");
});

test("true camera absence and offline views keep their distinct actions", () => {
  assert.equal(observerCameraEmptyState({ cameraCount: 0, offlineCount: 0, hasFilter: false }).action, "add_camera");
  assert.equal(observerCameraEmptyState({ cameraCount: 3, offlineCount: 3, hasFilter: false }).action, "show_offline");
  assert.equal(observerCameraEmptyState({ cameraCount: 3, offlineCount: 0, status: "offline", hasFilter: true }).action, "none");
  assert.equal(observerCameraEmptyState({ cameraCount: 0, offlineCount: 0, status: "offline", hasFilter: true }).action, "add_camera");
});
