import assert from "node:assert/strict";
import { computeActivityMetrics } from "../../services/video-gateway/activity-insights.mjs";

const still = computeActivityMetrics(Buffer.concat([Buffer.alloc(16, 100), Buffer.alloc(16, 100)]), 4, 4);
assert.equal(still.motion_score, 0);
assert.equal(still.raw_frames_returned, false);
assert.equal(still.sample_frames, 2);

const changed = computeActivityMetrics(Buffer.concat([Buffer.alloc(16, 0), Buffer.alloc(16, 255)]), 4, 4);
assert.equal(changed.motion_score, 1);
assert.equal(changed.luminance_score, 1);
assert.equal(changed.raw_frames_returned, false);
assert.deepEqual(Object.keys(changed).sort(), ["luminance_score", "motion_score", "raw_frames_returned", "sample_frames"]);

assert.equal(computeActivityMetrics(Buffer.alloc(4), 4, 4), null);
console.log("video gateway activity insights PASS");
