import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { discoverOnvif, onvifDiscoverySchema } from "@/lib/domain/video-gateway";

export async function POST(request: Request) {
  try {
    const permission = await requirePermission("cameras:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const payload = onvifDiscoverySchema.parse(await request.json());
    const profile = permission.session.profile;
    if (profile.role !== "admin" && (!profile.garden_id || profile.garden_id !== payload.garden_id)) {
      return fail("Forbidden", 403);
    }
    return ok(await discoverOnvif(payload));
  } catch (error) {
    return handleRouteError(error);
  }
}
