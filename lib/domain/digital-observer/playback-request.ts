import { z } from "zod";

// A channel number in a shared server config does not establish site ownership.
// Always require the source that can be checked against the authenticated site.
export const playbackRequestSchema = z.object({
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid(),
  mode: z.literal("live").default("live")
}).strict();
