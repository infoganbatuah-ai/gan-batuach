import { createCrudHandlers } from "@/lib/crud-route";
import { restrictedAreaSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "restricted_areas",
  read: "cameras:read",
  write: "cameras:write",
  schema: restrictedAreaSchema,
  defaultOrder: "created_at"
});
