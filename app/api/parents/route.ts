import { createCrudHandlers } from "@/lib/crud-route";
import { parentSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "parents",
  read: "children:read",
  write: "children:write",
  schema: parentSchema,
  defaultOrder: "created_at"
});
