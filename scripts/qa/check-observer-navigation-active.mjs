import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isObserverNavActive } from "../../lib/ui/observer-navigation.ts";

test("navigation highlights exact and nested routes only", () => {
  assert.equal(isObserverNavActive("/digital-observer/cameras", "/digital-observer/cameras"), true);
  assert.equal(isObserverNavActive("/digital-observer/cameras/live", "/digital-observer/cameras"), true);
  assert.equal(isObserverNavActive("/digital-observer/cameras-old", "/digital-observer/cameras"), false);
  assert.equal(isObserverNavActive("/digital-observer/dashboard-extra", "/digital-observer/dashboard"), false);
  const adminHrefs = ["/digital-observer/admin", "/digital-observer/admin/access"];
  assert.equal(isObserverNavActive("/digital-observer/admin/access", adminHrefs[0], adminHrefs), false);
  assert.equal(isObserverNavActive("/digital-observer/admin/access", adminHrefs[1], adminHrefs), true);
  assert.equal(isObserverNavActive("/digital-observer/admin/unknown", adminHrefs[0], adminHrefs), true);
});

test("all three Observer navigation surfaces expose the active page", () => {
  const shell = readFileSync(new URL("../../components/digital-observer/observer-app-shell.tsx", import.meta.url), "utf8");
  assert.equal((shell.match(/isObserverNavActive\(activeHref, item\.href, navHrefs\)/g) ?? []).length, 3);
  assert.equal((shell.match(/aria-current=\{active \? "page" : undefined\}/g) ?? []).length, 3);
});
