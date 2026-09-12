import { z } from "zod";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionAnswerSchema } from "@/lib/domain/inspection-engine";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["inspector"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_monthly_inspection_draft" as never, { p_inspection_id: id } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["inspector"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    const answers = z.array(inspectionAnswerSchema).parse((await request.json()).answers);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_monthly_inspection_draft" as never, { p_inspection_id: id, p_answers: answers } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 422);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
