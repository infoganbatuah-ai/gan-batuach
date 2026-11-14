import { createCrudHandlers } from "@/lib/crud-route";
import { childSchema } from "@/lib/validation";
import { fail } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";

const handlers = createCrudHandlers({
  table: "children",
  read: "children:read",
  write: "children:write",
  schema: childSchema,
  defaultOrder: "created_at"
});

export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
  return handlers.GET(request);
}

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
  return handlers.POST(request);
}
