import { createCrudHandlers } from "@/lib/crud-route";
import { cameraSnapshotSchema } from "@/lib/validation";
import { fail } from "@/lib/api";

const handlers = createCrudHandlers({
  table: "camera_snapshots",
  read: "cameras:read",
  write: "cameras:write",
  schema: cameraSnapshotSchema,
  defaultOrder: "captured_at"
});

export const GET = handlers.GET;

export async function POST(request: Request) {
  if (process.env.CAMERA_SNAPSHOT_STORAGE_RLS_VERIFIED !== "true") {
    return fail("קליטת תמונות מצלמה נעולה עד להחלת ואימות מדיניות האחסון הפרטית.", 503);
  }
  return handlers.POST(request);
}
