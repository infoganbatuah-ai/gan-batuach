import { createCrudHandlers } from "@/lib/crud-route";
import { parentCameraPermissionSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "parent_camera_permissions",
  read: "cameras:read",
  write: "cameras:write",
  schema: parentCameraPermissionSchema,
  defaultOrder: "created_at"
});
