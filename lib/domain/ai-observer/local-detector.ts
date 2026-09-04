import { z } from "zod";
import { createLocalVisionAdapter, mapFrameAnalysisToShadowDetections } from "@/lib/domain/ai-observer/local-vision-adapter";
import { assertKindergartenPayload } from "@/lib/domain/observer-engine";

export const localShadowDetectionTypes = [
  "camera_offline",
  "camera_frozen_suspected",
  "motion_detected",
  "no_motion_too_long",
  "person_detected",
  "multiple_persons_detected",
  "restricted_area_occupancy",
  "camera_obstruction_suspected"
] as const;

export const frameSampleInputSchema = z.object({
  camera_id: z.string().uuid().optional(),
  kindergarten_id: z.string().uuid(),
  gateway_snapshot_url: z.string().url().nullable().optional(),
  frame_metadata: z.record(z.string(), z.unknown()).default({}),
  zone_id: z.string().uuid().nullable().optional(),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  previous_frame_hash: z.string().nullable().optional(),
  motion_score: z.number().min(0).max(1).nullable().optional(),
  mock_scenario: z.string().optional()
});

export type FrameSampleInput = z.infer<typeof frameSampleInputSchema>;

export type LocalShadowDetection = {
  event_type: (typeof localShadowDetectionTypes)[number];
  severity: "info" | "low" | "medium" | "high" | "urgent" | "critical";
  confidence_score: number;
  title: string;
  description: string;
  recommended_action: string;
  dedupe_key: string;
  metadata: Record<string, unknown>;
};

export interface LocalDetector {
  provider: "local_mock" | "local_opencv" | "local_yolo" | "local_http";
  mode: "shadow";
  analyze(input: FrameSampleInput, context?: { camera?: Record<string, any> | null; zone?: Record<string, any> | null; routine?: Record<string, any> | null; learningProfile?: Record<string, any> | null }): Promise<LocalShadowDetection[]>;
}

export class LocalMockDetector implements LocalDetector {
  provider: LocalDetector["provider"] = "local_mock";
  mode = "shadow" as const;

  async analyze(inputValue: FrameSampleInput, context: { camera?: Record<string, any> | null; zone?: Record<string, any> | null; routine?: Record<string, any> | null; learningProfile?: Record<string, any> | null } = {}) {
    const input = frameSampleInputSchema.parse(inputValue);
    assertKindergartenPayload(input.frame_metadata);
    const adapter = createLocalVisionAdapter();
    const result = await adapter.analyzeFrame({
      camera_id: input.camera_id ?? null,
      kindergarten_id: input.kindergarten_id,
      frame_url: input.gateway_snapshot_url ?? null,
      frame_buffer: null,
      zone_id: input.zone_id ?? null,
      timestamp: input.timestamp,
      routine_context: context.routine ?? null,
      previous_frame_hash: input.previous_frame_hash ?? null,
      motion_metadata: {
        motion_score: input.motion_score ?? null,
        frame_hash: typeof input.frame_metadata?.frame_hash === "string" ? input.frame_metadata.frame_hash : null,
        mock_scenario: input.mock_scenario ?? null
      },
      frame_metadata: {
        ...input.frame_metadata,
        privacy_mode: "kindergarten_pose_only",
        face_processing: false,
        biometric_processing: false,
        routine_context_present: Boolean(context.routine),
        learning_profile_status: context.learningProfile?.learning_status ?? null
      }
    }, context);
    this.provider = result.provider;
    return mapFrameAnalysisToShadowDetections({
      camera_id: input.camera_id ?? null,
      kindergarten_id: input.kindergarten_id,
      frame_url: input.gateway_snapshot_url ?? null,
      frame_buffer: null,
      zone_id: input.zone_id ?? null,
      timestamp: input.timestamp,
      routine_context: context.routine ?? null,
      previous_frame_hash: input.previous_frame_hash ?? null,
      motion_metadata: {
        motion_score: input.motion_score ?? null,
        frame_hash: typeof input.frame_metadata?.frame_hash === "string" ? input.frame_metadata.frame_hash : null,
        mock_scenario: input.mock_scenario ?? null
      },
      frame_metadata: input.frame_metadata
    }, result, context) as LocalShadowDetection[];
  }
}

export function createLocalDetector(): LocalDetector {
  return new LocalMockDetector();
}
