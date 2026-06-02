import { createAdminClient } from "@/lib/supabase/admin";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
      return fail("Unauthorized cron request", 401);
    }
    await assertRateLimit("cron", "/api/cron/inspection-reminders", 60, 3600);
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("process_monthly_inspection_reminders" as any, {});
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
