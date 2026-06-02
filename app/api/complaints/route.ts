import { createCrudHandlers } from "@/lib/crud-route";
import { complaintSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "complaints",
  read: "complaints:write",
  write: "complaints:write",
  schema: complaintSchema,
  defaultOrder: "created_at"
});
