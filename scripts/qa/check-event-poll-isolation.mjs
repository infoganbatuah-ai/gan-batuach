import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { startJournalLoop } from "../../services/video-gateway/journal-loop.mjs";

// Transport-only fixture: deliberately hold cloud delivery, never use a camera.
const directory = mkdtempSync(join(tmpdir(), "event-poll-isolation-"));
const databasePath = join(directory, "journal.sqlite");
const cameras = Array.from({ length: 3 }, (_, index) => ({
  camera_id: randomUUID(), stream_id: String(index), monitoring_enabled: true,
  status: "connected", zone_type: "INDOOR", allowed_event_types: ["person_detected"]
}));
const db = new DatabaseSync(databasePath);
db.exec("CREATE TABLE outbox(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0)");
const eventId = randomUUID();
db.prepare("INSERT INTO outbox(id,payload,created_at) VALUES(?,?,?)").run(eventId,
  JSON.stringify({ event_id: eventId, camera_source_id: cameras[0].camera_id }), Date.now());
db.close();

const originalFetch = globalThis.fetch;
let releaseDelivery;
const heldDelivery = new Promise(resolve => { releaseDelivery = resolve; });
let manifests = 0, sending = 0, maximumSending = 0, deliveryFinished = false;
const samples = new Map();
globalThis.fetch = async (url, options = {}) => {
  assert.equal(new URL(url).host, "fixture.invalid");
  const path = new URL(url).pathname;
  if (path === "/cloud/event-manifest") { manifests++; return Response.json({ monitoring_enabled: true, cameras }); }
  if (path === "/cloud/events") {
    assert.equal(JSON.parse(options.body).event_id, eventId);
    maximumSending = Math.max(maximumSending, ++sending);
    await heldDelivery;
    sending--; deliveryFinished = true;
    return Response.json({ data: { status: "stored", recording_required: false } });
  }
  const match = /^\/camera\/(\d+)\/detections$/.exec(path);
  if (match) {
    samples.set(match[1], (samples.get(match[1]) ?? 0) + 1);
    return Response.json({ local_processing: true, insight: { sampled_at: new Date().toISOString(),
      object_detection: { status: "sampled", detections: [] } } });
  }
  throw Error("Unexpected fixture request");
};
let stop, deadline;
try {
  await new Promise((resolve, reject) => {
    deadline = setTimeout(() => reject(Error("Cloud delivery blocked subsequent camera polling")), 1500);
    stop = startJournalLoop({ gatewayUrl: "http://fixture.invalid", gatewaySecret: "fixture-secret",
      databasePath, pollIntervalMs: 5, report(state) {
        if (manifests < 3) return;
        try {
          assert.equal(deliveryFinished, false);
          assert.equal(state.delivery_in_progress, true);
          assert.equal(state.pending, 1);
          assert.equal(state.coverage.sampled, cameras.length);
          assert.equal(maximumSending, 1, "Pending deliveries remain single-flight across cycles");
          for (const camera of cameras) assert((samples.get(camera.stream_id) ?? 0) >= 3);
          resolve();
        } catch (error) { reject(error); }
      } });
  });
  console.log("Camera polling stays active while cloud event delivery is slow; no duplicate in-flight delivery.");
} finally {
  clearTimeout(deadline);
  releaseDelivery();
  await stop?.();
  globalThis.fetch = originalFetch;
  for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
  rmdirSync(directory);
}
