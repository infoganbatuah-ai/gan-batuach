import { createMonthlyInspectionTasks } from "@/lib/domain/inspection-engine";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return fail("Unauthorized cron request", 401);
    }
    await assertRateLimit("cron", "/api/cron/monthly-inspections", 12, 3600);

    const body = await request.json().catch(() => ({}));
    const result = await createMonthlyInspectionTasks(body.month);
    return ok({ created: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
