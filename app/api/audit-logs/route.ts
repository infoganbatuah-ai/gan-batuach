import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "audit_logs",
  read: "audit_logs:read",
  write: "audit_logs:read",
  defaultOrder: "created_at"
});
