import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { observerIncidentsListState } from "../../lib/ui/observer-incidents-list-state.ts";

test("query failure never appears as an empty incident list", () => {
  assert.equal(observerIncidentsListState(true, 0), "error");
  assert.equal(observerIncidentsListState(false, 0), "empty");
  assert.equal(observerIncidentsListState(false, 2), "list");
});

test("incident page offers the factual event route during an error", () => {
  const page = readFileSync(new URL("../../app/digital-observer/incidents/page.tsx", import.meta.url), "utf8");
  assert.match(page, /!selected && listState !== "error"/);
  assert.match(page, /result\.error \? <section[^>]+role="alert"/);
  assert.match(page, /href="\/digital-observer\/alerts">צפייה באירועים המקוריים/);
});
