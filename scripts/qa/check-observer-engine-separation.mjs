import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../..", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

const router = await read("lib/domain/observer-engine/router.ts");
const policy = await read("lib/domain/observer-engine/policy.ts");
const skeleton = await read("lib/domain/observer-engine/skeleton-engine.ts");
const migration = await read("supabase/migrations/20260831000100_observer_engine_separation.sql");

assert.match(router, /new SkeletonObserverEngine\(\)/);
assert.match(router, /new BiometricObserverEngine\(\)/);
assert.match(router, /camera\.garden_id/);
assert.match(router, /unknown tenant type; refusing to create an engine/);
assert.match(router, /incomplete tenant metadata; refusing biometric fallback/);
assert.match(router, /camera\.kindergarten_id, camera\.garden_id/);
assert.match(policy, /raw frame buffer is not allowed/);
assert.match(policy, /face_processing.*false/);
assert.match(policy, /biometric_processing.*false/);
assert.match(policy, /assertKindergartenPoseData/);
assert.match(policy, /pose schema violation/);
assert.match(policy, /assertKindergartenBoundingBox/);
assert.match(policy, /face_vector/);
assert.match(policy, /allowedEventKeys/);
assert.match(policy, /allowedMetadataKeys/);
assert.match(skeleton, /assertKindergartenEvent\(event\)/);
assert.doesNotMatch(skeleton, /Biometric|FaceIdentification|FaceRecognition|face_id|biometric_profile_id/);
assert.match(migration, /OBSERVER_ENGINE_BOUNDARY_VIOLATION/);
assert.match(migration, /kindergarten_skeleton/);

console.log("Observer engine separation checks passed.");
