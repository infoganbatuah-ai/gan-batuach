import { cameraActionSchema, type CameraActionRequest } from "./camera-action-schema";
export { cameraActionSchema, type CameraActionRequest } from "./camera-action-schema";
import { assertGuardActionAllowed, type CameraCapabilityProbe, type CameraCommand, type CameraCommandAdapter, type CameraCommandResult } from "./guard-engine";

export const COMMAND_MAX_AGE_MS = 30_000;
export function assertCommandFresh(requestedAt: string, now = Date.now()) {
  const age = now - Date.parse(requestedAt);
  if (!Number.isFinite(age) || age < -2_000 || age >= COMMAND_MAX_AGE_MS) throw new Error("COMMAND_EXPIRED");
}

export function assertCameraOnline(status: unknown, health: unknown) {
  const operational = new Set(["connected", "online", "active", "ready"]);
  const healthy = new Set(["healthy", "online", "connected", "ok"]);
  if (!operational.has(String(status ?? "").toLowerCase()) || !healthy.has(String(health ?? "").toLowerCase())) throw new Error("CAMERA_OFFLINE");
}

export function assertFreshCapabilityProbe(probe: CameraCapabilityProbe, cameraId: string, now = Date.now()) {
  const age = now - Date.parse(probe.verifiedAt);
  const discoveredAge = now - Date.parse(probe.manifest.discoveredAt);
  if (probe.manifest.cameraId !== cameraId || probe.manifest.source !== "gateway" || !probe.evidenceId.trim() || !probe.gatewayProvider.trim()
    || !Number.isFinite(age) || age < -2_000 || age > COMMAND_MAX_AGE_MS
    || !Number.isFinite(discoveredAge) || discoveredAge < -2_000 || discoveredAge > COMMAND_MAX_AGE_MS) {
    throw new Error("INVALID_CAPABILITY_EVIDENCE");
  }
}

type CommandOutcome = {
  accepted: true;
  executed: true | null;
  state: "acknowledged" | "executed" | "outcome_unknown";
  command_id: string | null;
  request_id: string;
  audit_recorded: boolean;
};

export type CameraCommandDependencies = {
  probe(cameraId: string): Promise<CameraCapabilityProbe>;
  adapter: CameraCommandAdapter;
  /** Durable unique claim AND pre-send audit. Must reject duplicate request IDs. */
  claim(command: CameraCommand, probe: CameraCapabilityProbe): Promise<void>;
  recordOutcome(outcome: CommandOutcome): Promise<void>;
  now?: () => number;
};

export async function executeCameraAction(input: CameraActionRequest, camera: { id: string; status: unknown; health_status: unknown }, deps: CameraCommandDependencies): Promise<CommandOutcome> {
  const payload = cameraActionSchema.parse(input);
  const now = deps.now ?? Date.now;
  if (camera.id !== payload.camera_source_id) throw new Error("CAMERA_SCOPE_MISMATCH");
  assertCommandFresh(payload.requested_at, now());
  assertCameraOnline(camera.status, camera.health_status);
  const probe = await deps.probe(camera.id);
  assertFreshCapabilityProbe(probe, camera.id, now());
  assertGuardActionAllowed(probe.manifest, payload.action, payload.confirmed);
  assertCommandFresh(payload.requested_at, now());
  const command: CameraCommand = {
    cameraId: camera.id, action: payload.action, payload: payload.payload,
    requestId: payload.request_id,
    expiresAt: new Date(Date.parse(payload.requested_at) + COMMAND_MAX_AGE_MS).toISOString()
  };
  await deps.claim(command, probe);
  // Slow database writes must never extend the user's approval window.
  assertCommandFresh(payload.requested_at, now());
  assertFreshCapabilityProbe(probe, camera.id, now());
  let execution: CameraCommandResult | null = null;
  try { execution = await deps.adapter.execute(command); }
  catch { /* A lost response cannot prove that the camera did not act. Never retry automatically. */ }
  const outcome: CommandOutcome = {
    accepted: true,
    executed: execution?.state === "executed" ? true : null,
    state: execution?.state ?? "outcome_unknown",
    command_id: execution?.commandId ?? null,
    request_id: payload.request_id,
    audit_recorded: true
  };
  try { await deps.recordOutcome(outcome); }
  catch { outcome.audit_recorded = false; }
  return outcome;
}
