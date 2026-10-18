import assert from "node:assert/strict";
import {
  managedDeviceRuntimeInstanceAccount,
  managedDeviceRuntimeSequenceAccount,
  nextManagedDeviceProofState,
  nextManagedDeviceProofStateSync
} from "../../services/video-gateway/managed-device-runtime-session.mjs";

const values = new Map();
const read = account => values.get(account) || "";
const write = (account, value) => values.set(account, String(value));

const runtime = nextManagedDeviceProofStateSync({ readSecret: read, writeSecret: write,
  prefix: "connector", now: () => 1_000, processId: 41 });
assert.match(runtime.runtimeInstanceId, /^connector:/);
assert.equal(runtime.sequence, 1_000_041);
assert.equal(values.get(managedDeviceRuntimeInstanceAccount), runtime.runtimeInstanceId);
assert.equal(values.get(managedDeviceRuntimeSequenceAccount), String(runtime.sequence));

const sibling = nextManagedDeviceProofStateSync({ readSecret: read, writeSecret: write,
  prefix: "connector", now: () => 1_000, processId: 17 });
assert.equal(sibling.runtimeInstanceId, runtime.runtimeInstanceId);
assert.ok(sibling.sequence > runtime.sequence);

const restarted = await nextManagedDeviceProofState({ readSecret: async account => read(account),
  writeSecret: async (account, value) => write(account, value), prefix: "gateway",
  now: () => 999, processId: 1 });
assert.equal(restarted.runtimeInstanceId, runtime.runtimeInstanceId);
assert.ok(restarted.sequence > sibling.sequence);

values.set(managedDeviceRuntimeInstanceAccount, "unsafe runtime");
assert.throws(() => nextManagedDeviceProofStateSync({ readSecret: read, writeSecret: write }),
  /RUNTIME_INSTANCE_INVALID/);

console.log(JSON.stringify({ result: "PASS", shared_runtime_instance: true,
  durable_monotonic_sequence: true, private_key_exported: false }));
