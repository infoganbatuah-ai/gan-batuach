import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../diagnose-local-dvr-recording-readonly.mjs", import.meta.url), "utf8");

for (const required of [
  '"/API/StorageConfig/Disk/Get"',
  '"/API/SystemInfo/Record/Get"',
  '"/API/RecordConfig/Get"',
  '"/API/Schedules/Record/Get"',
  '"/API/Playback/SearchRecord/Search"',
  '"/API/Maintenance/Log/Search"',
  'keychainValue("dvr_profile_json")',
  'keychainValue("dvr_password")',
  "non_read_only_path_blocked",
  "read_only: true"
]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Missing read-only diagnostic boundary: ${required}`);

for (const forbidden of [
  "/API/StorageConfig/Disk/Format",
  "/API/StorageConfig/Disk/Control",
  "/API/RecordConfig/Set",
  "/API/Schedules/Record/Set",
  "writeFileSync",
  "appendFileSync",
  "username: profile.username",
  "password: password"
]) assert.equal(source.includes(forbidden), false, `Recording diagnostic must never include mutation or secret output: ${forbidden}`);

assert.equal(source.includes('!/(?:\\/Get|\\/Search)$/.test(path)'), true, "Diagnostic must restrict recorder calls to Get/Search paths");
console.log("Local DVR recording read-only diagnostic checks passed.");
