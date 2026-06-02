import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { ingestRtsp, rtspIngestSchema } from "@/lib/domain/video-gateway";

export async function POST(request: Request) {
  try {
    const permission = await requirePermission("cameras:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    return ok(await ingestRtsp(rtspIngestSchema.parse(await request.json())), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
