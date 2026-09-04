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
  "resident_name",
  "residentName",
  "passport",
  "licensePlate",
  "face_regions",
  "faceRegions"
]);

const forbiddenKindergartenEventTypes = new Set([
  "face_detected", "face_identified", "known_face", "unknown_face", "lpr", "license_plate"
]);
const allowedKindergartenEventTypes = new Set(["camera_offline", "camera_frozen_suspected", "motion_detected", "no_motion_too_long", "person_detected", "multiple_persons_detected", "restricted_area_occupancy", "camera_obstruction_suspected", "restricted_area_entry", "child_missing_from_area", "fall_suspected", "crowding_suspected", "gate_or_door_open", "pickup_mismatch", "distress_suspected", "violence_indicator", "aggressive_behavior_indicator", "prolonged_crying_indicator", "child_left_alone_indicator", "staff_absence_indicator", "unusual_crowding", "emergency_behavior_indicator"]);
const allowedJoints = new Set(["nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"]);
const allowedPostures = new Set(["standing", "sitting", "lying", "walking", "running", "crouching", "unknown"]);
const allowedMovements = new Set(["stationary", "moving", "falling", "running", "walking", "unknown"]);

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
  if (record.keypoints.length === 0 || record.keypoints.length > 100) {
    throw new Error("Kindergarten pose schema violation: keypoints count is outside the allowed range.");
  }
  const joints = new Set<string>();
  for (const keypoint of record.keypoints) {
    if (!keypoint || typeof keypoint !== "object" || Array.isArray(keypoint)) {
      throw new Error("Kindergarten pose schema violation: every keypoint must be an object.");
    }
    const point = keypoint as Record<string, unknown>;
    const pointKeys = Object.keys(point);
    if (pointKeys.some((key) => !["joint", "x", "y", "confidence"].includes(key))) {
      throw new Error("Kindergarten pose schema violation: keypoint contains an unknown field.");
    }
    if (typeof point.joint !== "string" || !allowedJoints.has(point.joint) || joints.has(point.joint) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.confidence) || Number(point.confidence) < 0 || Number(point.confidence) > 1) {
      throw new Error("Kindergarten pose schema violation: invalid keypoint values.");
    }
    joints.add(point.joint);
  }
  if (record.posture !== undefined && (typeof record.posture !== "string" || !allowedPostures.has(record.posture))) {
    throw new Error("Kindergarten pose schema violation: posture must be text.");
  }
  if (record.movement !== undefined && (typeof record.movement !== "string" || !allowedMovements.has(record.movement))) {
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
  const eventRecord = event as Record<string, unknown>;
  const allowedEventKeys = new Set(["engine", "type", "skeleton_id", "pose_data", "zone_bounding_box", "confidence", "timestamp", "metadata"]);
  const unexpectedEventKey = Object.keys(eventRecord).find((key) => !allowedEventKeys.has(key));
  if (unexpectedEventKey) {
    throw new Error(`Kindergarten event schema violation: field '${unexpectedEventKey}' is not allowed.`);
  }
  const metadata = eventRecord.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Kindergarten event schema violation: metadata must be a privacy contract object.");
  }
  const metadataRecord = metadata as Record<string, unknown>;
  const allowedMetadataKeys = new Set(["privacy_mode", "face_processing", "biometric_processing"]);
  const unexpectedMetadataKey = Object.keys(metadataRecord).find((key) => !allowedMetadataKeys.has(key));
  if (unexpectedMetadataKey) {
    throw new Error(`Kindergarten event schema violation: metadata field '${unexpectedMetadataKey}' is not allowed.`);
  }
  if (metadataRecord.privacy_mode !== "kindergarten_pose_only" || metadataRecord.face_processing !== false || metadataRecord.biometric_processing !== false) {
    throw new Error("Kindergarten privacy boundary violation: metadata privacy flags are invalid.");
  }
  const type = (event as { type?: unknown }).type;
  if (typeof type !== "string" || !allowedKindergartenEventTypes.has(type.toLowerCase()) || forbiddenKindergartenEventTypes.has(type.toLowerCase())) {
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
  if (typeof kindergartenEvent.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(kindergartenEvent.timestamp) || Number.isNaN(Date.parse(kindergartenEvent.timestamp)) || new Date(kindergartenEvent.timestamp).toISOString() !== kindergartenEvent.timestamp) {
    throw new Error("Kindergarten event schema violation: timestamp is required.");
  }
  if (kindergartenEvent.zone_bounding_box !== undefined) assertKindergartenBoundingBox(kindergartenEvent.zone_bounding_box);
}
