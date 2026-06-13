export type SkeletonKeypointName =
  | "nose"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle";

export type SkeletonKeypoint = {
  name: SkeletonKeypointName;
  x: number;
  y: number;
  confidence: number;
};

export type SkeletonFrame = {
  timestamp: string;
  skeletonUuid: string;
  cameraId?: string | null;
  gardenId?: string | null;
  zoneId?: string | null;
  zoneType?: string | null;
  keypoints: SkeletonKeypoint[];
};

export type SkeletonMotionEventType =
  | "fall_suspected"
  | "inactivity_suspected"
  | "high_velocity_motion"
  | "crowding_suspected"
  | "supervision_attention_required"
  | "restricted_area_presence"
  | "unusual_motion_pattern"
  | "person_down_suspected";

export type SkeletonMotionSignal = {
  eventType: SkeletonMotionEventType;
  severity: "info" | "low" | "medium" | "high" | "urgent" | "critical";
  confidence: number;
  recommendedAction: string;
  reviewRequired: true;
  parentVisible: false;
  supportingMovementFeatures: Record<string, number | string | boolean | null>;
};

export type SkeletonMotionThresholds = {
  fallDropThreshold?: number;
  horizontalBodyRatio?: number;
  inactivityVelocityThreshold?: number;
  inactivitySeconds?: number;
  highVelocityThreshold?: number;
  crowdingCountThreshold?: number;
};

export type SkeletonMotionInput = {
  frames: SkeletonFrame[];
  skeletonCountInZone?: number;
  zoneType?: string | null;
  zoneRestricted?: boolean;
  thresholds?: SkeletonMotionThresholds;
};

const defaultThresholds: Required<SkeletonMotionThresholds> = {
  fallDropThreshold: 0.22,
  horizontalBodyRatio: 1.65,
  inactivityVelocityThreshold: 0.025,
  inactivitySeconds: 45,
  highVelocityThreshold: 0.65,
  crowdingCountThreshold: 18
};

export const skeletonKeypointSchema: SkeletonKeypointName[] = [
  "nose",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle"
];

export const temporalGraphReadiness = {
  expectedInput: "sequence of anonymous skeleton frames over time",
  expectedOutput: "anomaly type, confidence, supporting movement features, review recommendation",
  futureModels: ["ST-GCN", "LSTM", "temporal graph analysis", "action recognition"],
  restrictions: ["no face data", "no audio data", "no raw image storage", "human review required"]
};

