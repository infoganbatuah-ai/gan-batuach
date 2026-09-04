import assert from "node:assert/strict";
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

const { eventManifestPolicy } = load("lib/domain/event-engine/event-manifest-policy.ts");
const manifestRoute = readFileSync("app/api/video-gateway/event-manifest/route.ts", "utf8");
assert.match(manifestRoute, /verified_event_types: policy\.verified_event_types/, "Manifest route must expose only the bounded policy intersection");
assert.match(manifestRoute, /schedule\.data\?\.status === "active"/, "Manifest route must require an active cloud schedule");
assert.match(manifestRoute, /unavailable_event_types: allowed\.filter\(type => !policy\.supported_event_types\.includes\(type\)\)/, "Model- or policy-blocked rules must remain visibly unavailable");
const base = { zone_type: "POOL", monitoring_enabled: true, off_hours_active: true,
  allowed_event_types: ["person_near_pool_off_hours", "camera_offline"],
  implemented_event_types: ["person_near_pool_off_hours", "camera_offline"] };
assert.deepEqual(eventManifestPolicy(base).supported_event_types, ["camera_offline"], "Missing model cannot advertise the pool rule");
assert.deepEqual(eventManifestPolicy({ ...base, verified_event_models: { person_near_pool_off_hours: false } }).verified_event_types, [], "False model flags fail closed");
const pool = eventManifestPolicy({ ...base, verified_event_models: { person_near_pool_off_hours: true, invented_event: true } });
assert.deepEqual(pool.supported_event_types, ["person_near_pool_off_hours", "camera_offline"]);
assert.deepEqual(pool.verified_event_types, ["person_near_pool_off_hours"], "Verified list is a bounded intersection, not raw metadata");
assert.deepEqual(eventManifestPolicy({ ...base, zone_type: "PERIMETER", verified_event_models: { person_near_pool_off_hours: true } }).supported_event_types, ["camera_offline"], "Wrong zone cannot advertise the pool rule");
assert.deepEqual(eventManifestPolicy({ ...base, off_hours_active: false, verified_event_models: { person_near_pool_off_hours: true } }).supported_event_types, ["camera_offline"], "Inactive schedule cannot advertise off-hours support");
assert.deepEqual(eventManifestPolicy({ ...base, allowed_event_types: ["camera_offline"], verified_event_models: { person_near_pool_off_hours: true } }).verified_event_types, [], "Missing allowed-list membership cannot be recovered from model metadata");
assert.deepEqual(eventManifestPolicy({ ...base, implemented_event_types: ["camera_offline"], verified_event_models: { person_near_pool_off_hours: true } }).verified_event_types, [], "Missing implemented-list membership cannot be recovered from model metadata");
assert.deepEqual(eventManifestPolicy({ ...base, monitoring_enabled: false, verified_event_models: { person_near_pool_off_hours: true } }), { off_hours_active: false, supported_event_types: [], verified_event_types: [] }, "Revoked monitoring removes every advertised event");
assert.deepEqual(eventManifestPolicy({ ...base, allowed_event_types: Array.from({length:65},(_,i)=>`event_${i}`), verified_event_models: {} }).supported_event_types, [], "Oversized producer lists fail closed");

console.log("Event manifest policy checks passed: bounded cloud intersection, verified models, zone, active schedule and monitoring revocation.");
