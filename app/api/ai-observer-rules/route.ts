import { createCrudHandlers } from "@/lib/crud-route";
import { z } from "zod";

const schema = z.object({
  garden_id: z.string().uuid().optional().nullable(),
  camera_stream_id: z.string().uuid().optional().nullable(),
  event_type: z.string().min(2),
  enabled: z.boolean().default(true),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  threshold: z.number().min(0).max(1).default(0.75),
  cooldown_seconds: z.number().int().min(0).default(60),
  config: z.record(z.string(), z.unknown()).default({})
});

export const { GET, POST } = createCrudHandlers({
  table: "ai_observer_rules",
  read: "ai_events:read",
  write: "ai_events:write",
  schema,
  defaultOrder: "created_at"
});
