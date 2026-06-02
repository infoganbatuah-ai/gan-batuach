import { createCrudHandlers } from "@/lib/crud-route";
import { inspectorSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "inspectors",
  read: "gardens:read",
  write: "gardens:write",
  schema: inspectorSchema,
  defaultOrder: "created_at"
});
