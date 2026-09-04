import { assertKindergartenEvent, assertKindergartenPoseData, assertTenantEngineBoundary, prepareKindergartenFrame } from "./policy";
import type { IVisionEngine, KindergartenObservationEvent, PoseData, VideoFrame } from "./types";

export class SkeletonObserverEngine implements IVisionEngine {
  readonly name = "skeleton" as const;
  readonly tenantType = "KINDERGARTEN" as const;

  constructor() {
    assertTenantEngineBoundary("KINDERGARTEN", this.tenantType);
  }

  async processFrame(frame: VideoFrame): Promise<KindergartenObservationEvent[]> {
    const safeFrame = prepareKindergartenFrame(frame);
    if (typeof safeFrame.capturedAt !== "string" || !safeFrame.capturedAt.trim()) throw new Error("Kindergarten event schema violation: capturedAt is required.");
    const poseData = safeFrame.metadata?.pose_data as PoseData | undefined;
    if (!poseData) return [];
    assertKindergartenPoseData(poseData);
    const skeletonId = safeFrame.metadata?.skeleton_id;
    const confidence = safeFrame.metadata?.confidence;
    const eventType = safeFrame.metadata?.event_type;
    if (typeof skeletonId !== "string" || !skeletonId.trim()) throw new Error("Kindergarten event schema violation: skeleton_id is required.");
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Kindergarten event schema violation: confidence must be between 0 and 1.");
    if (typeof eventType !== "string" || !eventType.trim()) throw new Error("Kindergarten event schema violation: event type is required.");

    const event: KindergartenObservationEvent = {
      engine: "skeleton",
      type: eventType,
      skeleton_id: skeletonId,
      pose_data: poseData,
      zone_bounding_box: safeFrame.metadata?.zone_bounding_box as KindergartenObservationEvent["zone_bounding_box"],
      confidence,
      timestamp: safeFrame.capturedAt ?? new Date().toISOString(),
      metadata: { privacy_mode: "kindergarten_pose_only", face_processing: false, biometric_processing: false }
    };
    assertKindergartenEvent(event);
    return [event];
  }

  getCapabilities() {
    return ["PoseEstimation", "SkeletonTracking", "ZoneMonitoring", "SafetyBehaviorMonitoring"] as const;
  }
}
