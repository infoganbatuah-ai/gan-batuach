import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, cache = new Map()) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule.exports);
  const get = name => name === "server-only" ? {}
    : name.startsWith("@/") || name.startsWith(".")
      ? load((name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(file), name)) + ".ts", cache)
      : require(name);
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("require", "module", "exports", js)(get, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { cloudCameraEventSchema, eventEvidenceCompatibility } = load("lib/domain/event-engine/event-evidence-compatibility.ts");
const event = {
  event_id: randomUUID(), camera_source_id: randomUUID(), stream_id: "stream", event_type: "person_near_pool_off_hours",
  severity: "WARNING", confidence: 0.9, timestamp: "2026-09-01T02:00:00.000Z", evidence_kind: "object_detection_off_hours"
};
assert.equal(cloudCameraEventSchema.parse(event).evidence_kind, "object_detection_off_hours");
assert.throws(() => cloudCameraEventSchema.parse({ ...event, evidence_kind: "object_detection_night" }));
assert.throws(() => cloudCameraEventSchema.parse({ ...event, extra_authority: true }));

const context = { zone_type: "POOL", crossing_line_valid: false, off_hours_active: true,
  verified_event_models: { person_near_pool_off_hours: true } };
assert.deepEqual(eventEvidenceCompatibility(event, context), { compatible: true });
assert.deepEqual(eventEvidenceCompatibility(event, { ...context, zone_type: "PERIMETER" }), { compatible: false, reason: "off_hours_zone_mismatch" });
assert.deepEqual(eventEvidenceCompatibility(event, { ...context, off_hours_active: false }), { compatible: false, reason: "off_hours_not_verified" });
assert.deepEqual(eventEvidenceCompatibility(event, { ...context, verified_event_models: {} }), { compatible: false, reason: "specialized_model_not_verified" });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "person_detected" }, context), { compatible: false, reason: "off_hours_evidence_type_mismatch" });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "unauthorized_night_motion" }, {
  ...context, zone_type: "PERIMETER", verified_event_models: { unauthorized_night_motion: true }
}), { compatible: true });
assert.deepEqual(eventEvidenceCompatibility({ ...event, evidence_kind: "object_detection" }, context), { compatible: false, reason: "specialized_evidence_required" });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "person_detected", evidence_kind: "object_detection" }, context), { compatible: true });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "person_entered", evidence_kind: "line_crossing" }, context), { compatible: false, reason: "direction_not_verified" });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "person_entered", evidence_kind: "line_crossing" }, { ...context, crossing_line_valid: true }), { compatible: true });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "camera_offline", evidence_kind: "stream_health" }, context), { compatible: true });
assert.deepEqual(eventEvidenceCompatibility({ ...event, event_type: "drowning_hazard", evidence_kind: "validated_rule" }, { ...context, verified_event_models: {} }), { compatible: false, reason: "specialized_model_not_verified" });

console.log("Event evidence compatibility checks passed: strict schema, off-hours type/zone/schedule/model gates, crossing, health and passive object evidence.");
