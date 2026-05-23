import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "violations",
  read: "inspections:read",
  write: "violations:write",
  defaultOrder: "created_at"
});
