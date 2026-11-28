import { createCrudHandlers } from "@/lib/crud-route";
import { reportExportSchema } from "@/lib/validation";
import { getSessionProfile } from "@/lib/auth";
import { fail } from "@/lib/api";

const handlers = createCrudHandlers({
  table: "report_exports",
  read: "audit_logs:read",
  write: "audit_logs:read",
  schema: reportExportSchema,
  defaultOrder: "created_at"
});

export const POST = handlers.POST;

export async function GET(request: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return fail("Authentication required.", 401);
  return handlers.GET(request);
}
