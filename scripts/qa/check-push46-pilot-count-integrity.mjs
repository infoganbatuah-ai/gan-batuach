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
const valid = { detections: 120, pendingReview: 10, reviewed: 100, falsePositive: 3,
  falseNegative: 2, uncertain: 4, cameras: 5, stableCameras: 5 };

test("consistent pilot counts retain bounded readiness", () => {
  const result = contract.calculateObserverPilotReadiness(valid);
  assert.ok(result.readiness > 0 && result.readiness <= 100);
  assert.equal(result.reviewedRatio, 100 / 120);
});

test("mixed query windows and impossible counts never claim pilot maturity", () => {
  for (const invalid of [
    { detections: 10 }, { pendingReview: 121 }, { falsePositive: 101 },
    { falsePositive: 70, falseNegative: 40 }, { stableCameras: 6 },
    { reviewed: Number.NaN }, { reviewed: -1 }
  ]) {
    const result = contract.calculateObserverPilotReadiness({ ...valid, ...invalid });
    assert.equal(result.productionBlocked, true);
    assert.equal(result.readiness, 0);
    assert.equal(result.calibration, 0);
  }
});

test("admin pilot page cannot mask a blocked current sample with an older quality score", () => {
  const page = readFileSync(new URL("../../app/dashboard/admin/observer-pilot/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const readinessScore = displayScores\.readiness/);
  assert.match(page, /const calibrationScore = displayScores\.calibration/);
});
