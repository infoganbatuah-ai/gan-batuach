import { z } from "zod";

const common = {
  camera_source_id: z.string().uuid(), request_id: z.string().uuid(),
  requested_at: z.string().datetime(), confirmed: z.literal(true)
};

// Shared bounded shapes only. This module cannot contact or execute hardware.
export const cameraActionSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("ptz"), payload: z.object({ direction: z.enum(["left", "right", "up", "down", "zoom_in", "zoom_out"]), duration_ms: z.number().int().min(100).max(1_000) }).strict() }).strict(),
  z.object({ ...common, action: z.literal("lighting"), payload: z.object({ enabled: z.boolean() }).strict() }).strict(),
  z.object({ ...common, action: z.literal("siren"), payload: z.object({ duration_ms: z.number().int().min(100).max(5_000) }).strict() }).strict(),
  z.object({ ...common, action: z.literal("talk"), payload: z.object({ text: z.string().trim().min(1).max(256) }).strict() }).strict()
]);
export type CameraActionRequest = z.infer<typeof cameraActionSchema>;
