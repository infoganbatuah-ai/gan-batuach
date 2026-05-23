import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "ai_alerts",
  read: "ai_events:read",
  write: "ai_events:write",
  defaultOrder: "created_at"
});
