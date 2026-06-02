import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "schedule_items",
  read: "children:read",
  write: "documents:write",
  defaultOrder: "starts_at"
});
