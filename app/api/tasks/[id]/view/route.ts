import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { markTaskViewed } from "@/lib/domain/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permission = await requirePermission("tasks:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const { id } = await params;
    return ok(await markTaskViewed(id, request), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
