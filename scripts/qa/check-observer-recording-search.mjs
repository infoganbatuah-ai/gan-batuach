import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { observerRecordingMatchesQuery } from "../../lib/ui/observer-recording-search.ts";

test("recording search matches titles and camera names without case sensitivity", () => {
  assert.equal(observerRecordingMatchesQuery("כניסה", "תנועה בכניסה", "מצלמת חצר"), true);
  assert.equal(observerRecordingMatchesQuery("CAMERA", "אירוע", "Camera One"), true);
  assert.equal(observerRecordingMatchesQuery("מחסן", "אירוע", "מצלמת חצר"), false);
  assert.equal(observerRecordingMatchesQuery("  ", "אירוע"), true);
});

test("recordings page consumes the query and preserves it in the search field", () => {
  const page = readFileSync(new URL("../../app/digital-observer/recordings/page.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../components/digital-observer/observer-app-shell.tsx", import.meta.url), "utf8");
  assert.match(page, /q\?: string/);
  assert.match(page, /observerRecordingMatchesQuery\(query, item\.title/);
  assert.match(page, /observerRecordingMatchesQuery\(query,/);
  assert.match(page, /value: query/);
  assert.match(shell, /defaultValue=\{desktopSearch\.value\}/);
  assert.match(page, /ניקוי חיפוש/);
});
