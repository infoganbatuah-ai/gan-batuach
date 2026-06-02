import { fail, handleRouteError, ok } from "@/lib/api";
import { aiObservationSchema, registerAiObservation } from "@/lib/domain/ai-observer";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-ai-observer-secret");
    if (!process.env.AI_OBSERVER_SECRET || secret !== process.env.AI_OBSERVER_SECRET) {
      return fail("Unauthorized AI observer request", 401);
    }
    await assertRateLimit(request.headers.get("x-forwarded-for") ?? "ai-observer", "/api/ai/observe", 600, 60);

    const payload = aiObservationSchema.parse(await request.json());
    const event = await registerAiObservation(payload);
    return ok(event, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
