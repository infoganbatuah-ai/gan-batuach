import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enqueueObserverJob, processObserverJobMock, retryObserverJob } from "@/lib/domain/ai-observer/worker";

const mockJobSchema = z.object({
  action: z.enum(["run", "retry"]).default("run"),
  job_id: z.string().uuid().optional(),
  kindergarten_id: z.string().uuid().optional(),
  camera_id: z.string().uuid().optional(),
  rule_key: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = mockJobSchema.parse(await request.json().catch(() => ({})));
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    if (payload.action === "retry") {
      if (!payload.job_id) return fail("חסר job להרצה חוזרת.", 422);
      const job = await retryObserverJob(supabase, payload.job_id);
      return ok({ job, message: "Mock observer job retried." });
    }

    const job = await enqueueObserverJob(supabase, {
      kindergarten_id: payload.kindergarten_id,
      camera_id: payload.camera_id,
      rule_key: payload.rule_key,
      metadata: { requested_by: profile.id, requested_role: profile.role }
    });
    const processed = await processObserverJobMock(supabase, job);
    return ok({ job: processed, message: "Mock observer job processed." });
  } catch (error) {
    return handleRouteError(error);
  }
}
