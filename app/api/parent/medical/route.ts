import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "medical_events",
  read: "children:read",
  write: "children:write",
  defaultOrder: "created_at"
});
