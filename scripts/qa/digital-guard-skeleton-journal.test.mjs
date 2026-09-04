import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

const id = suffix => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const profile = { id: id(1), role: "manager", garden_id: id(2), active: true };
const query = { from: "2026-08-31T00:00:00Z", to: "2026-09-01T00:00:00Z" };
const now = new Date("2026-08-31T12:00:00Z");
const row = { id: id(3), garden_id: id(2), camera_id: id(4), zone_id: null,
  event_type: "fall_suspected", event_timestamp: "2026-08-31T10:00:00Z", severity: "medium", confidence: 0.9,
  review_status: "pending_review", retention_until: "2030-01-01T00:00:00Z", parent_visible: false,
  raw_frame_stored: false, face_data_present: false, audio_data_present: false, identity_fields_present: false,
  camera: { id: id(4), garden_id: id(2) } };

function fixture({ rows = [row], dbError = false, camera = row.camera, actor = profile, userId = profile.id, signedIn = true } = {}) {
  const requests = [];
  const db = createClient("https://fixture.invalid", "synthetic-public-key", { auth: { persistSession: false, autoRefreshToken: false },
    global: { async fetch(resource, options) {
      const url = new URL(resource);
      const table = url.pathname.split("/").at(-1);
      assert.equal(options.method, "GET", "journal must never write");
      assert.ok(["skeleton_observer_events", "camera_streams"].includes(table), "no legacy/biometric access");
      requests.push({ table, url });
      assert.equal(url.searchParams.get("garden_id"), `eq.${profile.garden_id}`);
      if (dbError) return Response.json({ message: "synthetic database failure", code: "XX000" }, { status: 400 });
      return Response.json(table === "camera_streams" ? camera : rows);
    } }
  });
  const service = loadTs("lib/domain/observer-engine/skeleton-journal.ts");
  const route = loadTs("app/api/garden/observer-journal/route.ts", {
    "@/lib/auth": { async getSessionProfile() { return signedIn ? { user: { id: userId }, profile: actor } : { user: null, profile: null }; } },
    "@/lib/supabase/server": { async createClient() { return db; } }
  });
  return { requests, service, async search(input = query, selectedProfile = actor) { return service.searchSkeletonJournal(db, selectedProfile, input, now); },
    async get(input = query) {
      const params = input instanceof URLSearchParams ? input : new URLSearchParams(input);
      const response = await route.GET(new Request(`https://fixture.invalid/api/garden/observer-journal?${params}`));
      return { status: response.status, body: await response.json() };
    } };
}

test("skeleton journal uses an explicit safe projection and filters before the limit", async () => {
  const f = fixture();
  const result = await f.search({ ...query, camera_id: row.camera_id, event_type: row.event_type, review_status: row.review_status, limit: 1 });
  assert.equal(result.events.length, 1);
  const url = f.requests.find(request => request.table === "skeleton_observer_events").url;
  const columns = url.searchParams.get("select");
  for (const forbidden of ["*", "metadata", "keypoints", "anonymized_skeleton_uuid", "recommended_action", "clip", "embedding"])
    assert.ok(!columns.includes(forbidden));
  assert.equal(url.searchParams.get("camera.garden_id"), `eq.${profile.garden_id}`);
  assert.equal(url.searchParams.get("camera_id"), `eq.${row.camera_id}`);
  assert.equal(url.searchParams.get("event_timestamp"), "gte.2026-08-31T00:00:00.000Z");
  assert.deepEqual(url.searchParams.getAll("event_timestamp"), ["gte.2026-08-31T00:00:00.000Z", "lt.2026-09-01T00:00:00.000Z"]);
  assert.equal(url.searchParams.get("event_type"), "eq.fall_suspected");
  assert.equal(url.searchParams.get("review_status"), "eq.pending_review");
  assert.equal(url.searchParams.get("limit"), "2");
  for (const flag of ["parent_visible", "raw_frame_stored", "face_data_present", "audio_data_present", "identity_fields_present"])
    assert.equal(url.searchParams.get(flag), "eq.false");
});

test("closed output never spreads identity, keypoints, media or unreviewed provider prose", async () => {
  const f = fixture({ rows: [{ ...row, metadata: { resident_name: "DO_NOT_EXPOSE" }, anonymized_skeleton_uuid: "DO_NOT_EXPOSE",
    keypoint_metadata: { note: "DO_NOT_EXPOSE" }, recommended_action: "DO_NOT_EXPOSE", image_url: "DO_NOT_EXPOSE" }] });
  const result = await f.search();
  assert.ok(!JSON.stringify(result).includes("DO_NOT_EXPOSE"));
  assert.match(result.events[0].summary, /נדרשת בדיקה/);
  assert.equal(result.coverage.privacy_mode, "skeleton_only");
  assert.equal(result.coverage.media_included, false);
});

