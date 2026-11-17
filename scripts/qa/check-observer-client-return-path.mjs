import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { safeObserverReturnPath } from "../../lib/domain/digital-observer/safe-return-path.ts";

test("browser login rejects a return path that URL normalization escapes", () => {
  const attack = "/digital-observer/%2e%2e/dashboard/admin";
  assert.equal(attack.startsWith("/digital-observer"), true); // prior client guard
  assert.equal(new URL(attack, "https://app.example").pathname, "/dashboard/admin");
  assert.equal(safeObserverReturnPath(attack), "/digital-observer/dashboard");
});

test("browser login preserves valid Observer routes and denies cross-product paths", () => {
  assert.equal(safeObserverReturnPath("/digital-observer/sites/123?site=abc"), "/digital-observer/sites/123?site=abc");
  for (const path of ["/digital-observer.evil/path", "/digital-observer/../dashboard/admin", "/digital-observer\\..\\admin", "//evil.example/digital-observer"]) {
    assert.equal(safeObserverReturnPath(path), "/digital-observer/dashboard");
  }
});

test("hydrated browser login uses the shared guard before navigation", () => {
  const source = readFileSync(new URL("../../components/digital-observer/observer-login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /safeObserverReturnPath\(submittedNextPath\)/);
  assert.doesNotMatch(source, /function safeReturnPath\(/);
  assert.match(source, /window\.location\.assign\(destination\)/);
});
