import { createCrudHandlers } from "@/lib/crud-route";
import { cameraSnapshotSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "camera_snapshots",
  read: "cameras:read",
  write: "cameras:write",
  schema: cameraSnapshotSchema,
  defaultOrder: "captured_at"
});
