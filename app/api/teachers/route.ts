import { createCrudHandlers } from "@/lib/crud-route";
import { teacherSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "teachers",
  read: "staff:read",
  write: "staff:write",
  schema: teacherSchema,
  defaultOrder: "created_at"
});
