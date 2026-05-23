import { createCrudHandlers } from "@/lib/crud-route";
import { campaignSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "campaigns",
  read: "messages:write",
  write: "messages:write",
  schema: campaignSchema,
  defaultOrder: "created_at"
});
