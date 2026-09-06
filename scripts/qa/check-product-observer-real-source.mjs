import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../../lib/domain/digital-observer/observation-provenance.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", js)(module.exports, module);
const { isCanonicalProductObservation } = module.exports;
const runtimeSource = readFileSync(new URL("../../lib/domain/digital-observer/runtime.ts", import.meta.url), "utf8");
const watchRoute = readFileSync(new URL("../../app/api/observer-watch-requests/route.ts", import.meta.url), "utf8");
const mockWorker = readFileSync(new URL("../../lib/domain/ai-observer/worker.ts", import.meta.url), "utf8");
const journal = readFileSync(new URL("../../lib/domain/event-engine/event-journal-service.ts", import.meta.url), "utf8");

const real = { camera_id: "camera", source_type: "system", metadata: { validated_event: true, observation_provenance: "REAL_CAMERA_AI" } };
assert.equal(isCanonicalProductObservation(real), true, "real Gateway event is canonical product truth");
assert.equal(isCanonicalProductObservation({ ...real, metadata: { ...real.metadata, observation_provenance: "SHADOW_AI" } }), false, "shadow event cannot become product truth");
assert.equal(isCanonicalProductObservation({ ...real, metadata: { ...real.metadata, mock: true } }), false, "mock event cannot become product truth");
assert.equal(isCanonicalProductObservation({ ...real, metadata: { ...real.metadata, synthetic: true } }), false, "simulation cannot become product truth");
assert.equal(isCanonicalProductObservation({ source_type: "system", metadata: { event_type: "home_activity_change" } }), true, "non-camera learning signals remain available");
assert.match(journal, /\.filter\(isCanonicalProductObservation\)/, "product journal applies the provenance boundary before rendering events");
assert.match(watchRoute, /existing\.data\.observer_site_id[\s\S]{0,180}409/, "a real Observer site rejects mock watch-event injection");
assert.match(mockWorker, /MOCK_OBSERVER_REJECTED_FOR_REAL_SITE/, "the mock worker cannot target a real Observer camera");
assert.match(runtimeSource, /CAMERA_ONLINE_AI_NOT_PROCESSING/, "a connected camera can be shown without claiming verified AI monitoring");
assert.match(runtimeSource, /REAL_CAMERA_ACTIVE_OBSERVER_DEGRADED/, "real processing failure has an explicit degraded product state");
console.log("Product Observer real-source checks passed: real Gateway truth accepted; mock, simulation, and shadow camera observations isolated.");
