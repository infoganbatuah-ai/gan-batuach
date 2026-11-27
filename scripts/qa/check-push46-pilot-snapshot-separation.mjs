import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/observer-pilot.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
} }).outputText;
const contract = {};
new Function("exports", compiled)(contract);

test("old high score remains historical and cannot elevate a lower current sample", () => {
  const result = contract.pilotDisplayScores({ readiness: 82, calibration: 77 },
    { readiness_score: 100, calibration_score: 99 });
  assert.deepEqual(result, { readiness: 82, calibration: 77, historicalReadiness: 100, historicalCalibration: 99 });
});

test("invalid historical scores do not become current readiness", () => {
  for (const value of ["", "not-a-number", 101, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = contract.pilotDisplayScores({ readiness: 0, calibration: 0 },
      { readiness_score: value, calibration_score: value });
    assert.deepEqual(result, { readiness: 0, calibration: 0, historicalReadiness: null, historicalCalibration: null });
  }
});

test("admin page uses current scores for readiness and labels historical score separately", () => {
  const page = readFileSync(new URL("../../app/dashboard/admin/observer-pilot/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const displayScores = pilotDisplayScores\(computed, latestQuality\)/);
  assert.match(page, /const readinessScore = displayScores\.readiness/);
  assert.match(page, /const calibrationScore = displayScores\.calibration/);
  assert.match(page, /Historical snapshot/);
});
