import { createCrudHandlers } from "@/lib/crud-route";
import { childSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "children",
  read: "children:read",
  write: "children:write",
  schema: childSchema,
  defaultOrder: "created_at"
});
