import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isObserverNavActive } from "../../lib/ui/observer-navigation.ts";

test("navigation highlights exact and nested routes only", () => {
  assert.equal(isObserverNavActive("/digital-observer/cameras", "/digital-observer/cameras"), true);
  assert.equal(isObserverNavActive("/digital-observer/cameras/live", "/digital-observer/cameras"), true);
  assert.equal(isObserverNavActive("/digital-observer/cameras-old", "/digital-observer/cameras"), false);
  assert.equal(isObserverNavActive("/digital-observer/dashboard-extra", "/digital-observer/dashboard"), false);
});

test("all three Observer navigation surfaces expose the active page", () => {
  const shell = readFileSync(new URL("../../components/digital-observer/observer-app-shell.tsx", import.meta.url), "utf8");
  assert.equal((shell.match(/isObserverNavActive\(activeHref, item\.href\)/g) ?? []).length, 3);
  assert.equal((shell.match(/aria-current=\{active \? "page" : undefined\}/g) ?? []).length, 3);
});
