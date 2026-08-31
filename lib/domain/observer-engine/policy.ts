import type { PoseData, TenantType, VideoFrame } from "./types";

const forbiddenKindergartenKeys = new Set([
  "face_id",
  "faceId",
  "face_embedding",
  "faceEmbedding",
  "biometric_profile_id",
  "biometricProfileId",
  "facial_features",
  "facialFeatures",
  "face_vector",
  "faceVector",
  "embedding",
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

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertKindergartenPoseData(value: unknown): asserts value is PoseData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kindergarten privacy boundary violation: pose_data must be an object.");
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(["keypoints", "posture", "movement"]);
  const unexpectedKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  if (unexpectedKey) {
    throw new Error(`Kindergarten pose schema violation: field '${unexpectedKey}' is not allowed.`);
  }
  if (!Array.isArray(record.keypoints)) {
    throw new Error("Kindergarten pose schema violation: keypoints must be an array.");
  }
  for (const keypoint of record.keypoints) {
    if (!keypoint || typeof keypoint !== "object" || Array.isArray(keypoint)) {
      throw new Error("Kindergarten pose schema violation: every keypoint must be an object.");
    }
    const point = keypoint as Record<string, unknown>;
    const pointKeys = Object.keys(point);
    if (pointKeys.some((key) => !["joint", "x", "y", "confidence"].includes(key))) {
      throw new Error("Kindergarten pose schema violation: keypoint contains an unknown field.");
    }
    if (typeof point.joint !== "string" || !point.joint.trim() || !isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.confidence) || Number(point.confidence) < 0 || Number(point.confidence) > 1) {
      throw new Error("Kindergarten pose schema violation: invalid keypoint values.");
    }
  }
  if (record.posture !== undefined && typeof record.posture !== "string") {
    throw new Error("Kindergarten pose schema violation: posture must be text.");
  }
  if (record.movement !== undefined && typeof record.movement !== "string") {
    throw new Error("Kindergarten pose schema violation: movement must be text.");
  }
}

export function assertKindergartenBoundingBox(value: unknown): asserts value is { x: number; y: number; width: number; height: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kindergarten event schema violation: zone_bounding_box must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["x", "y", "width", "height"].includes(key))) {
    throw new Error("Kindergarten event schema violation: zone_bounding_box contains an unknown field.");
  }
  if (![record.x, record.y, record.width, record.height].every(isFiniteNumber) || Number(record.width) < 0 || Number(record.height) < 0) {
    throw new Error("Kindergarten event schema violation: invalid zone_bounding_box values.");
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
  assertKindergartenPoseData((event as { pose_data?: unknown }).pose_data);
  const kindergartenEvent = event as { skeleton_id?: unknown; confidence?: unknown; timestamp?: unknown; zone_bounding_box?: unknown };
  if (typeof kindergartenEvent.skeleton_id !== "string" || !kindergartenEvent.skeleton_id.trim()) {
    throw new Error("Kindergarten event schema violation: skeleton_id is required.");
  }
  if (!isFiniteNumber(kindergartenEvent.confidence) || Number(kindergartenEvent.confidence) < 0 || Number(kindergartenEvent.confidence) > 1) {
    throw new Error("Kindergarten event schema violation: confidence must be between 0 and 1.");
  }
  if (typeof kindergartenEvent.timestamp !== "string" || !kindergartenEvent.timestamp.trim()) {
    throw new Error("Kindergarten event schema violation: timestamp is required.");
  }
  if (kindergartenEvent.zone_bounding_box !== undefined) assertKindergartenBoundingBox(kindergartenEvent.zone_bounding_box);
}
