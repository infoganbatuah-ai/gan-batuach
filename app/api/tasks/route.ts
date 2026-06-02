import { createCrudHandlers } from "@/lib/crud-route";
import { taskSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "tasks",
  read: "tasks:write",
  write: "tasks:write",
  schema: taskSchema,
  defaultOrder: "created_at"
});
