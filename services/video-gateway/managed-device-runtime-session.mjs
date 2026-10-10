import { randomUUID } from "node:crypto";

export const managedDeviceRuntimeInstanceAccount = "device_runtime_instance_id";
export const managedDeviceRuntimeSequenceAccount = "device_runtime_sequence";

const runtimePattern = /^[A-Za-z0-9._-]+:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nextSequence(previous, now, processId) {
  const stored = Number(previous || 0);
  const wallClock = now() * 1_000 + Math.abs(Number(processId) || 0) % 1_000;
  const sequence = Math.max(Number.isSafeInteger(stored) ? stored + 1 : 1, wallClock);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("MANAGED_DEVICE_RUNTIME_SEQUENCE_INVALID");
  return sequence;
}

function validateRuntime(value) {
  if (!runtimePattern.test(value || "") || value.length > 160)
    throw new Error("MANAGED_DEVICE_RUNTIME_INSTANCE_INVALID");
  return value;
}

export function nextManagedDeviceProofStateSync({ readSecret, writeSecret, prefix = "edge",
  now = Date.now, processId = process.pid }) {
  let runtimeInstanceId = readSecret(managedDeviceRuntimeInstanceAccount);
  if (!runtimeInstanceId) {
    writeSecret(managedDeviceRuntimeInstanceAccount, `${prefix}:${randomUUID()}`);
    runtimeInstanceId = readSecret(managedDeviceRuntimeInstanceAccount);
  }
  validateRuntime(runtimeInstanceId);
  const sequence = nextSequence(readSecret(managedDeviceRuntimeSequenceAccount), now, processId);
  writeSecret(managedDeviceRuntimeSequenceAccount, String(sequence));
  return { runtimeInstanceId, sequence };
}

export async function nextManagedDeviceProofState({ readSecret, writeSecret, prefix = "edge",
  now = Date.now, processId = process.pid }) {
  let runtimeInstanceId = await readSecret(managedDeviceRuntimeInstanceAccount);
  if (!runtimeInstanceId) {
    await writeSecret(managedDeviceRuntimeInstanceAccount, `${prefix}:${randomUUID()}`);
    runtimeInstanceId = await readSecret(managedDeviceRuntimeInstanceAccount);
  }
  validateRuntime(runtimeInstanceId);
  const sequence = nextSequence(await readSecret(managedDeviceRuntimeSequenceAccount), now, processId);
  await writeSecret(managedDeviceRuntimeSequenceAccount, String(sequence));
  return { runtimeInstanceId, sequence };
}
