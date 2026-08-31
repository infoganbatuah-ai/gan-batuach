import type { TenantType, VideoFrame } from "./types";

const forbiddenKindergartenKeys = new Set([
  "face_id",
  "faceId",
  "face_embedding",
  "faceEmbedding",
  "biometric_profile_id",
  "biometricProfileId",
  "facial_features",
  "facialFeatures",
  "face_regions",
  "faceRegions"
]);

const forbiddenKindergartenEventTypes = new Set([
  "face_detected", "face_identified", "known_face", "unknown_face", "lpr", "license_plate"
]);

function containsForbiddenKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKindergartenKeys.has(key)) return key;
    const nestedKey = containsForbiddenKey(nested);
    if (nestedKey) return nestedKey;
  }
  return null;
}

export function assertTenantEngineBoundary(tenantType: TenantType, engineTenantType: TenantType) {
  if (tenantType !== engineTenantType) {
    throw new Error(`Observer engine boundary violation: ${tenantType} cannot use ${engineTenantType}.`);
  }
}

export function assertKindergartenPayload(value: unknown) {
  const forbiddenKey = containsForbiddenKey(value);
  if (forbiddenKey) {
    throw new Error(`Kindergarten privacy boundary violation: field '${forbiddenKey}' is not allowed.`);
  }
}

/**
 * The pose detector receives only a sanitized frame. A raw buffer is rejected
 * rather than silently passed downstream when the privacy boundary is unclear.
 */
export function prepareKindergartenFrame(frame: VideoFrame): VideoFrame {
  assertKindergartenPayload(frame.metadata);
  if (frame.buffer) {
    throw new Error("Kindergarten privacy boundary violation: raw frame buffer is not allowed.");
  }
  return {
    ...frame,
    buffer: null,
    metadata: {
      ...(frame.metadata ?? {}),
      privacy_mode: "kindergarten_pose_only",
      raw_frame_available_to_detector: false,
      face_processing: false,
      biometric_processing: false
    }
  };
}

export function assertKindergartenEvent(event: unknown) {
  assertKindergartenPayload(event);
  if (!event || typeof event !== "object" || (event as { engine?: string }).engine !== "skeleton") {
    throw new Error("Kindergarten event must be produced by the skeleton engine.");
  }
  const type = String((event as { type?: unknown }).type ?? "").toLowerCase();
  if (forbiddenKindergartenEventTypes.has(type)) {
    throw new Error(`Kindergarten privacy boundary violation: event type '${type}' is not allowed.`);
  }
}