export function analyzeSkeletonMotion(input: SkeletonMotionInput): SkeletonMotionSignal[] {
  const frames = input.frames.filter((frame) => frame.keypoints.length > 0).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (frames.length < 2) return [];

  const thresholds = { ...defaultThresholds, ...(input.thresholds ?? {}) };
  const signals: SkeletonMotionSignal[] = [];
  const first = frames[0];
  const last = frames[frames.length - 1];
  const durationSeconds = Math.max(1, (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000);
  const firstCenter = centerOfMass(first);
  const lastCenter = centerOfMass(last);
  const centerDrop = firstCenter && lastCenter ? lastCenter.y - firstCenter.y : 0;
  const averageVelocity = averageJointVelocity(frames);
  const maxVelocity = maxJointVelocity(frames);
  const orientationRatio = bodyOrientationRatio(last);
  const lowMovementAfterDrop = centerDrop > thresholds.fallDropThreshold && averageVelocity < thresholds.inactivityVelocityThreshold * 2;
  const horizontalBody = orientationRatio > thresholds.horizontalBodyRatio;

  if (centerDrop > thresholds.fallDropThreshold && horizontalBody && lowMovementAfterDrop) {
    signals.push({
      eventType: "fall_suspected",
      severity: "high",
      confidence: clamp01(0.62 + centerDrop * 0.5 + orientationRatio * 0.04),
      recommendedAction: "Review the motion signal and nearby camera zone context for a suspected fall.",
      reviewRequired: true,
      parentVisible: false,
      supportingMovementFeatures: {
        center_drop: round(centerDrop),
        horizontal_body_ratio: round(orientationRatio),
        average_joint_velocity: round(averageVelocity),
        low_movement_after_drop: true
      }
    });
  }

  if (durationSeconds >= thresholds.inactivitySeconds && averageVelocity <= thresholds.inactivityVelocityThreshold) {
    signals.push({
      eventType: horizontalBody ? "person_down_suspected" : "inactivity_suspected",
      severity: horizontalBody ? "high" : "medium",
      confidence: clamp01(0.58 + Math.min(durationSeconds / 300, 0.25)),
      recommendedAction: "Review prolonged low-motion signal and zone context.",
      reviewRequired: true,
      parentVisible: false,
      supportingMovementFeatures: {
        duration_seconds: round(durationSeconds),
        average_joint_velocity: round(averageVelocity),
        horizontal_body_ratio: round(orientationRatio)
      }
    });
  }

  if (maxVelocity >= thresholds.highVelocityThreshold) {
    signals.push({
      eventType: "high_velocity_motion",
      severity: maxVelocity > thresholds.highVelocityThreshold * 1.5 ? "high" : "medium",
      confidence: clamp01(0.55 + Math.min(maxVelocity / 3, 0.35)),
      recommendedAction: "Review high velocity motion signal. Do not classify it as violence without human review.",
      reviewRequired: true,
      parentVisible: false,
      supportingMovementFeatures: {
        max_joint_velocity: round(maxVelocity),
        average_joint_velocity: round(averageVelocity),
        duration_seconds: round(durationSeconds)
      }
    });
  }

  const skeletonCount = input.skeletonCountInZone ?? 1;
  if (skeletonCount >= thresholds.crowdingCountThreshold) {
    signals.push({
      eventType: input.zoneType === "restricted_area" ? "restricted_area_presence" : "crowding_suspected",
      severity: input.zoneType === "restricted_area" ? "high" : "medium",
      confidence: clamp01(0.52 + Math.min((skeletonCount - thresholds.crowdingCountThreshold) / 20, 0.35)),
      recommendedAction: input.zoneType === "restricted_area" ? "Review restricted area presence signal." : "Review crowding and supervision context for the zone.",
      reviewRequired: true,
      parentVisible: false,
      supportingMovementFeatures: {
        skeleton_count_in_zone: skeletonCount,
        zone_type: input.zoneType ?? "unknown",
        zone_restricted: Boolean(input.zoneRestricted)
      }
    });
  }

  if (input.zoneRestricted && skeletonCount > 0) {
    signals.push({
      eventType: "restricted_area_presence",
      severity: "high",
      confidence: 0.78,
      recommendedAction: "Review restricted area presence signal and camera zone rules.",
      reviewRequired: true,
      parentVisible: false,
      supportingMovementFeatures: {
        skeleton_count_in_zone: skeletonCount,
        zone_restricted: true
      }
    });
  }

  return dedupeSignals(signals);
}

export function normalizeKeypointPayload(keypoints: Array<Partial<SkeletonKeypoint> & { index?: number }>): SkeletonKeypoint[] {
  return keypoints.flatMap((keypoint, index) => {
    const name = keypoint.name ?? skeletonKeypointSchema[index];
    if (!name || typeof keypoint.x !== "number" || typeof keypoint.y !== "number") return [];
    return [{
      name,
      x: round(keypoint.x),
      y: round(keypoint.y),
      confidence: clamp01(keypoint.confidence ?? 0)
    }];
  });
}

function dedupeSignals(signals: SkeletonMotionSignal[]) {
  const strongest = new Map<SkeletonMotionEventType, SkeletonMotionSignal>();
  for (const signal of signals) {
    const existing = strongest.get(signal.eventType);
    if (!existing || signal.confidence > existing.confidence) strongest.set(signal.eventType, signal);
  }
  return Array.from(strongest.values()).sort((a, b) => b.confidence - a.confidence);
}

function centerOfMass(frame: SkeletonFrame) {
  const points = frame.keypoints.filter((point) => point.confidence >= 0.35);
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function bodyOrientationRatio(frame: SkeletonFrame) {
  const leftShoulder = point(frame, "left_shoulder");
  const rightShoulder = point(frame, "right_shoulder");
  const leftHip = point(frame, "left_hip");
  const rightHip = point(frame, "right_hip");
  const leftAnkle = point(frame, "left_ankle");
  const rightAnkle = point(frame, "right_ankle");
  const shoulders = midpoint(leftShoulder, rightShoulder);
  const hips = midpoint(leftHip, rightHip);
  const ankles = midpoint(leftAnkle, rightAnkle);
  if (!shoulders || !hips || !ankles) return 0;
  const verticalSpan = Math.abs(shoulders.y - ankles.y);
  const horizontalSpan = Math.abs(leftShoulder?.x ?? shoulders.x - (rightShoulder?.x ?? shoulders.x)) + Math.abs((leftHip?.x ?? hips.x) - (rightHip?.x ?? hips.x));
  return horizontalSpan / Math.max(verticalSpan, 0.001);
}

function averageJointVelocity(frames: SkeletonFrame[]) {
  const velocities = jointVelocities(frames);
  if (!velocities.length) return 0;
  return velocities.reduce((sum, value) => sum + value, 0) / velocities.length;
}

function maxJointVelocity(frames: SkeletonFrame[]) {
  const velocities = jointVelocities(frames);
  return velocities.length ? Math.max(...velocities) : 0;
}

function jointVelocities(frames: SkeletonFrame[]) {
  const velocities: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const previous = frames[i - 1];
    const current = frames[i];
    const seconds = Math.max(0.001, (Date.parse(current.timestamp) - Date.parse(previous.timestamp)) / 1000);
    for (const keypoint of current.keypoints) {
      const before = point(previous, keypoint.name);
      if (!before || before.confidence < 0.35 || keypoint.confidence < 0.35) continue;
      velocities.push(distance(before, keypoint) / seconds);
    }
  }
  return velocities;
}

function point(frame: SkeletonFrame, name: SkeletonKeypointName) {
  return frame.keypoints.find((keypoint) => keypoint.name === name);
}

function midpoint(a?: SkeletonKeypoint, b?: SkeletonKeypoint) {
  if (!a || !b || a.confidence < 0.35 || b.confidence < 0.35) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
