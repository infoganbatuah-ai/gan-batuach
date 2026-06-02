import { createCrudHandlers } from "@/lib/crud-route";
import { attendanceSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "attendance",
  read: "attendance:write",
  write: "attendance:write",
  schema: attendanceSchema,
  defaultOrder: "created_at"
});
