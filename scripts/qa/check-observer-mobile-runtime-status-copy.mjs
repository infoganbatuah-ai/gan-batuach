import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");

test("native session uncertainty keeps protected content covered and reports it honestly", () => {
  assert.match(source, /stale && mobileRuntimeRequiresSession\(window\.location\.pathname\)/);
  assert.match(source, /position: "fixed", inset: 0, zIndex: 2147483647/);
  assert.match(source, /המידע המוגן מוסתר עד להשלמת אימות מחדש/);
  assert.match(source, /אין חיבור רשת\. המידע המוגן מוסתר/);
  assert.doesNotMatch(source, /המידע מוצג ממצב שמור|פעולות יסתנכרנו בבטחה לאחר החיבור/);
});
