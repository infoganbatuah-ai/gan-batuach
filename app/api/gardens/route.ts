import { createCrudHandlers } from "@/lib/crud-route";
import { gardenSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "gardens",
  read: "gardens:read",
  write: "gardens:write",
  schema: gardenSchema,
  defaultOrder: "created_at"
});
