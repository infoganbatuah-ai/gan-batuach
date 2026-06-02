import { createCrudHandlers } from "@/lib/crud-route";
import { staffShiftSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "staff_shifts",
  read: "staff:read",
  write: "attendance:write",
  schema: staffShiftSchema,
  defaultOrder: "shift_date"
});
