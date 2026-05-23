import { createCrudHandlers } from "@/lib/crud-route";
import { procedureSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "mandatory_procedures",
  read: "documents:write",
  write: "documents:write",
  schema: procedureSchema,
  defaultOrder: "created_at"
});
