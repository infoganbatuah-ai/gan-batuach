import { createCrudHandlers } from "@/lib/crud-route";
import { cameraStreamSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "camera_streams",
  read: "cameras:read",
  write: "cameras:write",
  schema: cameraStreamSchema,
  defaultOrder: "created_at"
});
