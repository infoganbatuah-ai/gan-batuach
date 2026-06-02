import { createCrudHandlers } from "@/lib/crud-route";

export const { GET, POST } = createCrudHandlers({
  table: "gallery_items",
  read: "children:read",
  write: "documents:write",
  defaultOrder: "created_at"
});
