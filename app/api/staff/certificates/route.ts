import { createCrudHandlers } from "@/lib/crud-route";
import { staffCertificateSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "staff_certificates",
  read: "staff:read",
  write: "staff:write",
  schema: staffCertificateSchema,
  defaultOrder: "created_at"
});
