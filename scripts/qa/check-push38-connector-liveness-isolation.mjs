import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createEventCaptureWorkspace } from "../../services/video-gateway/event-capture-workspace.mjs";

const defaultWorkspace = createEventCaptureWorkspace();
const defaultCapture = defaultWorkspace.create();
try {
  assert.notEqual(dirname(defaultCapture), tmpdir(), "runtime must never scan the broad operating-system temp root");
  assert.equal(dirname(defaultCapture), join(tmpdir(), "gan-batuach-event-capture-workspaces-v1"));
} finally {
  assert.equal(defaultWorkspace.dispose(defaultCapture), true);
}

const parent = mkdtempSync(join(tmpdir(), "push38-event-capture-isolation-"));
try {
  const dedicated = join(parent, "dedicated");
  const unrelated = join(parent, "gan-batuach-anchored-event-unrelated");
  mkdirSync(unrelated, { mode: 0o700 });
  const workspace = createEventCaptureWorkspace({ root: dedicated });
  const capture = workspace.create();
  assert.equal(dirname(capture), dedicated);
  workspace.reap();
  assert.equal(existsSync(unrelated), true, "bounded reaper must not inspect or remove sibling temp state");
  assert.equal(workspace.dispose(capture), true);

  const unsafe = join(parent, "unsafe");
  mkdirSync(unsafe, { mode: 0o755 });
  chmodSync(unsafe, 0o755);
  assert.throws(() => createEventCaptureWorkspace({ root: unsafe }), /EVENT_CAPTURE_WORKSPACE_ROOT_UNSAFE/);
} finally {
  rmSync(parent, { recursive: true, force: true });
}

console.log("PUSH 38 Connector liveness isolation checks passed: private bounded workspace, no broad temp scan, fail-closed permissions.");
