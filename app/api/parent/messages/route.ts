import { createCrudHandlers } from "@/lib/crud-route";
import { messageSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "messages",
  read: "messages:write",
  write: "messages:write",
  schema: messageSchema,
  defaultOrder: "created_at"
});
