import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "incident_timeline",
  read: "ai_events:read",
  write: "ai_events:write",
  defaultOrder: "occurred_at"
});
