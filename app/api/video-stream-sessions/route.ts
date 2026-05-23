import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "video_stream_sessions",
  read: "cameras:read",
  write: "video:stream",
  defaultOrder: "created_at"
});
