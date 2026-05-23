import { createCrudHandlers } from "@/lib/crud-route";
import { staffSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "staff",
  read: "staff:read",
  write: "staff:write",
  schema: staffSchema,
  defaultOrder: "created_at"
});
