import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { GUARD_QA_EMAIL, guardQaEnvironmentAllowed, runGuardLearningFixture } from "@/lib/domain/digital-observer/qa-learning-fixture";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const bodySchema = z.object({ run_isolated_fixture: z.literal(true), expected_commit: z.string().regex(/^[a-f0-9]{40}$/) }).strict();

export async function POST(request: Request) {
  // No diagnostic writes in Production, other branches, local servers or other projects.
  if (!guardQaEnvironmentAllowed(process.env)) return fail("Not found", 404);
  if (!/^Bearer \S+$/.test(request.headers.get("authorization") ?? "")) return fail("Authentication required", 401);
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Authentication required", 401);
    if (session.user.email?.toLowerCase() !== GUARD_QA_EMAIL || !session.user.email_confirmed_at
      || session.profile.id !== session.user.id || session.profile.garden_id) return fail("QA account required", 403);
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return fail("Explicit isolated fixture confirmation required", 422);
    if (body.data.expected_commit !== process.env.VERCEL_GIT_COMMIT_SHA) return fail("Preview commit mismatch; no fixture created", 409);
    const report = await runGuardLearningFixture(createAdminClient(), session.supabase, session.user.id);
    return ok({ ...report, branch: process.env.VERCEL_GIT_COMMIT_REF, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      synthetic_metrics_only: true, hardware_actions: 0 }, report.passed ? 200 : 500);
  } catch {
    return fail("QA fixture could not run; no credential details are returned", 500);
  }
}
