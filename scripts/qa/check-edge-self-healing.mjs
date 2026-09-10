import assert from "node:assert/strict";
import { createEdgeSupervisor, EDGE_RECOVERY_ACTION as A } from "../../services/video-gateway/edge-supervision.mjs";

let at = 1_800_000_000_000;
const calls = [], identity = "device-qa-unchanged", site = "site-qa-unchanged", source = "source-qa-unchanged";
const handlers = Object.fromEntries(Object.values(A).map((action) => [action, async ({ resourceId }) => { calls.push([action, resourceId]); return { healthy: true }; }]));
const supervisor = createEdgeSupervisor({ now: () => at, random: () => 0, adapters: handlers,
  config: { staleMs: 1000, baseBackoffMs: 100, maxAttempts: 3, maxCrashes: 3, crashWindowMs: 10_000 } });

for (let channel = 1; channel <= 10; channel++) supervisor.observe({ resourceId: `dvr-${channel}`, processRunning: true, auth: "VALID", cloudConnected: true, sourceAvailable: true, relayRunning: true, frameProgressing: true });
for (let channel = 11; channel <= 16; channel++) supervisor.observe({ resourceId: `dvr-${channel}`, assignment: "CHANNEL_EMPTY" });
assert.deepEqual({ expected: supervisor.snapshot().expected_resources, empty: supervisor.snapshot().empty_unassigned }, { expected: 10, empty: 6 });

supervisor.observe({ resourceId: "relay-kill", processRunning: true, auth: "VALID", cloudConnected: true, sourceAvailable: true, relayRunning: false });
assert.deepEqual(await supervisor.recover("relay-kill"), { status: "RECOVERED", action: A.RESTART_RELAY });
supervisor.observe({ resourceId: "stale-process-alive", processRunning: true, auth: "VALID", cloudConnected: true, sourceAvailable: true, relayRunning: true, frameProgressing: false });
assert.equal((await supervisor.recover("stale-process-alive")).action, A.RECONNECT_SOURCE);
supervisor.observe({ resourceId: "camera-loss", processRunning: true, auth: "VALID", cloudConnected: true, sourceAvailable: false });
assert.equal((await supervisor.recover("camera-loss")).action, A.RECONNECT_SOURCE);
const beforeCloud = calls.length;
supervisor.observe({ resourceId: "cloud-loss", processRunning: true, auth: "VALID", cloudConnected: false, sourceAvailable: true, relayRunning: true, frameProgressing: true });
assert.equal((await supervisor.recover("cloud-loss")).action, A.RETRY_REQUEST);
assert.equal(calls.slice(beforeCloud).some(([action]) => action === A.RESTART_MANAGED_SERVICE), false);
supervisor.observe({ resourceId: "dvr-session", processRunning: true, auth: "VALID", cloudConnected: true, dvrSession: "LOST" });
assert.equal((await supervisor.recover("dvr-session")).action, A.RENEW_DVR_SESSION);
supervisor.observe({ resourceId: "connector", processRunning: false, auth: "VALID" });
assert.equal((await supervisor.recover("connector")).action, A.RESTART_MANAGED_SERVICE);
assert.deepEqual({ identity, site, source }, { identity: "device-qa-unchanged", site: "site-qa-unchanged", source: "source-qa-unchanged" });

const authCalls = calls.length;
supervisor.observe({ resourceId: "revoked", processRunning: true, auth: "REVOKED" });
assert.equal((await supervisor.recover("revoked")).action, A.ESCALATE);
assert.equal(calls.slice(authCalls).some(([action]) => action === A.RESTART_MANAGED_SERVICE), false);

const crash = createEdgeSupervisor({ now: () => at, random: () => 0, adapters: handlers,
  config: { baseBackoffMs: 100, maxAttempts: 2, maxCrashes: 3, crashWindowMs: 10_000 } });
for (let index = 0; index < 3; index++) { crash.observe({ resourceId: "service", processRunning: false, auth: "VALID" }); at += 10; }
assert.equal(crash.snapshot().failures[0].category, "PROCESS_CRASH_LOOP");
assert.equal((await crash.recover("service")).action, A.SIGNAL_OTA_HEALTH);

const failedCalls = [];
const bounded = createEdgeSupervisor({ now: () => at, random: () => 0, adapters: { [A.RESTART_RELAY]: async () => { failedCalls.push(at); throw Error("still_unhealthy"); }, [A.ESCALATE]: handlers[A.ESCALATE] },
  config: { baseBackoffMs: 100, maxAttempts: 2 } });
bounded.observe({ resourceId: "thrash", processRunning: true, relayRunning: false });
assert.equal((await bounded.recover("thrash")).status, "FAILED");
assert.equal((await bounded.recover("thrash")).status, "BACKOFF");
at += 101; assert.equal((await bounded.recover("thrash")).status, "FAILED");
at += 201; assert.equal((await bounded.recover("thrash")).status, "ESCALATED");
assert.equal(failedCalls.length, 2);

const diagnostic = JSON.stringify(supervisor.snapshot());
assert.equal(/password|private[_ -]?key|rtsp:\/\/|token/i.test(diagnostic), false);
assert.ok(supervisor.snapshot().events.length <= supervisor.policy.eventLimit);
console.log("Edge self-healing QA passed: relay/stale/source/cloud/service/crash-loop/DVR/auth/empty-slot/secret contracts verified.");
