import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createDvrConnection, dvrConnectionSchema } from "@/lib/domain/video-gateway";

export async function POST(request: Request) {
  try {
    const permission = await requirePermission("cameras:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const payload = dvrConnectionSchema.parse(await request.json());
    const profile = permission.session.profile;
    if (profile.role !== "admin" && (!profile.garden_id || profile.garden_id !== payload.garden_id)) {
      return fail("Forbidden", 403);
    }
    return ok(await createDvrConnection(payload), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
