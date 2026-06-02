import { createCrudHandlers } from "@/lib/crud-route";
import { aiEventSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "ai_events",
  read: "ai_events:read",
  write: "ai_events:write",
  schema: aiEventSchema,
  defaultOrder: "detected_at"
});
