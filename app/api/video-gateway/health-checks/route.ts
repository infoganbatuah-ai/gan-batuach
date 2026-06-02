import { fail, handleRouteError, ok } from "@/lib/api";
import { recordStreamHealth, streamHealthSchema } from "@/lib/domain/video-gateway";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    if (request.headers.get("x-video-gateway-secret") !== process.env.VIDEO_GATEWAY_SIGNING_SECRET) {
      return fail("Unauthorized video gateway request", 401);
    }
    await assertRateLimit(request.headers.get("x-forwarded-for") ?? "video-gateway", "/api/video-gateway/health-checks", 1200, 60);
    return ok(await recordStreamHealth(streamHealthSchema.parse(await request.json())), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
