import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { safeObserverReturnPath } from "../../lib/domain/digital-observer/safe-return-path.ts";

const fallback = "/digital-observer/dashboard";

test("retains exact Observer return routes and query parameters", () => {
  for (const path of ["/digital-observer", "/digital-observer/dashboard", "/digital-observer/sites/123?site=abc", "/digital-observer/login?next=%2Fdigital-observer%2Fdashboard"]) {
    assert.equal(safeObserverReturnPath(path), path);
  }
});

test("rejects encoded and literal traversal before URL redirect normalization", () => {
  const escaped = "/digital-observer/%2e%2e/dashboard/admin";
  assert.equal(escaped.startsWith("/digital-observer"), true); // previous guard accepted it
  assert.equal(new URL(escaped, "https://app.example").pathname, "/dashboard/admin");
  for (const path of ["/digital-observer/%2e%2e/dashboard/admin", "/digital-observer/../dashboard/admin", "/digital-observer/%2F..%2Fdashboard", "/digital-observer\\..\\dashboard", "/digital-observer//../admin"]) {
    assert.equal(safeObserverReturnPath(path), fallback);
  }
});

test("rejects product-prefix confusion and external redirects", () => {
  for (const path of ["/digital-observer.evil/path", "//evil.example/digital-observer", "https://evil.example/digital-observer", "/dashboard/admin", "/digital-observer\n/admin", "/digital-observer#fragment"]) {
    assert.equal(safeObserverReturnPath(path), fallback);
  }
});

test("both Observer sign-in paths use the same guard", () => {
  const action = readFileSync(new URL("../../app/login/actions.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../app/api/digital-observer/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(action, /safeObserverReturnPath\(requestedNext\)/);
  assert.match(route, /safeObserverReturnPath\(String\(formData\.get\("next"\)/);
});
