import { createCrudHandlers } from "@/lib/crud-route";
import { documentSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "documents",
  read: "documents:write",
  write: "documents:write",
  schema: documentSchema,
  defaultOrder: "created_at"
});
