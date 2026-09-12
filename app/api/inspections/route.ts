import { createCrudHandlers } from "@/lib/crud-route";
import { inspectionSchema } from "@/lib/validation";

export const { GET } = createCrudHandlers({
  table: "inspections",
  read: "inspections:read",
  write: "inspections:write",
  schema: inspectionSchema,
  defaultOrder: "created_at"
});
