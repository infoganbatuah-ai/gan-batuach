import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const delegate = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
function member(signature) {
  const start = delegate.indexOf(signature);
  assert.notEqual(start, -1, signature);
  return delegate.slice(start, delegate.indexOf("\n    }", start));
}

test("capture state is sampled at window assignment, launch, change, foreground and activation", () => {
  for (const entry of ["var window: UIWindow?", "didFinishLaunchingWithOptions", "func screenCaptureStateChanged()",
    "func applicationWillEnterForeground(", "func applicationDidBecomeActive("]) {
    assert.match(member(entry), /\bupdateCaptureShield\(\)/, entry);
  }
  assert.match(member("didFinishLaunchingWithOptions"), /#selector\(screenCaptureStateChanged\)[\s\S]*UIScreen\.capturedDidChangeNotification/);
});

test("shield reconciliation releases stale overlays and keeps one overlay above the current window", () => {
  const body = member("private func updateCaptureShield()");
  assert.match(body, /guard UIScreen\.main\.isCaptured, let window = window else \{\s*captureShieldView\?\.removeFromSuperview\(\)\s*captureShieldView = nil\s*return\s*\}/);
  assert.match(body, /let shield = captureShieldView \?\? UIView\(/);
  assert.match(body, /if shield\.superview !== window \{[\s\S]*window\.addSubview\(shield\)\s*captureShieldView = shield\s*\} else \{\s*window\.bringSubviewToFront\(shield\)/);
});
