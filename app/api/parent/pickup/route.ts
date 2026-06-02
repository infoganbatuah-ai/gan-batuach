import { createCrudHandlers } from "@/lib/crud-route";
import { pickupConfirmationSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "pickup_confirmations",
  read: "attendance:write",
  write: "attendance:write",
  schema: pickupConfirmationSchema,
  defaultOrder: "confirmed_at"
});
