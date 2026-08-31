export type TenantType = "STANDARD" | "KINDERGARTEN";
export type ObserverEngineName = "biometric" | "skeleton";

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PoseData = {
  keypoints: Array<{ joint: string; x: number; y: number; confidence: number }>;
  posture?: string;
  movement?: string;
};

export type VideoFrame = {
  capturedAt?: string;
  width?: number;
  height?: number;
  /** Raw buffers must never be populated for the kindergarten engine. */
  buffer?: Uint8Array | null;
  /** A frame already sanitized by the camera boundary. */
  sanitizedBuffer?: Uint8Array | null;
  metadata?: Record<string, unknown>;
};

export type KindergartenObservationEvent = {
  engine: "skeleton";
  type: string;
  skeleton_id: string;
  pose_data: PoseData;
  zone_bounding_box?: BoundingBox;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type StandardObservationEvent = {
  engine: "biometric";
  type: string;
  face_id?: string;
  biometric_profile_id?: string;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type ObservationEvent = KindergartenObservationEvent | StandardObservationEvent;

export interface IVisionEngine {
  readonly name: ObserverEngineName;
  readonly tenantType: TenantType;
  processFrame(frame: VideoFrame): Promise<ObservationEvent[]>;
  getCapabilities(): readonly string[];
}
