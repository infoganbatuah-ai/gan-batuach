import { createCrudHandlers } from "@/lib/crud-route";
import { inspectionFormSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "inspection_forms",
  read: "inspections:read",
  write: "inspection_forms:write",
  schema: inspectionFormSchema,
  defaultOrder: "created_at"
});
