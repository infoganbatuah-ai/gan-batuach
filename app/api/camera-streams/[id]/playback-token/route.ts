import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createCameraPlaybackSession, playbackTokenSchema } from "@/lib/domain/video-streaming";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permission = await requirePermission("video:stream");
    if (!permission.allowed) return fail("Forbidden", 403);
    await assertRateLimit(request.headers.get("x-forwarded-for") ?? "viewer", "/api/camera-streams/playback-token", 120, 60);
    const { id } = await params;
    const payload = playbackTokenSchema.parse(await request.json());
    const session = await createCameraPlaybackSession(id, payload);
    return ok(session, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
