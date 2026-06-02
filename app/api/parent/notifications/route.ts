import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "notifications",
  read: "messages:write",
  write: "messages:write",
  defaultOrder: "created_at"
});