test("parents, staff, admins without scoped garden role and inactive profiles are rejected before journal access", async () => {
  for (const actor of [null, { ...profile, role: "parent" }, { ...profile, role: "staff" }, { ...profile, role: "admin" },
    { ...profile, active: false }, { ...profile, active: undefined }, { ...profile, garden_id: null }]) {
    const f = fixture({ actor });
    await assert.rejects(f.search(), /SKELETON_JOURNAL_FORBIDDEN/);
    assert.deepEqual(f.requests, []);
  }
});

test("foreign or missing cameras are denied before reading skeleton events", async () => {
  for (const camera of [null, { id: row.camera_id, garden_id: id(99) }, { id: id(99), garden_id: profile.garden_id }]) {
    const f = fixture({ camera });
    await assert.rejects(f.search({ ...query, camera_id: row.camera_id }), /CAMERA_FORBIDDEN/);
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].table, "camera_streams");
  }
});

test("wrong tenant, camera join, time, event type and privacy claims are removed defensively", async () => {
  const invalid = [
    { garden_id: id(99) }, { camera: { ...row.camera, garden_id: id(99) } }, { camera: { ...row.camera, id: id(99) } },
    { event_timestamp: query.to }, { event_timestamp: "2026-08-30T23:59:59Z" }, { retention_until: now.toISOString() },
    { event_type: "KNOWN_FACE" }, { face_data_present: true }, { identity_fields_present: true }, { raw_frame_stored: true },
    { audio_data_present: true }, { parent_visible: true }, { confidence: "0.9" }, { event_timestamp: "2026-02-30T12:00:00Z" }
  ];
  const f = fixture({ rows: [row, ...invalid.map(change => ({ ...row, ...change }))] });
  const result = await f.search();
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.invalid_rows_excluded, invalid.length);
});

test("requested camera, type and review filters are rechecked against returned rows", async () => {
  const f = fixture({ rows: [{ ...row, camera_id: id(99) }, { ...row, event_type: "pose_sample" }, { ...row, review_status: "dismissed" }, row] });
  const result = await f.search({ ...query, camera_id: row.camera_id, event_type: row.event_type, review_status: row.review_status });
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.invalid_rows_excluded, 3);
});

test("unsupported query keys, biometric intents and invalid time windows fail before database reads", async () => {
  for (const changes of [{ garden_id: id(99) }, { raw_sql: "select *" }, { event_type: "KNOWN_FACE" }, { limit: 101 },
    { to: query.from }, { to: "2026-11-01T00:00:00Z" }, { from: "2026-02-30T00:00:00Z" }, { from: "2026-08-31" }]) {
    const f = fixture();
    await assert.rejects(f.search({ ...query, ...changes }));
    assert.deepEqual(f.requests, []);
  }
});

test("database errors are unavailable, never a successful empty journal", async () => {
  const f = fixture({ dbError: true });
  await assert.rejects(f.search(), /SKELETON_JOURNAL_UNAVAILABLE/);
  assert.equal((await f.get()).status, 503);
});

test("empty or capped results never claim live presence or continuous protection", async () => {
  const empty = await fixture({ rows: [] }).search();
  assert.deepEqual(empty.events, []);
  assert.equal(empty.coverage.historical_only, true);
  assert.equal(empty.coverage.continuous_analysis_verified, false);
  assert.equal(empty.coverage.hardware_actions, 0);
  const capped = await fixture({ rows: [row, { ...row, id: id(6) }] }).search({ ...query, limit: 1 });
  assert.equal(capped.events.length, 1);
  assert.equal(capped.coverage.limit_reached, true);
});

test("garden HTTP route authenticates before querying and refuses a mismatched profile", async () => {
  for (const [options, status] of [[{ signedIn: false }, 401], [{ actor: { ...profile, role: "parent" } }, 403], [{ userId: id(99) }, 403]]) {
    const f = fixture(options);
    assert.equal((await f.get()).status, status);
    assert.deepEqual(f.requests, []);
  }
});

test("garden HTTP route returns the safe journal for its manager and owner only", async () => {
  for (const role of ["manager", "owner"]) {
    const f = fixture({ actor: { ...profile, role } });
    const result = await f.get({ ...query, limit: "1" });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.events.length, 1);
    assert.equal(result.body.data.coverage.privacy_mode, "skeleton_only");
  }
});

test("garden HTTP route rejects duplicate filters and client-supplied tenant scopes", async () => {
  const duplicate = new URLSearchParams(query);
  duplicate.append("from", query.from);
  for (const input of [duplicate, { ...query, garden_id: id(99) }, { ...query, observer_site_id: id(99) }]) {
    const f = fixture();
    assert.equal((await f.get(input)).status, 422);
    assert.deepEqual(f.requests, []);
  }
});
