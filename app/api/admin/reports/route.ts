import { createCrudHandlers } from "@/lib/crud-route";
import { reportExportSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "report_exports",
  read: "audit_logs:read",
  write: "audit_logs:read",
  schema: reportExportSchema,
  defaultOrder: "created_at"
});
