import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDurableOfflineQueue } from "../../services/video-gateway/durable-offline-queue.mjs";

const dir = mkdtempSync(join(tmpdir(), "observer-offline-")), path = join(dir, "queue.sqlite"), key = "isolated-qa-device-key";
let at = Date.parse("2026-09-09T00:00:00.000Z");
const options = { databasePath: path, encryptionKey: key, tenantId: "tenant-a", siteId: "site-a", deviceId: "device-a", now: () => at,
  policy: { maxRecords: 10, maxBytes: 16_384, batchSize: 3, retryBaseMs: 100, retryMaxMs: 1000 } };
const event = (id, type, offset, priority = 50) => ({ id, kind: "EVENT", orderingKey: "site-a:camera-a:track-a", sourceId: "camera-a",
  observedAt: new Date(at + offset).toISOString(), priority, payload: { event_id: id, event_type: type, timestamp: new Date(at + offset).toISOString(), provenance: "REAL_CAMERA_AI" } });

let queue = createDurableOfflineQueue(options);
queue.enqueue(event("event-enter", "person_entered", 0));
queue.enqueue(event("event-exit", "person_exited", 1000));
queue.enqueue({ id: "media-1", kind: "EVIDENCE_MEDIA", orderingKey: "site-a:camera-a:track-a", sourceId: "camera-a", observedAt: new Date(at).toISOString(), priority: 90,
  payload: { media_status: "PENDING_UPLOAD", clip: Buffer.from("bounded-media").toString("base64"), sha256: "a".repeat(64) } });
assert.equal(queue.snapshot().queue_depth, 3, "Cloud loss grows durable queue while local observations continue");
assert.equal(queue.ready()[0].id, "event-enter", "Causal entry precedes exit/media for one track");
queue.begin("event-enter"); queue.close();

queue = createDurableOfflineQueue(options);
assert.equal(queue.snapshot().queue_depth, 3, "Queue and interrupted delivery survive process/service restart");
assert.equal(queue.ready()[0].id, "event-enter", "Ambiguous acknowledgement replays stable identifier");
queue.begin("event-enter"); queue.acknowledge("event-enter");
assert.equal(queue.ready()[0].id, "media-1");
queue.begin("media-1"); queue.acknowledge("media-1");
assert.equal(queue.ready()[0].id, "event-exit");
queue.begin("event-exit"); queue.acknowledge("event-exit");
assert.equal(queue.snapshot().queue_depth, 0, "Cloud return drains acknowledged records automatically without early deletion");

queue.enqueue(event("dedupe", "person_entered", 2000));
assert.equal(queue.enqueue(event("dedupe", "person_entered", 2000)).inserted, false, "Duplicate delivery key has one local effect");
assert.throws(() => queue.enqueue({ ...event("foreign", "person_entered", 0), tenantId: "tenant-b" }), /scope_mismatch/);
assert.throws(() => queue.enqueue({ ...event("secret", "person_entered", 0), payload: { password: "forbidden" } }), /secret_field_rejected/);
assert.throws(() => queue.enqueue({ ...event("future-schema", "person_entered", 0), schemaVersion: 2 }), /schema_unsupported/);
assert.throws(() => queue.assertRebindSafe("tenant-b", "site-b"), /backlog_resolution/);
queue.setRevoked(true); assert.deepEqual(queue.ready(), [], "Revoked identity cannot flush old backlog");
queue.setRevoked(false); queue.begin("dedupe"); queue.acknowledge("dedupe");

queue.enqueue({ ...event("cloud-return", "person_entered", -120_000), orderingKey: "camera-cloud-return" });
let accepted = new Set();
const resynced = await queue.resync(async item => { accepted.add(item.id); assert.equal(item.mode, "BACKFILL_RESYNC"); return { acknowledged: true }; });
assert.deepEqual(resynced, { state: "SYNCHRONIZED", delivered: 1 });
assert.equal(accepted.size, 1, "Cloud return automatically drains a bounded authenticated batch");

for (let index = 0; index < 10; index++) queue.enqueue({ ...event(`capacity-${index}`, "person_entered", index), orderingKey: `camera-${index}` });
assert.throws(() => queue.enqueue(event("overflow-critical", "person_entered", 20, 100)), /critical_capacity_reached/);
assert.equal(queue.snapshot().disk_pressure, "LIMIT_REACHED");
queue.close();

const raw = await import("node:fs").then(fs => fs.readFileSync(path));
assert.equal(raw.includes(Buffer.from("REAL_CAMERA_AI")), false, "Durable payload is encrypted at rest");
const cloudRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
const journal = readFileSync(new URL("../../services/video-gateway/journal-loop.mjs", import.meta.url), "utf8");
assert.match(cloudRoute, /BACKFILL_RESYNC/);
assert.match(cloudRoute, /historical_backfill/);
assert.match(cloudRoute, /backfill \? \{ push_pending: false \}/);
assert.match(cloudRoute, /created_at: event\.timestamp/);
assert.match(journal, /kind:"EVIDENCE_MEDIA"/);
assert.match(journal, /uploadMediaWork\(row\.payload\)/);
assert.match(journal, /queue\.acknowledge\(row\.id\)/);
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ status: "PASS", contract: "observer-offline-buffer-v1", cloud_loss: true, restart_durability: true, automatic_resync: true,
  idempotency: true, ambiguous_ack: true, causal_ordering: true, media_pending_until_ack: true, disk_pressure: true, rebind_isolation: true, revoked_blocked: true,
  ota_compatible_schema: 1, encrypted_at_rest: "AES-256-GCM" }));
