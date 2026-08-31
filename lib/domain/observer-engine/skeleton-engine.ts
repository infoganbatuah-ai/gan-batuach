import { assertTenantEngineBoundary, prepareKindergartenFrame } from "./policy";
import type { IVisionEngine, KindergartenObservationEvent, PoseData, VideoFrame } from "./types";

export class SkeletonObserverEngine implements IVisionEngine {
  readonly name = "skeleton" as const;
  readonly tenantType = "KINDERGARTEN" as const;

  constructor() {
    assertTenantEngineBoundary("KINDERGARTEN", this.tenantType);
  }

  async processFrame(frame: VideoFrame): Promise<KindergartenObservationEvent[]> {
    const safeFrame = prepareKindergartenFrame(frame);
    const poseData = safeFrame.metadata?.pose_data as PoseData | undefined;
    if (!poseData) return [];

    return [{
      engine: "skeleton",
      type: String(safeFrame.metadata?.event_type ?? "person_detected"),
      skeleton_id: String(safeFrame.metadata?.skeleton_id ?? "temporary-skeleton"),
      pose_data: poseData,
      zone_bounding_box: safeFrame.metadata?.zone_bounding_box as KindergartenObservationEvent["zone_bounding_box"],
      confidence: Number(safeFrame.metadata?.confidence ?? 0),
      timestamp: safeFrame.capturedAt ?? new Date().toISOString(),
      metadata: { privacy_mode: "kindergarten_pose_only", face_processing: false, biometric_processing: false }
    }];
  }

  getCapabilities() {
    return ["PoseEstimation", "SkeletonTracking", "ZoneMonitoring", "SafetyBehaviorMonitoring"] as const;
  }
}
