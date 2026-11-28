import { createCrudHandlers } from "@/lib/crud-route";
import { messageSchema } from "@/lib/validation";
import { getSessionProfile } from "@/lib/auth";
import { fail } from "@/lib/api";

const handlers = createCrudHandlers({
  table: "messages",
  read: "messages:write",
  write: "messages:write",
  schema: messageSchema,
  defaultOrder: "created_at"
});

export const POST = handlers.POST;

export async function GET(request: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return fail("Authentication required", 401);
  return handlers.GET(request);
}
