import { createCrudHandlers } from "@/lib/crud-route";
import { leadSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "leads",
  read: "gardens:read",
  write: "gardens:write",
  schema: leadSchema,
  publicInsert: true,
  defaultOrder: "created_at"
});
